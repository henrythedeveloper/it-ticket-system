// backend/internal/api/handlers/ticket/update.go
// ==========================================================================
// Handler function for updating ticket properties like status and assignment.
// Includes permission checks, transaction management, and email notifications.
// ==========================================================================

package ticket

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/henrythedeveloper/it-ticket-system/internal/api/middleware/auth" // Auth middleware helpers
	"github.com/henrythedeveloper/it-ticket-system/internal/models"              // Data models
	"github.com/jackc/pgx/v5"
	"github.com/labstack/echo/v4"
)

// --- Handler Function ---

// UpdateTicket handles requests to modify a ticket's status, assignee, or resolution notes.
// It performs authorization checks, updates the database within a transaction,
// logs changes automatically as system comments, and triggers email notifications.
//
// Path Parameters:
//   - id: The UUID of the ticket to update.
//
// Request Body:
//   - Expects JSON matching models.TicketStatusUpdate.
//
// Returns:
//   - JSON response with the fully updated ticket details or an error response.
func (h *Handler) UpdateTicket(c echo.Context) (err error) { // Use named return for defer rollback check
	ctx := c.Request().Context()
	ticketID := c.Param("id")
	logger := slog.With("handler", "UpdateTicket", "ticketUUID", ticketID)

	// --- 1. Input Validation & Binding ---
	if ticketID == "" {
		logger.WarnContext(ctx, "Missing ticket ID in request path")
		return echo.NewHTTPError(http.StatusBadRequest, "Missing ticket ID.")
	}

	var ticketUpdate models.TicketStatusUpdate
	if err = c.Bind(&ticketUpdate); err != nil {
		logger.WarnContext(ctx, "Failed to bind request body", "error", err)
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid request body: "+err.Error())
	}
	// TODO: Add validation for ticketUpdate fields (e.g., valid status, resolution notes required if closing)
	if ticketUpdate.Status == models.StatusClosed && (ticketUpdate.ResolutionNotes == nil || strings.TrimSpace(*ticketUpdate.ResolutionNotes) == "") {
		logger.WarnContext(ctx, "Attempted to close ticket without resolution notes")
		return echo.NewHTTPError(http.StatusBadRequest, "Resolution notes are required to close the ticket.")
	}

	// --- 2. Get User Context & Permissions ---
	updaterUserID, err := auth.GetUserIDFromContext(c)
	if err != nil {
		return err // Error logged in helper
	}
	updaterRole, err := auth.GetUserRoleFromContext(c)
	if err != nil {
		return err // Error logged in helper
	}

	// Fetch updater's name for logging/comments (best effort)
	updaterName, nameErr := h.getUserName(ctx, updaterUserID)
	if nameErr != nil {
		logger.WarnContext(ctx, "Failed to fetch updater's name", "updaterUserID", updaterUserID, "error", nameErr)
		updaterName = "System" // Fallback name
	}
	logger.DebugContext(ctx, "Update request initiated", "updaterUserID", updaterUserID, "updaterName", updaterName, "updaterRole", updaterRole)

	// --- 3. Fetch Current Ticket State & Authorization Check ---
	currentTicketState, err := h.getCurrentTicketStateForUpdate(ctx, ticketID)
	if err != nil {
		// Error logged in helper
		if err.Error() == "ticket not found" { // Check for specific error string from helper
			return echo.NewHTTPError(http.StatusNotFound, "Ticket not found.")
		}
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to retrieve current ticket state.")
	}

	// Authorization: Staff can only update tickets assigned to them (unless admin)
	if updaterRole != models.RoleAdmin && currentTicketState.AssignedToUserID != nil && *currentTicketState.AssignedToUserID != updaterUserID {
		logger.WarnContext(ctx, "Unauthorized attempt to update ticket", "assignedUserID", *currentTicketState.AssignedToUserID)
		return echo.NewHTTPError(http.StatusForbidden, "Not authorized to update this ticket.")
	}

	// --- 4. Database Transaction ---
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

	// --- 5. Build and Execute Update Query ---
	// Use helper to build query and args based on changes
	updateQuery, updateArgs, err := h.buildTicketUpdateQuery(ticketID, &ticketUpdate, currentTicketState)
	if err != nil {
		logger.ErrorContext(ctx, "Failed to build update query", "error", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "Internal error preparing update.")
	}

	logger.DebugContext(ctx, "Executing ticket update query", "query", updateQuery, "argsCount", len(updateArgs))

	// Execute the update and retrieve necessary fields for notifications/logging
	var updatedTicketID, endUserEmail, subject string
	var ticketNumber int32
	err = tx.QueryRow(ctx, updateQuery, updateArgs...).Scan(
		&updatedTicketID, &endUserEmail, &subject, &ticketNumber,
	)
	if err != nil {
		logger.ErrorContext(ctx, "SQL update execution failed", "error", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "Database error: failed to update ticket.")
	}
	logger.DebugContext(ctx, "Ticket record updated successfully", "ticketNumber", ticketNumber)

	// --- 6. Log Changes as System Comment ---
	// Compare current state with update request to generate comment
	changeDesc := h.generateChangeDescription(currentTicketState, &ticketUpdate, updaterName)
	if changeDesc != "" {
		logger.DebugContext(ctx, "Adding automatic system update comment", "changeDescription", changeDesc)
		// Insert the system comment within the same transaction
		commentErr := h.addSystemComment(ctx, tx, ticketID, updaterUserID, changeDesc)
		if commentErr != nil {
			// Log the error but don't necessarily fail the whole update
			// The main ticket update succeeded.
			logger.ErrorContext(ctx, "Failed to add automatic system comment", "error", commentErr)
			// Set the main 'err' variable so the transaction rolls back if we decide this is critical
			// err = commentErr // Uncomment if comment failure should rollback ticket update
		}
	}

	// --- 7. Commit Transaction ---
	// Only commit if no critical error occurred (check named return 'err')
	if err == nil {
		err = tx.Commit(ctx)
		if err != nil {
			logger.ErrorContext(ctx, "Failed to commit transaction", "error", err)
			return echo.NewHTTPError(http.StatusInternalServerError, "Database error: failed to save changes.")
		}
	} else {
		// If err is set (e.g., from comment insertion failure if deemed critical),
		// the defer func will handle rollback. Just return the appropriate HTTP error.
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to complete ticket update.")
	}

	// --- 8. Trigger Email Notifications (Asynchronously) ---
	h.triggerUpdateNotifications(currentTicketState, &ticketUpdate, endUserEmail, subject, ticketNumber)

	// --- 9. Return Updated Ticket Details ---
	logger.InfoContext(ctx, "Ticket updated successfully", "ticketNumber", ticketNumber, "newStatus", ticketUpdate.Status)
	// Fetch and return the full, updated ticket details
	return h.GetTicketByID(c) // Reuse the GetTicketByID handler
}

// --- Helper Functions for UpdateTicket ---

// ticketState holds the minimal current state needed for comparison and authorization.
type ticketState struct {
	Status           models.TicketStatus
	AssignedToUserID *string
	EndUserEmail     string
	Subject          string
	TicketNumber     int32
}

// getCurrentTicketStateForUpdate fetches essential current ticket data before an update.
func (h *Handler) getCurrentTicketStateForUpdate(ctx context.Context, ticketID string) (*ticketState, error) {
	logger := slog.With("helper", "getCurrentTicketStateForUpdate", "ticketUUID", ticketID)
	var state ticketState
	err := h.db.Pool.QueryRow(ctx, `
        SELECT status, assigned_to_user_id, end_user_email, subject, ticket_number
        FROM tickets WHERE id = $1
    `, ticketID).Scan(
		&state.Status, &state.AssignedToUserID, &state.EndUserEmail, &state.Subject, &state.TicketNumber,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			logger.WarnContext(ctx, "Ticket not found")
			return nil, errors.New("ticket not found")
		}
		logger.ErrorContext(ctx, "Failed to query current ticket state", "error", err)
		return nil, fmt.Errorf("database error querying ticket state: %w", err)
	}
	return &state, nil
}

// getUserName fetches a user's name by their ID.
func (h *Handler) getUserName(ctx context.Context, userID string) (string, error) {
	var name string
	err := h.db.Pool.QueryRow(ctx, `SELECT name FROM users WHERE id = $1`, userID).Scan(&name)
	if err != nil {
		// Don't log ErrNoRows as error here, handle it in the caller
		if errors.Is(err, pgx.ErrNoRows) {
			return "", fmt.Errorf("user not found: %s", userID)
		}
		return "", fmt.Errorf("database error fetching user name: %w", err)
	}
	return name, nil
}

// buildTicketUpdateQuery constructs the SQL UPDATE statement and arguments dynamically.
func (h *Handler) buildTicketUpdateQuery(ticketID string, update *models.TicketStatusUpdate, currentState *ticketState) (string, []interface{}, error) {
	query := strings.Builder{}
	query.WriteString("UPDATE tickets SET updated_at = $1")
	args := []interface{}{time.Now()} // $1 is always updated_at
	paramCount := 1

	// --- Status Update ---
	if update.Status != currentState.Status {
		paramCount++
		query.WriteString(fmt.Sprintf(", status = $%d", paramCount))
		args = append(args, update.Status)

		// Handle setting/clearing closed_at timestamp
		if update.Status == models.StatusClosed {
			paramCount++
			query.WriteString(fmt.Sprintf(", closed_at = $%d", paramCount))
			args = append(args, time.Now())
		} else if currentState.Status == models.StatusClosed {
			// If reopening, clear closed_at and potentially resolution notes
			query.WriteString(", closed_at = NULL")
			// Decide if reopening should clear resolution notes:
			// query.WriteString(", resolution_notes = NULL")
		}
	}

	// --- Assignee Update ---
	// Check if assignment actually changed
	assigneeChanged := (currentState.AssignedToUserID == nil && update.AssignedToUserID != nil && *update.AssignedToUserID != "") || // Unassigned -> Assigned
		(currentState.AssignedToUserID != nil && (update.AssignedToUserID == nil || *update.AssignedToUserID == "")) || // Assigned -> Unassigned
		(currentState.AssignedToUserID != nil && update.AssignedToUserID != nil && *update.AssignedToUserID != "" && *currentState.AssignedToUserID != *update.AssignedToUserID) // Assigned -> Different User

	if assigneeChanged {
		paramCount++
		query.WriteString(fmt.Sprintf(", assigned_to_user_id = $%d", paramCount))
		if update.AssignedToUserID != nil && *update.AssignedToUserID != "" {
			args = append(args, *update.AssignedToUserID) // Assign to new user
		} else {
			args = append(args, nil) // Unassign (set to NULL)
		}
	}

	// --- Resolution Notes Update (only if closing) ---
	if update.Status == models.StatusClosed && update.ResolutionNotes != nil {
		paramCount++
		query.WriteString(fmt.Sprintf(", resolution_notes = $%d", paramCount))
		args = append(args, *update.ResolutionNotes)
	}

	// --- WHERE Clause ---
	paramCount++
	query.WriteString(fmt.Sprintf(" WHERE id = $%d", paramCount))
	args = append(args, ticketID)

	// --- RETURNING Clause ---
	query.WriteString(" RETURNING id, end_user_email, subject, ticket_number") // Fields needed for notifications/logging

	return query.String(), args, nil
}

// generateChangeDescription creates a human-readable string describing the changes made.
func (h *Handler) generateChangeDescription(currentState *ticketState, update *models.TicketStatusUpdate, updaterName string) string {
	changes := []string{}

	// Status change
	if update.Status != currentState.Status {
		changes = append(changes, fmt.Sprintf("Status changed from '%s' to '%s'", currentState.Status, update.Status))
	}

	// Assignee change
	currentAssignee := "<unassigned>"
	if currentState.AssignedToUserID != nil {
		// Fetch name (best effort, might fail)
		name, err := h.getUserName(context.Background(), *currentState.AssignedToUserID) // Use background context for simplicity here
		if err == nil {
			currentAssignee = name
		} else {
			currentAssignee = *currentState.AssignedToUserID // Fallback to ID
		}
	}

	newAssignee := "<unassigned>"
	if update.AssignedToUserID != nil && *update.AssignedToUserID != "" {
		name, err := h.getUserName(context.Background(), *update.AssignedToUserID)
		if err == nil {
			newAssignee = name
		} else {
			newAssignee = *update.AssignedToUserID // Fallback to ID
		}
	}

	if currentAssignee != newAssignee {
		changes = append(changes, fmt.Sprintf("Assignment changed from '%s' to '%s'", currentAssignee, newAssignee))
	}

	if len(changes) == 0 {
		return "" // No changes detected
	}

	return fmt.Sprintf("%s by %s.", strings.Join(changes, " and "), updaterName)
}

// addSystemComment inserts a system-generated comment into the ticket_updates table.
func (h *Handler) addSystemComment(ctx context.Context, tx pgx.Tx, ticketID, userID, comment string) error {
	logger := slog.With("helper", "addSystemComment", "ticketUUID", ticketID)
	_, err := tx.Exec(ctx, `
        INSERT INTO ticket_updates (ticket_id, user_id, comment, is_internal_note, created_at)
        VALUES ($1, $2, $3, $4, $5)
    `, ticketID, userID, comment, true, time.Now()) // Mark system comments as internal

	if err != nil {
		logger.ErrorContext(ctx, "Failed to insert system comment", "error", err)
		return fmt.Errorf("database error adding system comment: %w", err)
	}
	return nil
}

// triggerUpdateNotifications sends relevant emails based on the changes made.
func (h *Handler) triggerUpdateNotifications(currentState *ticketState, update *models.TicketStatusUpdate, recipientEmail, subject string, ticketNumber int32) {
	logger := slog.With("operation", "triggerUpdateNotifications", "ticketNumber", ticketNumber)
	ticketNumStr := fmt.Sprintf("%d", ticketNumber)

	// --- Closure Notification ---
	if update.Status == models.StatusClosed && currentState.Status != models.StatusClosed {
		resolution := "Issue resolved." // Default
		if update.ResolutionNotes != nil {
			resolution = *update.ResolutionNotes
		}
		go func() {
			bgCtx := context.Background()
			if err := h.emailService.SendTicketClosure(recipientEmail, ticketNumStr, subject, resolution); err != nil {
				logger.ErrorContext(bgCtx, "Failed to send ticket closure email", "recipient", recipientEmail, "error", err)
			} else {
				logger.InfoContext(bgCtx, "Sent ticket closure email", "recipient", recipientEmail)
			}
		}()
	}

	// --- In Progress Notification ---
	if update.Status == models.StatusInProgress && currentState.Status != models.StatusInProgress {
		assignedStaffName := "IT Staff" // Default
		if update.AssignedToUserID != nil && *update.AssignedToUserID != "" {
			// Fetch name (best effort) - Use background context for goroutine
			name, err := h.getUserName(context.Background(), *update.AssignedToUserID)
			if err == nil {
				assignedStaffName = name
			} else {
				logger.Warn("Failed to get assignee name for 'In Progress' email", "assigneeID", *update.AssignedToUserID, "error", err)
			}
		}
		go func() {
			bgCtx := context.Background()
			if err := h.emailService.SendTicketInProgress(recipientEmail, ticketNumStr, subject, assignedStaffName); err != nil {
				logger.ErrorContext(bgCtx, "Failed to send ticket 'In Progress' email", "recipient", recipientEmail, "error", err)
			} else {
				logger.InfoContext(bgCtx, "Sent ticket 'In Progress' email", "recipient", recipientEmail)
			}
		}()
	}

	// --- Assignment Notification (If assignee changed to a specific user) ---
	assigneeChangedToUser := (currentState.AssignedToUserID == nil && update.AssignedToUserID != nil && *update.AssignedToUserID != "") || // Unassigned -> Assigned
		(currentState.AssignedToUserID != nil && update.AssignedToUserID != nil && *update.AssignedToUserID != "" && *currentState.AssignedToUserID != *update.AssignedToUserID) // Assigned -> Different User

	if assigneeChangedToUser {
		// Fetch new assignee's email
		var assigneeEmail string
		// Use background context for simplicity in goroutine setup
		err := h.db.Pool.QueryRow(context.Background(), `SELECT email FROM users WHERE id = $1`, *update.AssignedToUserID).Scan(&assigneeEmail)
		if err == nil {
			go func() {
				bgCtx := context.Background()
				// TODO: Implement SendTicketAssignment email in email service if needed
				// if err := h.emailService.SendTicketAssignment(assigneeEmail, ticketNumStr, subject); err != nil {
				//     logger.ErrorContext(bgCtx, "Failed to send ticket assignment email", "recipient", assigneeEmail, "error", err)
				// } else {
				//     logger.InfoContext(bgCtx, "Sent ticket assignment email", "recipient", assigneeEmail)
				// }
				logger.InfoContext(bgCtx, "Placeholder: Would send assignment email", "recipient", assigneeEmail)
			}()
		} else {
			logger.Error("Failed to fetch assignee email for assignment notification", "assigneeID", *update.AssignedToUserID, "error", err)
		}
	}
}
