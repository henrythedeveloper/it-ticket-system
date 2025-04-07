package ticket

import (
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/henrythedeveloper/bus-it-ticket/internal/models"
	"github.com/jackc/pgx/v5"
	"github.com/labstack/echo/v4"
)

// CreateTicket creates a new ticket
func (h *Handler) CreateTicket(c echo.Context) error {
	var ticketCreate models.TicketCreate
	if err := c.Bind(&ticketCreate); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}

	ctx := c.Request().Context()
	tx, err := h.db.Pool.Begin(ctx)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to begin transaction")
	}
	defer tx.Rollback(ctx) // Rollback if not committed

	// Create ticket in database
	var ticket models.Ticket
	err = tx.QueryRow(ctx, `
		INSERT INTO tickets (
			end_user_email, issue_type, urgency, subject, body, 
			status, created_at, updated_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id, end_user_email, issue_type, urgency, subject, body, 
			status, assigned_to_user_id, created_at, updated_at, closed_at, resolution_notes
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
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to create ticket")
	}

	// Add tags if provided
	if len(ticketCreate.Tags) > 0 {
		for _, tagName := range ticketCreate.Tags {
			// Get tag ID or create if it doesn't exist
			var tagID string
			err := tx.QueryRow(ctx, `
				SELECT id FROM tags WHERE name = $1
			`, tagName).Scan(&tagID)
			if err != nil {
				if errors.Is(err, pgx.ErrNoRows) {
					// Tag doesn't exist, create it
					err = tx.QueryRow(ctx, `
						INSERT INTO tags (name, created_at)
						VALUES ($1, $2)
						RETURNING id
					`, tagName, time.Now()).Scan(&tagID)
					if err != nil {
						return echo.NewHTTPError(http.StatusInternalServerError, "failed to create tag")
					}
				} else {
					return echo.NewHTTPError(http.StatusInternalServerError, "failed to check tag")
				}
			}

			// Add tag to ticket
			_, err = tx.Exec(ctx, `
				INSERT INTO ticket_tags (ticket_id, tag_id)
				VALUES ($1, $2)
			`, ticket.ID, tagID)
			if err != nil {
				return echo.NewHTTPError(http.StatusInternalServerError, "failed to add tag to ticket")
			}
		}
	}

	// Commit transaction
	if err := tx.Commit(ctx); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to commit transaction")
	}

	// Send confirmation email
	go func() {
		if err := h.emailService.SendTicketConfirmation(
			ticket.EndUserEmail,
			ticket.ID,
			ticket.Subject,
		); err != nil {
			// Log error but don't fail request
			fmt.Printf("Failed to send ticket confirmation email: %v\n", err)
		}
	}()

	return c.JSON(http.StatusCreated, models.APIResponse{
		Success: true,
		Message: "Ticket created successfully",
		Data:    ticket,
	})
}
