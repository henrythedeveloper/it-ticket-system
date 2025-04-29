// backend/internal/api/handlers/ticket/create.go

package ticket

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/henrythedeveloper/it-ticket-system/internal/models" // Data models
	"github.com/jackc/pgx/v5"
	"github.com/labstack/echo/v4"
)

// CreateTicket handles the HTTP request to create a new support ticket.
// It expects ticket details in the request body (JSON format).
func (h *Handler) CreateTicket(c echo.Context) (err error) { // Use named return for defer rollback check
	ctx := c.Request().Context()
	logger := slog.With("handler", "CreateTicket")

	// --- 1. Bind Request Body ---
	var ticketCreate models.TicketCreate
	if err = c.Bind(&ticketCreate); err != nil {
		logger.WarnContext(ctx, "Failed to bind request body", "error", err)
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid request body: "+err.Error())
	}
	// TODO: Add validation

	// *** CAPTURE EMAIL IMMEDIATELY ***
	emailToSend := ticketCreate.EndUserEmail

	logger.DebugContext(ctx, "Ticket creation request received",
		"endUserEmail", ticketCreate.EndUserEmail, // Log from original struct
		"capturedEmailToSend", emailToSend,         // Log the captured value
		"subject", ticketCreate.Subject)

	// --- 2. Database Transaction ---
	tx, err := h.db.Pool.Begin(ctx)
	if err != nil {
		logger.ErrorContext(ctx, "Failed to begin database transaction", "error", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "Database error: failed to start transaction.")
	}
	defer func() {
		if err != nil {
			logger.WarnContext(ctx, "Rolling back transaction due to error", "error", err)
			if rbErr := tx.Rollback(ctx); rbErr != nil {
				logger.ErrorContext(ctx, "Failed to rollback transaction", "rollbackError", rbErr)
			}
		}
	}()

	// --- 3. Insert Ticket into Database ---
	var createdTicket models.Ticket
	// Use ticketCreate.EndUserEmail (or emailToSend) for the insert
	err = tx.QueryRow(ctx, `
        INSERT INTO tickets (
            end_user_email, issue_type, urgency, subject, body,
            status, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, ticket_number, end_user_email, issue_type, urgency, subject, body,
                  status, assigned_to_user_id, created_at, updated_at, closed_at,
                  resolution_notes
        `,
		emailToSend, // Use the captured email for insertion
		ticketCreate.IssueType, ticketCreate.Urgency,
		ticketCreate.Subject, ticketCreate.Body, models.StatusUnassigned,
		time.Now(), time.Now(),
	).Scan(
		&createdTicket.ID, &createdTicket.TicketNumber, &createdTicket.EndUserEmail,
		&createdTicket.IssueType, &createdTicket.Urgency, &createdTicket.Subject,
		&createdTicket.Body, &createdTicket.Status, &createdTicket.AssignedToUserID,
		&createdTicket.CreatedAt, &createdTicket.UpdatedAt, &createdTicket.ClosedAt,
		&createdTicket.ResolutionNotes,
	)
	if err != nil {
		logger.ErrorContext(ctx, "Failed to insert ticket into database", "error", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "Database error: failed to create ticket record.")
	}

	// Log email immediately after scan to verify RETURNING clause
	logger.DebugContext(ctx, "Scanned ticket details after insert",
		"ticketUUID", createdTicket.ID,
		"ticketNumber", createdTicket.TicketNumber,
		"scannedEndUserEmail", createdTicket.EndUserEmail) // Check this value specifically

	logger.DebugContext(ctx, "Ticket record inserted", "ticketUUID", createdTicket.ID, "ticketNumber", createdTicket.TicketNumber)


	// --- 4. Process and Link Tags ---
	if len(ticketCreate.Tags) > 0 {
		tagIDs, tagErr := h.findOrCreateTags(ctx, tx, ticketCreate.Tags)
		if tagErr != nil {
			err = tagErr // Set the named return error to trigger rollback
			return echo.NewHTTPError(http.StatusInternalServerError, "Database error: failed to process tags.")
		}
		linkErr := h.linkTagsToTicket(ctx, tx, createdTicket.ID, tagIDs)
		if linkErr != nil {
			err = linkErr // Set the named return error to trigger rollback
			return echo.NewHTTPError(http.StatusInternalServerError, "Database error: failed to link tags to ticket.")
		}
		logger.DebugContext(ctx, "Tags processed and linked", "ticketUUID", createdTicket.ID, "tagIDs", tagIDs)
	}

	// --- 5. Commit Transaction ---
	err = tx.Commit(ctx)
	if err != nil {
		logger.ErrorContext(ctx, "Failed to commit transaction", "ticketUUID", createdTicket.ID, "error", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "Database error: failed to save ticket.")
	}

	// --- 6. Post-Creation Actions (Email Notification) ---
	logger.InfoContext(ctx, "Ticket created successfully", "ticketUUID", createdTicket.ID, "ticketNumber", createdTicket.TicketNumber)

	// *** ADD EXTRA LOGGING BEFORE GOROUTINE ***
	logger.DebugContext(ctx, "Preparing to send confirmation email",
		"emailToSendVar", emailToSend, // Log the variable being passed
		"ticketNumber", createdTicket.TicketNumber,
		"ticketSubject", createdTicket.Subject)

	// Send confirmation email asynchronously
	go func(recipientEmail, ticketNumStr, ticketSubject string) {
		// Use background context for the goroutine
		bgCtx := context.Background()
		// Create a logger for the goroutine
		emailLogger := slog.With("operation", "SendTicketConfirmation", "ticketNumber", ticketNumStr)

		// Use the recipientEmail passed directly into the goroutine
		if emailErr := h.emailService.SendTicketConfirmation(recipientEmail, ticketNumStr, ticketSubject); emailErr != nil {
			// Log the email that was attempted
			emailLogger.ErrorContext(bgCtx, "Failed to send ticket confirmation email", "recipient", recipientEmail, "error", emailErr)
		} else {
			emailLogger.InfoContext(bgCtx, "Sent ticket confirmation email", "recipient", recipientEmail)
		}
	}(emailToSend, fmt.Sprintf("%d", createdTicket.TicketNumber), createdTicket.Subject) // Pass the captured email

	// --- 7. Return Success Response ---
	return c.JSON(http.StatusCreated, models.APIResponse{
		Success: true,
		Message: "Ticket created successfully.",
		Data:    createdTicket,
	})
}

// --- Helper Functions (findOrCreateTags, linkTagsToTicket) remain the same ---

// findOrCreateTags finds existing tags or creates new ones within a transaction.
func (h *Handler) findOrCreateTags(ctx context.Context, tx pgx.Tx, tagNames []string) ([]string, error) {
	logger := slog.With("helper", "findOrCreateTags")
	tagIDs := make([]string, 0, len(tagNames))

	for _, name := range tagNames {
		var tagID string
		// Check if tag exists
		err := tx.QueryRow(ctx, `SELECT id FROM tags WHERE name = $1`, name).Scan(&tagID)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				// Tag doesn't exist, create it
				logger.DebugContext(ctx, "Tag not found, creating...", "tagName", name)
				err = tx.QueryRow(ctx, `INSERT INTO tags (name, created_at) VALUES ($1, $2) RETURNING id`, name, time.Now()).Scan(&tagID)
				if err != nil {
					logger.ErrorContext(ctx, "Failed to create new tag", "tagName", name, "error", err)
					return nil, fmt.Errorf("failed to create tag '%s': %w", name, err)
				}
				logger.DebugContext(ctx, "Created new tag", "tagName", name, "tagID", tagID)
			} else {
				// Other database error while checking
				logger.ErrorContext(ctx, "Failed to query existing tag", "tagName", name, "error", err)
				return nil, fmt.Errorf("failed to check tag '%s': %w", name, err)
			}
		} else {
			logger.DebugContext(ctx, "Found existing tag", "tagName", name, "tagID", tagID)
		}
		tagIDs = append(tagIDs, tagID)
	}
	return tagIDs, nil
}

// linkTagsToTicket associates a list of tag IDs with a ticket ID in the join table.
func (h *Handler) linkTagsToTicket(ctx context.Context, tx pgx.Tx, ticketID string, tagIDs []string) error {
	logger := slog.With("helper", "linkTagsToTicket", "ticketUUID", ticketID)
	if len(tagIDs) == 0 {
		return nil // Nothing to link
	}

	sql := `INSERT INTO ticket_tags (ticket_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`
	batch := &pgx.Batch{}
	for _, tagID := range tagIDs {
		batch.Queue(sql, ticketID, tagID)
	}

	results := tx.SendBatch(ctx, batch)
	defer results.Close() // Ensure results are closed

	for i := 0; i < len(tagIDs); i++ {
		_, err := results.Exec()
		if err != nil {
			logger.ErrorContext(ctx, "Failed to link tag in batch", "tagID", tagIDs[i], "error", err)
			return fmt.Errorf("failed to link tag ID %s: %w", tagIDs[i], err)
		}
	}

	logger.DebugContext(ctx, "Successfully linked tags to ticket")
	return nil
}
