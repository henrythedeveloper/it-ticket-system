package ticket

import (
	"errors"
	"fmt"
	"net/http"
	"time"
	"log"

	"github.com/jackc/pgx/v5"
	"github.com/labstack/echo/v4"
	"github.com/henrythedeveloper/bus-it-ticket/internal/api/middleware/auth"
	"github.com/henrythedeveloper/bus-it-ticket/internal/models"
)

// UpdateTicket updates a ticket's status and assignment
func (h *Handler) UpdateTicket(c echo.Context) error {
	ticketID := c.Param("id")
	if ticketID == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "missing ticket ID")
	}

	var ticketUpdate models.TicketStatusUpdate
	if err := c.Bind(&ticketUpdate); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}

	ctx := c.Request().Context()
	
	// Get user ID and role from context
	userID, err := auth.GetUserIDFromContext(c)
	if err != nil {
		return err
	}
	userRole, err := auth.GetUserRoleFromContext(c)
	if err != nil {
		return err
	}

	// Verify ticket exists and user has access
	var currentStatus models.TicketStatus
	var currentAssignedTo *string
	err = h.db.Pool.QueryRow(ctx, `
		SELECT status, assigned_to_user_id
		FROM tickets
		WHERE id = $1
	`, ticketID).Scan(&currentStatus, &currentAssignedTo)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return echo.NewHTTPError(http.StatusNotFound, "ticket not found")
		}
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to get ticket")
	}

	// Staff users can only update tickets assigned to them unless they're admins
	if userRole != models.RoleAdmin && currentAssignedTo != nil && *currentAssignedTo != userID {
		return echo.NewHTTPError(http.StatusForbidden, "not authorized to update this ticket")
	}

	// Begin transaction
	tx, err := h.db.Pool.Begin(ctx)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to begin transaction")
	}
	defer tx.Rollback(ctx) // Rollback if not committed

	// Build update query
	query := `
		UPDATE tickets
		SET status = $1, assigned_to_user_id = $2, updated_at = $3
	`
	args := []interface{}{
		ticketUpdate.Status,
		ticketUpdate.AssignedToUserID,
		time.Now(),
	}

	// If status is changing to Closed, set closed_at and resolution_notes
	if ticketUpdate.Status == models.StatusClosed && currentStatus != models.StatusClosed {
		query += `, closed_at = $4, resolution_notes = $5`
		args = append(args, time.Now(), ticketUpdate.ResolutionNotes)
	}

	query += fmt.Sprintf(" WHERE id = $%d", len(args)+1)
	args = append(args, ticketID)

	query += ` RETURNING id`
	
	 // --- Add Logging Here ---
	 log.Printf("DEBUG: Attempting SQL Update Query: %s", query)
	 log.Printf("DEBUG: With Arguments: %v", args)
	 // --- End Logging ---

	// Execute update
	var updatedTicketID string
	err = tx.QueryRow(ctx, query, args...).Scan(&updatedTicketID)
	if err != nil {
		// --- Add Error Logging Here ---
        log.Printf("ERROR: SQL Update Failed: %v", err) // Log the actual DB error
        // --- End Error Logging ---
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to update ticket")
	}
	
	// Add ticket update comment
	var comment string
	if ticketUpdate.Status == models.StatusClosed {
		comment = fmt.Sprintf("Ticket status changed to Closed. Resolution: %s", *ticketUpdate.ResolutionNotes)
	} else if currentStatus != ticketUpdate.Status {
		comment = fmt.Sprintf("Ticket status changed from %s to %s", currentStatus, ticketUpdate.Status)
	}
	
	// If assignment changed, add that to the comment
	if (currentAssignedTo == nil && ticketUpdate.AssignedToUserID != nil) ||
	   (currentAssignedTo != nil && ticketUpdate.AssignedToUserID == nil) ||
	   (currentAssignedTo != nil && ticketUpdate.AssignedToUserID != nil && *currentAssignedTo != *ticketUpdate.AssignedToUserID) {
		
		var newAssigneeName string
		if ticketUpdate.AssignedToUserID != nil {
			err = tx.QueryRow(ctx, "SELECT name FROM users WHERE id = $1", *ticketUpdate.AssignedToUserID).Scan(&newAssigneeName)
			if err != nil {
				// Don't fail the whole transaction for this
				newAssigneeName = "another agent"
			}
			
			if comment != "" {
				comment += ". "
			}
			comment += fmt.Sprintf("Ticket assigned to %s", newAssigneeName)
		} else {
			if comment != "" {
				comment += ". "
			}
			comment += "Ticket unassigned"
		}
	}
	
	// If we have a comment, save it
	if comment != "" {
		_, err = tx.Exec(ctx, `
			INSERT INTO ticket_updates (ticket_id, user_id, comment, is_internal_note, created_at)
			VALUES ($1, $2, $3, $4, $5)
		`, ticketID, userID, comment, true, time.Now())
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "failed to add ticket update")
		}
	}
	
	// If ticket is being closed, send email notification
	if ticketUpdate.Status == models.StatusClosed && currentStatus != models.StatusClosed {
		var endUserEmail, subject string
		err = tx.QueryRow(ctx, "SELECT end_user_email, subject FROM tickets WHERE id = $1", ticketID).Scan(&endUserEmail, &subject)
		if err == nil {
			// Send email notification (don't fail transaction if this fails)
			go func() {
				resolution := "Issue resolved"
				if ticketUpdate.ResolutionNotes != nil {
					resolution = *ticketUpdate.ResolutionNotes
				}
				if err := h.emailService.SendTicketClosure(endUserEmail, ticketID, subject, resolution); err != nil {
					fmt.Printf("Failed to send ticket closure email: %v\n", err)
				}
			}()
		}
	}
	
	// Commit transaction
	if err := tx.Commit(ctx); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to commit transaction")
	}
	
	// Fetch the updated ticket to return
	return h.GetTicketByID(c)
}