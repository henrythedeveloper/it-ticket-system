// backend/internal/api/handlers/ticket/create.go
// ==========================================================================
// Handler function for creating new support tickets.
// Handles request binding, database insertion (within a transaction),
// tag management, and sending confirmation emails.
// ==========================================================================

package ticket

import (
	"context"
	"errors"
	"fmt"
	"log/slog" // Use structured logging
	"net/http"
	"time"

	"github.com/henrythedeveloper/it-ticket-system/internal/models" // Data models
	"github.com/jackc/pgx/v5"
	"github.com/labstack/echo/v4"
)

// --- Handler Function ---

// CreateTicket handles the HTTP request to create a new support ticket.
// It expects ticket details in the request body (JSON format).
//
// Parameters:
//   - c: The echo context, providing access to request and response.
//
// Returns:
//   - error: An error if processing fails (e.g., bad request, database error),
//     otherwise nil. Returns a JSON response with the created ticket on success.
func (h *Handler) CreateTicket(c echo.Context) (err error) { // Use named return for defer rollback check
	ctx := c.Request().Context()
	logger := slog.With("handler", "CreateTicket") // Create a logger specific to this handler

	// --- 1. Bind Request Body ---
	var ticketCreate models.TicketCreate
	if err = c.Bind(&ticketCreate); err != nil {
		logger.WarnContext(ctx, "Failed to bind request body", "error", err)
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid request body: "+err.Error())
	}
	// TODO: Add validation using a library like 'validator' if not handled by Echo middleware

	logger.DebugContext(ctx, "Ticket creation request received",
		"endUserEmail", ticketCreate.EndUserEmail, // Log non-sensitive identifiers
		"subject", ticketCreate.Subject)

	// --- 2. Database Transaction ---
	tx, err := h.db.Pool.Begin(ctx)
	if err != nil {
		logger.ErrorContext(ctx, "Failed to begin database transaction", "error", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "Database error: failed to start transaction.")
	}
	// Defer rollback ensures transaction is cleaned up if any error occurs before commit
	defer func() {
		if err != nil { // Check the named return error
			logger.WarnContext(ctx, "Rolling back transaction due to error", "error", err)
			if rbErr := tx.Rollback(ctx); rbErr != nil {
				logger.ErrorContext(ctx, "Failed to rollback transaction", "rollbackError", rbErr)
			}
		}
	}()

	// --- 3. Insert Ticket into Database ---
	var createdTicket models.Ticket
	// Insert the main ticket record
	err = tx.QueryRow(ctx, `
        INSERT INTO tickets (
            end_user_email, issue_type, urgency, subject, body,
            status, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, ticket_number, end_user_email, issue_type, urgency, subject, body,
                  status, assigned_to_user_id, created_at, updated_at, closed_at,
                  resolution_notes
        `,
		ticketCreate.EndUserEmail, ticketCreate.IssueType, ticketCreate.Urgency,
		ticketCreate.Subject, ticketCreate.Body, models.StatusUnassigned, // Default status
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
		// Specific error handling (e.g., check for constraint violations) could go here
		return echo.NewHTTPError(http.StatusInternalServerError, "Database error: failed to create ticket record.")
	}
	logger.DebugContext(ctx, "Ticket record inserted", "ticketUUID", createdTicket.ID, "ticketNumber", createdTicket.TicketNumber)

	// --- 4. Process and Link Tags ---
	if len(ticketCreate.Tags) > 0 {
		// Use the helper function to handle tag creation/linking within the transaction
		tagIDs, err := h.findOrCreateTags(ctx, tx, ticketCreate.Tags)
		if err != nil {
			// Error is already logged within findOrCreateTags
			// The defer func will handle rollback
			return echo.NewHTTPError(http.StatusInternalServerError, "Database error: failed to process tags.")
		}

		// Link tags to the ticket using the retrieved tag IDs
		err = h.linkTagsToTicket(ctx, tx, createdTicket.ID, tagIDs)
		if err != nil {
			// Error is already logged within linkTagsToTicket
			// The defer func will handle rollback
			return echo.NewHTTPError(http.StatusInternalServerError, "Database error: failed to link tags to ticket.")
		}
		logger.DebugContext(ctx, "Tags processed and linked", "ticketUUID", createdTicket.ID, "tagIDs", tagIDs)
	}

	// --- 5. Commit Transaction ---
	err = tx.Commit(ctx) // Assign commit error to the named return variable
	if err != nil {
		logger.ErrorContext(ctx, "Failed to commit transaction", "ticketUUID", createdTicket.ID, "error", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "Database error: failed to save ticket.")
	}

	// --- 6. Post-Creation Actions (Email Notification) ---
	logger.InfoContext(ctx, "Ticket created successfully", "ticketUUID", createdTicket.ID, "ticketNumber", createdTicket.TicketNumber)

	// Send confirmation email asynchronously
	go func(t models.Ticket) {
		// Use background context for the goroutine
		bgCtx := context.Background()
		// Create a logger for the goroutine
		emailLogger := slog.With("operation", "SendTicketConfirmation", "ticketUUID", t.ID, "ticketNumber", t.TicketNumber)
		ticketNumStr := fmt.Sprintf("%d", t.TicketNumber) // Format ticket number for display

		if emailErr := h.emailService.SendTicketConfirmation(t.EndUserEmail, ticketNumStr, t.Subject); emailErr != nil {
			emailLogger.ErrorContext(bgCtx, "Failed to send ticket confirmation email", "recipient", t.EndUserEmail, "error", emailErr)
		} else {
			emailLogger.InfoContext(bgCtx, "Sent ticket confirmation email", "recipient", t.EndUserEmail)
		}
	}(createdTicket) // Pass a copy of the created ticket

	// --- 7. Return Success Response ---
	return c.JSON(http.StatusCreated, models.APIResponse{
		Success: true,
		Message: "Ticket created successfully.",
		Data:    createdTicket, // Return the full created ticket object
	})
}

// --- Helper Functions ---

// findOrCreateTags finds existing tags or creates new ones within a transaction.
//
// Parameters:
//   - ctx: The request context.
//   - tx: The database transaction.
//   - tagNames: A slice of tag names to find or create.
//
// Returns:
//   - []string: A slice of UUIDs for the found/created tags.
//   - error: An error if any database operation fails.
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
// It uses ON CONFLICT DO NOTHING to avoid errors if the link already exists.
//
// Parameters:
//   - ctx: The request context.
//   - tx: The database transaction.
//   - ticketID: The UUID of the ticket.
//   - tagIDs: A slice of tag UUIDs to link.
//
// Returns:
//   - error: An error if the database insertion fails.
func (h *Handler) linkTagsToTicket(ctx context.Context, tx pgx.Tx, ticketID string, tagIDs []string) error {
	logger := slog.With("helper", "linkTagsToTicket", "ticketUUID", ticketID)
	if len(tagIDs) == 0 {
		return nil // Nothing to link
	}

	// Prepare bulk insert statement for ticket_tags
	// Using COPY FROM is generally more efficient for large numbers of rows,
	// but for a typical number of tags per ticket, individual inserts with
	// ON CONFLICT are simpler and often sufficient.
	sql := `INSERT INTO ticket_tags (ticket_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`
	batch := &pgx.Batch{}
	for _, tagID := range tagIDs {
		batch.Queue(sql, ticketID, tagID)
	}

	// Execute the batch insert
	results := tx.SendBatch(ctx, batch)
	// Check results for errors (important!)
	for i := 0; i < len(tagIDs); i++ {
		_, err := results.Exec()
		if err != nil {
			// Close the results explicitly on error as per pgx docs
			if closeErr := results.Close(); closeErr != nil {
				logger.ErrorContext(ctx, "Failed to close batch results after error", "error", closeErr)
			}
			logger.ErrorContext(ctx, "Failed to link tag in batch", "tagID", tagIDs[i], "error", err)
			return fmt.Errorf("failed to link tag ID %s: %w", tagIDs[i], err)
		}
	}

	// Close the results after successful execution
	if err := results.Close(); err != nil {
		logger.ErrorContext(ctx, "Failed to close batch results after success", "error", err)
		return fmt.Errorf("failed to finalize tag linking: %w", err)
	}

	logger.DebugContext(ctx, "Successfully linked tags to ticket")
	return nil
}
