package ticket

import (
	"errors"
	"fmt"
	"log/slog" // Import slog
	"net/http"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/labstack/echo/v4"
	"github.com/henrythedeveloper/bus-it-ticket/internal/api/middleware/auth"
	"github.com/henrythedeveloper/bus-it-ticket/internal/models"
)

// UpdateTicket updates a ticket's status and assignment
func (h *Handler) UpdateTicket(c echo.Context) error {
	ticketID := c.Param("id")
	slog.Debug("Attempting to update ticket", "ticketID", ticketID)

	if ticketID == "" {
		slog.Warn("UpdateTicket called with missing ticket ID")
		return echo.NewHTTPError(http.StatusBadRequest, "missing ticket ID")
	}

	var ticketUpdate models.TicketStatusUpdate
	if err := c.Bind(&ticketUpdate); err != nil {
		slog.Warn("Failed to bind request body for ticket update", "ticketID", ticketID, "error", err)
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}

	ctx := c.Request().Context()

	// Get user ID and role from context
	userID, err := auth.GetUserIDFromContext(c)
	if err != nil {
		// If it returns a standard error, log it here:
		slog.Error("Failed to get user ID from context", "error", err)
		return err
	}
	userRole, err := auth.GetUserRoleFromContext(c)
	if err != nil {
		slog.Error("Failed to get user role from context", "error", err)
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
			slog.Warn("Ticket not found for update", "ticketID", ticketID)
			return echo.NewHTTPError(http.StatusNotFound, "ticket not found")
		}
		// Log the unexpected database error before returning a generic 500
		slog.Error("Failed to query ticket during update check", "ticketID", ticketID, "error", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to get ticket")
	}

	// Staff users can only update tickets assigned to them unless they're admins
	if userRole != models.RoleAdmin && currentAssignedTo != nil && *currentAssignedTo != userID {
		slog.Warn("Unauthorized attempt to update ticket", "ticketID", ticketID, "requestingUserID", userID, "assignedUserID", *currentAssignedTo, "userRole", userRole)
		return echo.NewHTTPError(http.StatusForbidden, "not authorized to update this ticket")
	}

	// Begin transaction
	tx, err := h.db.Pool.Begin(ctx)
	if err != nil {
		slog.Error("Failed to begin database transaction", "operation", "UpdateTicket", "ticketID", ticketID, "error", err)
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
	paramCount := 3 // Start counting params from here

	// If status is changing to Closed, set closed_at and resolution_notes
	if ticketUpdate.Status == models.StatusClosed && currentStatus != models.StatusClosed {
		query += `, closed_at = $4, resolution_notes = $5`
		paramCount += 2
		args = append(args, time.Now(), ticketUpdate.ResolutionNotes)
	}

	paramCount++
	query += fmt.Sprintf(" WHERE id = $%d", paramCount)
	args = append(args, ticketID)

	query += ` RETURNING id` // Keep RETURNING id for confirmation

	// --- Use Debug Logging for SQL ---
	slog.Debug("Executing SQL update query", "query", query, "args", args)
	// --- End Logging ---

	// Execute update
	var updatedTicketID string
	err = tx.QueryRow(ctx, query, args...).Scan(&updatedTicketID)
	if err != nil {
		// --- Log Actual DB Error ---
		slog.Error("SQL update failed for ticket", "ticketID", ticketID, "error", err)
		// --- End Error Logging ---
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to update ticket")
	}
	slog.Debug("Ticket update successful in DB", "ticketID", updatedTicketID)

	// --- Add ticket update comment logic (unchanged, but ensure any errors inside use slog) ---
	var comment string
	// ... (comment generation logic) ...

	if comment != "" {
		_, err = tx.Exec(ctx, `
            INSERT INTO ticket_updates (ticket_id, user_id, comment, is_internal_note, created_at)
            VALUES ($1, $2, $3, $4, $5)
        `, ticketID, userID, comment, true, time.Now())
		if err != nil {
			// Rollback is handled by defer, but log the specific error
			slog.Error("Failed to add ticket update comment during ticket status update", "ticketID", ticketID, "userID", userID, "error", err)
			return echo.NewHTTPError(http.StatusInternalServerError, "failed to add ticket update")
		}
		slog.Debug("Added automatic ticket update comment", "ticketID", ticketID, "userID", userID)
	}

	// --- Email Notification Logic ---
	if ticketUpdate.Status == models.StatusClosed && currentStatus != models.StatusClosed {
		var endUserEmail, subject string
		// Use QueryRow here, not Exec, as we need Scan
		err = tx.QueryRow(ctx, "SELECT end_user_email, subject FROM tickets WHERE id = $1", ticketID).Scan(&endUserEmail, &subject)
		if err == nil {
			go func() {
				resolution := "Issue resolved"
				if ticketUpdate.ResolutionNotes != nil {
					resolution = *ticketUpdate.ResolutionNotes
				}
				// The emailService functions should internally use slog now
				if err := h.emailService.SendTicketClosure(endUserEmail, ticketID, subject, resolution); err != nil {
					// Error is already logged within emailService, no need to print here unless adding context
					slog.Warn("Goroutine: Sending ticket closure email failed", "ticketID", ticketID, "recipient", endUserEmail)
				}
			}()
		} else {
			// Log error if fetching email/subject fails, but don't fail the transaction
			slog.Error("Failed to fetch email/subject for closure notification", "ticketID", ticketID, "error", err)
		}
	}

	// Commit transaction
	if err := tx.Commit(ctx); err != nil {
		slog.Error("Failed to commit transaction", "operation", "UpdateTicket", "ticketID", ticketID, "error", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to commit transaction")
	}

	slog.Info("Ticket updated successfully", "ticketID", ticketID, "newStatus", ticketUpdate.Status, "updatedByUserID", userID)

	// Fetch the updated ticket to return
	return h.GetTicketByID(c) // GetTicketByID will fetch the full updated state
}