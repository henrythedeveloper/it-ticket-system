package ticket

import (
	"errors"
	"fmt"
	"log/slog" 
	"net/http"
	"strings" 
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/labstack/echo/v4"
	"github.com/henrythedeveloper/bus-it-ticket/internal/api/middleware/auth" 
	"github.com/henrythedeveloper/bus-it-ticket/internal/models"             
)

// UpdateTicket updates a ticket's status, assignment, and resolution notes.
// It handles permission checks, sends email notifications, and logs changes automatically.
func (h *Handler) UpdateTicket(c echo.Context) (err error) { // Use named return for defer err check

	// --- Section: Parameter Handling & Input Validation ---

	// Get ticket UUID from URL parameter
	ticketID := c.Param("id")
	slog.Debug("Attempting to update ticket", "ticketUUID", ticketID)
	if ticketID == "" {
		slog.Warn("UpdateTicket called with missing ticket ID")
		// Return immediately if ID is missing
		return echo.NewHTTPError(http.StatusBadRequest, "missing ticket ID")
	}

	// Bind the JSON request body to the update struct
	var ticketUpdate models.TicketStatusUpdate
	// Use named return assignment for error checking in defer
	if err = c.Bind(&ticketUpdate); err != nil {
		slog.Warn("Failed to bind request body for ticket update", "ticketUUID", ticketID, "error", err)
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body: "+err.Error())
	}
	// TODO: Add validation for the ticketUpdate struct fields if needed

	// --- Section: Context & Authentication ---

	ctx := c.Request().Context()

	// Get current user's ID and Role from JWT token (set by middleware)
	userID, err := auth.GetUserIDFromContext(c) // User *making* the change
	if err != nil {
		// Error should be logged within GetUserIDFromContext or middleware if possible
		// Return the error directly (likely 401 or 500)
		return err
	}
	userRole, err := auth.GetUserRoleFromContext(c)
	if err != nil {
		return err
	}

	// --- Fetch Updater's Name (Needed for automatic comments) ---
	var updaterName string
	nameErr := h.db.Pool.QueryRow(ctx, `SELECT name FROM users WHERE id = $1`, userID).Scan(&updaterName)
	if nameErr != nil {
		// Log the error but continue with a default name for the automatic comment.
		slog.Error("Failed to fetch updater's name for automatic comment", "updaterUserID", userID, "error", nameErr)
		updaterName = "System/Unknown User"
	}
	slog.Debug("User context obtained", "requestingUserID", userID, "requestingUserName", updaterName, "userRole", userRole)

	// --- Section: Pre-Update Checks (Existence & Permissions) ---

	// Fetch current ticket status and assignee to check permissions and detect changes
	var currentStatus models.TicketStatus
	var currentAssignedTo *string // UUID string of current assignee (or nil)
	err = h.db.Pool.QueryRow(ctx, `
        SELECT status, assigned_to_user_id
        FROM tickets
        WHERE id = $1
    `, ticketID).Scan(&currentStatus, &currentAssignedTo)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			slog.Warn("Ticket not found for update", "ticketUUID", ticketID)
			return echo.NewHTTPError(http.StatusNotFound, "ticket not found")
		}
		// Log the unexpected database error before returning a generic 500
		slog.Error("Failed to query current ticket status/assignee", "ticketUUID", ticketID, "error", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to get ticket details")
	}

	// Authorization Check: Staff users can only update tickets assigned to them (unless admin)
	if userRole != models.RoleAdmin && currentAssignedTo != nil && *currentAssignedTo != userID {
		slog.Warn("Unauthorized attempt to update ticket", "ticketUUID", ticketID, "requestingUserID", userID, "assignedUserID", *currentAssignedTo, "userRole", userRole)
		return echo.NewHTTPError(http.StatusForbidden, "not authorized to update this ticket")
	}

	// --- Section: Database Transaction ---

	tx, err := h.db.Pool.Begin(ctx)
	if err != nil {
		slog.Error("Failed to begin database transaction", "operation", "UpdateTicket", "ticketUUID", ticketID, "error", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to begin transaction")
	}
	// Defer rollback; only runs if named return 'err' is not nil when function exits.
	defer func() {
		if err != nil {
			slog.Warn("Rolling back transaction due to error", "operation", "UpdateTicket", "ticketUUID", ticketID, "error", err)
			if rbErr := tx.Rollback(ctx); rbErr != nil {
				slog.Error("Failed to rollback transaction", "operation", "UpdateTicket", "ticketUUID", ticketID, "rollbackError", rbErr)
			}
		}
	}()

	// --- Section: Build and Execute SQL Update ---

	// Start building the base UPDATE query
	query := `
        UPDATE tickets
        SET status = $1, assigned_to_user_id = $2, updated_at = $3
    `
	args := []interface{}{
		ticketUpdate.Status,           // $1
		ticketUpdate.AssignedToUserID, // $2 (Can be null if unassigning)
		time.Now(),                    // $3 (updated_at)
	}
	paramCount := 3

	// Conditionally add fields for ticket closure
	if ticketUpdate.Status == models.StatusClosed && currentStatus != models.StatusClosed {
		slog.Debug("Ticket status changing to Closed, adding closed_at and resolution notes", "ticketUUID", ticketID)
		query += `, closed_at = $4, resolution_notes = $5`
		paramCount += 2
		args = append(args, time.Now(), ticketUpdate.ResolutionNotes) // $4, $5
	}

	// Add the WHERE clause for the specific ticket ID
	paramCount++
	query += fmt.Sprintf(" WHERE id = $%d", paramCount)
	args = append(args, ticketID) // $6 (or $4 if not closing)

	// Add RETURNING clause to get data needed for notifications and response
	// Ensure all required fields are returned
	query += ` RETURNING id, end_user_email, subject, ticket_number`

	slog.Debug("Executing SQL update query for ticket", "query", query, "argsCount", len(args))

	// Execute the query and scan the returned values
	var updatedTicketID string // Keep original UUID
	var endUserEmail string    // Needed for notifications
	var subject string         // Needed for notifications
	var ticketNumber int32     // User-facing number (ensure type matches model)

	// Assign scan result to named return 'err'
	err = tx.QueryRow(ctx, query, args...).Scan(
		&updatedTicketID,
		&endUserEmail,
		&subject,
		&ticketNumber,
	)
	if err != nil {
		// Log detailed error before returning generic one
		slog.Error("SQL update/scan failed for ticket", "ticketUUID", ticketID, "error", err)
		// err is already set for the defer func, just return the HTTP error
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to update ticket")
	}
	slog.Debug("Ticket update successful in DB", "ticketUUID", updatedTicketID, "ticketNumber", ticketNumber)

	// --- Section: Add Automatic Update Comment (Implementation) ---

	var changeDescriptions []string
	newAssigneeIDPtr := ticketUpdate.AssignedToUserID // Pointer to string UUID

	// Check for status change
	if ticketUpdate.Status != currentStatus {
		changeDescriptions = append(changeDescriptions,
			fmt.Sprintf("Status changed from '%s' to '%s'", currentStatus, ticketUpdate.Status))
	}

	// Check for assignee change
	assigneeChanged := false
	if (currentAssignedTo == nil && newAssigneeIDPtr != nil) || // Was unassigned, now assigned
		(currentAssignedTo != nil && newAssigneeIDPtr == nil) || // Was assigned, now unassigned
		(currentAssignedTo != nil && newAssigneeIDPtr != nil && *currentAssignedTo != *newAssigneeIDPtr) { // Different assignee
		assigneeChanged = true
	}

	// If assignee changed, fetch new assignee name and add description
	if assigneeChanged {
		newAssigneeName := "Unassigned"
		if newAssigneeIDPtr != nil {
			// Fetch the new assignee's name *within the transaction*
			nameErr := tx.QueryRow(ctx, `SELECT name FROM users WHERE id = $1`, *newAssigneeIDPtr).Scan(&newAssigneeName)
			if nameErr != nil && !errors.Is(nameErr, pgx.ErrNoRows) { // Log error only if it's not "not found"
				slog.Error("Failed to fetch new assignee's name for automatic comment", "assigneeUUID", *newAssigneeIDPtr, "ticketUUID", ticketID, "error", nameErr)
				newAssigneeName = "Unknown User" // Fallback
			} else if errors.Is(nameErr, pgx.ErrNoRows) {
                 slog.Warn("Assignee user ID not found when fetching name for comment", "assigneeUUID", *newAssigneeIDPtr, "ticketUUID", ticketID)
                 newAssigneeName = "Deleted/Unknown User" // Or use the ID itself
            }
		}
		changeDescriptions = append(changeDescriptions,
			fmt.Sprintf("Assignment changed to %s", newAssigneeName))
	}

	// If any descriptions were generated, create and insert the comment
	if len(changeDescriptions) > 0 {
		autoComment := fmt.Sprintf("%s by %s.", strings.Join(changeDescriptions, " and "), updaterName)
		slog.Debug("Adding automatic update comment", "ticketUUID", ticketID, "comment", autoComment)

		// Execute insert, assign error to named return 'err'
		_, err = tx.Exec(ctx, `
            INSERT INTO ticket_updates (ticket_id, user_id, comment, is_internal_note, created_at)
            VALUES ($1, $2, $3, $4, $5)
        `, ticketID, userID, autoComment, false, time.Now()) // is_internal_note = false
		if err != nil {
			slog.Error("Failed to add automatic ticket update comment", "ticketUUID", ticketID, "userID", userID, "error", err)
			// err is set, defer will rollback, return the error
			return echo.NewHTTPError(http.StatusInternalServerError, "failed to record ticket update")
		}
	}

	// --- Section: Handle Email Notifications ---

	// Notification for "Closed" status change
	if ticketUpdate.Status == models.StatusClosed && currentStatus != models.StatusClosed {
		slog.Debug("Status changed to Closed, preparing closure email", "ticketUUID", ticketID, "ticketNumber", ticketNumber)
		resolution := "Issue resolved" // Default resolution note
		if ticketUpdate.ResolutionNotes != nil {
			resolution = *ticketUpdate.ResolutionNotes
		}
		// Pass necessary details to the email sending goroutine
		go func(recipient, ticketNumStr, subj, resolutionNotes string) {
			// Note: Using ticketNumber here as it's the user-facing ID
			if emailErr := h.emailService.SendTicketClosure(recipient, ticketNumStr, subj, resolutionNotes); emailErr != nil {
				slog.Error("Goroutine: Sending ticket closure email failed", "ticketNumber", ticketNumStr, "recipient", recipient, "error", emailErr)
			} else {
				slog.Info("Goroutine: Sent ticket closure email", "ticketNumber", ticketNumStr, "recipient", recipient)
			}
		}(endUserEmail, fmt.Sprintf("%d", ticketNumber), subject, resolution)
	}

	// Notification for "In Progress" status change
	if ticketUpdate.Status == models.StatusInProgress && currentStatus != models.StatusInProgress {
		slog.Debug("Status changed to In Progress, preparing notification email", "ticketUUID", ticketID, "ticketNumber", ticketNumber)
		assignedStaffName := "IT Staff" // Default assignee name
		if ticketUpdate.AssignedToUserID != nil {
			// Fetch the assigned user's name again just for email (could reuse name from auto-comment if stored)
			var staffNameQuery string
			// Use QueryRowContext which is part of tx *pgx.Tx
			nameErr := tx.QueryRow(ctx, `SELECT name FROM users WHERE id = $1`, *ticketUpdate.AssignedToUserID).Scan(&staffNameQuery)
			if nameErr == nil {
				assignedStaffName = staffNameQuery
			} else {
				slog.Error("Failed to fetch assignee name for In Progress notification email", "assigneeUUID", *ticketUpdate.AssignedToUserID, "ticketUUID", ticketID, "error", nameErr)
				// Continue with default name
			}
		} else {
			slog.Warn("Ticket set to In Progress but AssignedToUserID is nil, using default staff name for email", "ticketUUID", ticketID, "ticketNumber", ticketNumber)
		}

		// Pass necessary details to the email sending goroutine
		go func(recipient, ticketNumStr, subj, staffName string) {
			// Note: Using ticketNumber here as it's the user-facing ID
			if emailErr := h.emailService.SendTicketInProgress(recipient, ticketNumStr, subj, staffName); emailErr != nil {
				slog.Error("Goroutine: Sending ticket In Progress email failed", "ticketNumber", ticketNumStr, "recipient", recipient, "error", emailErr)
			} else {
				slog.Info("Goroutine: Sent ticket In Progress email", "ticketNumber", ticketNumStr, "recipient", recipient)
			}
		}(endUserEmail, fmt.Sprintf("%d", ticketNumber), subject, assignedStaffName)
	}

	// --- Section: Commit Transaction ---

	// Assign commit result to named return 'err' for the defer check
	err = tx.Commit(ctx)
	if err != nil {
		slog.Error("Failed to commit transaction", "operation", "UpdateTicket", "ticketUUID", ticketID, "error", err)
		// err is set, defer will rollback, return the HTTP error
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to commit transaction")
	}

	// --- Section: Log Success & Return Response ---

	slog.Info("Ticket updated successfully",
		"ticketUUID", ticketID, // Log original ID from param for consistency
		"ticketNumber", ticketNumber,
		"newStatus", ticketUpdate.Status,
		"newAssigneeUUID", ticketUpdate.AssignedToUserID, // Log the assignee UUID
		"updatedByUserID", userID,
	)

	// Fetch the *full* updated ticket details to return the latest state
	// This ensures associated data like user names, tags etc. are included
	// GetTicketByID already handles permissions and data fetching.
	// If GetTicketByID encounters an error now, it will be returned.
	return h.GetTicketByID(c)
}