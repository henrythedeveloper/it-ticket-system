package ticket

import (
	"errors"
	"fmt"
	"log"
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
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}

	ctx := c.Request().Context()

	tx, err := h.db.Pool.Begin(ctx)
	if err != nil {
		log.Printf("ERROR: Failed to begin transaction: %v", err) // Added log
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
		log.Printf("ERROR: Failed to insert ticket: %v", err) // Added log
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to create ticket")
	}

	// Add tags if provided
	if len(ticketCreate.Tags) > 0 {
		// Use the provided tag names
		for _, tagName := range ticketCreate.Tags {
			// Get tag ID or create if it doesn't exist
			var tagID string
			log.Printf("DEBUG: Checking for tag with name: %s", tagName) // Added log
			err := tx.QueryRow(ctx,
				`SELECT id FROM tags WHERE name = $1`, tagName).Scan(&tagID)
			if err != nil {
				if errors.Is(err, pgx.ErrNoRows) {
					// Tag doesn't exist, create it
					log.Printf("DEBUG: Tag '%s' not found, creating...", tagName) // Added log
					err = tx.QueryRow(ctx,
						`INSERT INTO tags (name, created_at)
                         VALUES ($1, $2)
                         RETURNING id`,
						tagName, time.Now()).Scan(&tagID)
					if err != nil {
						// Log the specific error during tag creation
						log.Printf("ERROR: Failed to create tag '%s': %v", tagName, err) // Added log
						return echo.NewHTTPError(http.StatusInternalServerError, fmt.Sprintf("failed to create tag: %s", tagName))
					}
					log.Printf("DEBUG: Created tag '%s' with ID: %s", tagName, tagID) // Added log
				} else {
					// *** Log the specific error before returning generic message ***
					log.Printf("ERROR: Failed to check/scan tag '%s': %v", tagName, err)            // <<< Added detailed log
					return echo.NewHTTPError(http.StatusInternalServerError, "failed to check tag") // Keep generic error for client
				}
			} else {
				log.Printf("DEBUG: Found tag '%s' with ID: %s", tagName, tagID) // Added log
			}

			// Add tag to ticket
			log.Printf("DEBUG: Adding tag %s (ID: %s) to ticket %d", tagName, tagID, ticket.ID) // Added log
			_, err = tx.Exec(ctx,
				`INSERT INTO ticket_tags (ticket_id, tag_id)
                 VALUES ($1, $2) ON CONFLICT DO NOTHING`, // Added ON CONFLICT
				ticket.ID, tagID) // ticket.ID is int, tagID is string (scanned from UUID)
			if err != nil {
				// Log the specific error during tag association
				log.Printf("ERROR: Failed to add tag '%s' to ticket %d: %v", tagName, ticket.ID, err) // Added log
				return echo.NewHTTPError(http.StatusInternalServerError, "failed to add tag to ticket")
			}
		}
	}

	// Commit transaction
	if err := tx.Commit(ctx); err != nil {
		log.Printf("ERROR: Failed to commit transaction: %v", err) // Added log
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to commit transaction")
	}

	log.Printf("INFO: Successfully created ticket %d", ticket.ID) // Added log

	// Send confirmation email
	go func() {
		// Convert ticket.ID (int32) to string for the email function if necessary
		ticketIDStr := fmt.Sprintf("%d", ticket.ID)
		if err := h.emailService.SendTicketConfirmation(
			ticket.EndUserEmail,
			ticketIDStr, // Pass the string representation
			ticket.Subject,
		); err != nil {
			// Log error but don't fail request
			log.Printf("ERROR: Failed to send ticket confirmation email for ticket %s: %v\n", ticketIDStr, err)
		} else {
			log.Printf("INFO: Sent ticket confirmation email for ticket %s to %s", ticketIDStr, ticket.EndUserEmail)
		}
	}()

	return c.JSON(http.StatusCreated, models.APIResponse{
		Success: true,
		Message: "Ticket created successfully",
		Data:    ticket,
	})
}
