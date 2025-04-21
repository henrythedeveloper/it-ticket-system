package ticket

import (
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/henrythedeveloper/bus-it-ticket/internal/models"
	"github.com/jackc/pgx/v5"
	"github.com/labstack/echo/v4"
)

// CreateTicket creates a new ticket
func (h Handler) CreateTicket(c echo.Context) error {
	var ticketCreate models.TicketCreate
	if err := c.Bind(&ticketCreate); err != nil {
		// Log binding error as Warn or Debug
		slog.Warn("Failed to bind request body for ticket creation", "error", err)
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}
	slog.Debug("Ticket creation request received", "endUserEmail", ticketCreate.EndUserEmail, "subject", ticketCreate.Subject)

	ctx := c.Request().Context()

	tx, err := h.db.Pool.Begin(ctx)
	if err != nil {
		// Log error before returning
		slog.Error("Failed to begin database transaction", "operation", "CreateTicket", "error", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to begin transaction")
	}
	// Use named return for error in defer to log rollback errors if commit fails, common pattern
	defer func() {
		if err != nil { // If any error occurred before commit or during commit
			if rbErr := tx.Rollback(ctx); rbErr != nil {
				slog.Error("Failed to rollback transaction", "operation", "CreateTicket", "rollbackError", rbErr, "originalError", err)
			}
		}
	}()

	// Create ticket in database
	var ticket models.Ticket
	// Ensure models.Ticket has ID (string) and TicketNumber (int32 or int64)
	err = tx.QueryRow(ctx, `
        INSERT INTO tickets (
            end_user_email, issue_type, urgency, subject, body,
            status, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, ticket_number, end_user_email, issue_type, urgency, subject, body,
                status, assigned_to_user_id, created_at, updated_at, closed_at,
                resolution_notes
        `,
		ticketCreate.EndUserEmail,
		ticketCreate.IssueType,
		ticketCreate.Urgency,
		ticketCreate.Subject,
		ticketCreate.Body,
		models.StatusUnassigned,
		time.Now(),
		time.Now(),
	).Scan(
		&ticket.ID,
		&ticket.TicketNumber,
		&ticket.EndUserEmail,
		&ticket.IssueType,
		&ticket.Urgency,
		&ticket.Subject,
		&ticket.Body,
		&ticket.Status,
		&ticket.AssignedToUserID,
		&ticket.CreatedAt,
		&ticket.UpdatedAt,
		&ticket.ClosedAt,
		&ticket.ResolutionNotes,
	)
	if err != nil {
		// Use slog, include relevant details (avoid logging full body/subject if sensitive/long)
		slog.Error("Failed to insert ticket into database",
			"endUserEmail", ticketCreate.EndUserEmail,
			"subject", ticketCreate.Subject, // Be mindful of logging sensitive data
			"error", err,
		)
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to create ticket")
	}
	// Log success with key identifiers
	slog.Debug("Ticket inserted into DB", "ticketUUID", ticket.ID, "ticketNumber", ticket.TicketNumber)

	// Add tags if provided
	if len(ticketCreate.Tags) > 0 {
		slog.Debug("Processing tags for new ticket", "ticketUUID", ticket.ID, "ticketNumber", ticket.TicketNumber, "tags", ticketCreate.Tags)
		for _, tagName := range ticketCreate.Tags {
			var tagID string 
			slog.Debug("Checking for tag", "tagName", tagName)
			err = tx.QueryRow(ctx,
				`SELECT id FROM tags WHERE name = $1`, tagName).Scan(&tagID)
			if err != nil {
				if errors.Is(err, pgx.ErrNoRows) {
					slog.Debug("Tag not found, creating...", "tagName", tagName)
					err = tx.QueryRow(ctx,
						`INSERT INTO tags (name, created_at)
                         VALUES ($1, $2)
                         RETURNING id`,
						tagName, time.Now()).Scan(&tagID)
					if err != nil {
						slog.Error("Failed to create new tag in database", "tagName", tagName, "error", err)
						return echo.NewHTTPError(http.StatusInternalServerError, fmt.Sprintf("failed to create tag: %s", tagName))
					}
					slog.Debug("Created new tag", "tagName", tagName, "tagID", tagID)
				} else {
					slog.Error("Failed to check/scan for existing tag", "tagName", tagName, "error", err)
					return echo.NewHTTPError(http.StatusInternalServerError, "failed to check tag")
				}
			} else {
				slog.Debug("Found existing tag", "tagName", tagName, "tagID", tagID)
			}

			// Add tag to ticket
			// ticket.ID is UUID (string), tagID is UUID (string)
			slog.Debug("Adding tag association", "tagName", tagName, "tagID", tagID, "ticketUUID", ticket.ID, "ticketNumber", ticket.TicketNumber)
			_, err = tx.Exec(ctx,
				`INSERT INTO ticket_tags (ticket_id, tag_id)
                 VALUES ($1, $2) ON CONFLICT DO NOTHING`,
				ticket.ID, tagID) // Pass UUID string for ticket_id
			if err != nil {
				slog.Error("Failed to add tag association to ticket_tags", "tagName", tagName, "tagID", tagID, "ticketUUID", ticket.ID, "error", err)
				return echo.NewHTTPError(http.StatusInternalServerError, "failed to add tag to ticket")
			}
		}
		slog.Debug("Finished processing tags", "ticketUUID", ticket.ID, "ticketNumber", ticket.TicketNumber)
	}

	// Commit transaction
	err = tx.Commit(ctx) // Assign error to the named return variable for the defer func
	if err != nil {
		slog.Error("Failed to commit transaction", "operation", "CreateTicket", "ticketUUID", ticket.ID, "error", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to commit transaction")
	}

	// Log final success, include both IDs
	slog.Info("Successfully created ticket", "ticketUUID", ticket.ID, "ticketNumber", ticket.TicketNumber)

	// Send confirmation email 
	go func(t models.Ticket) {
		ticketNumStr := fmt.Sprintf("%d", t.TicketNumber) // Format ticket number for email display
		err := h.emailService.SendTicketConfirmation(
			t.EndUserEmail,
			ticketNumStr, // Pass the user-friendly number string
			t.Subject,
		)
		if err != nil {
			slog.Error("Failed to send ticket confirmation email",
				"ticketUUID", t.ID,
				"ticketNumber", t.TicketNumber,
				"recipient", t.EndUserEmail,
				"error", err,
			)
		} else {
			slog.Info("Sent ticket confirmation email",
				"ticketUUID", t.ID,
				"ticketNumber", t.TicketNumber,
				"recipient", t.EndUserEmail,
			)
		}
	}(ticket)

	return c.JSON(http.StatusCreated, models.APIResponse{
		Success: true,
		Message: "Ticket created successfully",
		Data:    ticket, // Contains both ID (UUID) and TicketNumber (int)
	})
}
