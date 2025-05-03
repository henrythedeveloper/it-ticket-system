// backend/internal/api/handlers/ticket/ticket_update.go
package ticket

import (
	"context"
	"encoding/json" // Needed for JSON unmarshalling in helper
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strings" // Import strings package
	"time"

	"github.com/henrythedeveloper/it-ticket-system/internal/api/middleware/auth" // Auth helpers
	"github.com/henrythedeveloper/it-ticket-system/internal/models"              // Data models
	"github.com/labstack/echo/v4"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn" // Import for pgconn.PgError
)

// UpdateTicket handles requests to modify a ticket's status, assignee, or resolution notes.
func (h *Handler) UpdateTicket(c echo.Context) error {
	ctx := c.Request().Context()
	ticketID := c.Param("id") // CORRECTED PARAM NAME
	logger := slog.With("handler", "UpdateTicket", "ticketID", ticketID)
	var funcErr error // Variable to track errors within the function for rollback logic

	// --- 1. Input Validation & Binding ---
	if ticketID == "" {
		logger.WarnContext(ctx, "Missing ticket ID in request path")
		return echo.NewHTTPError(http.StatusBadRequest, "Missing ticket ID.")
	}

	var update models.TicketStatusUpdate
	if err := c.Bind(&update); err != nil {
		logger.WarnContext(ctx, "Failed to bind request body", "error", err)
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid request body: "+err.Error())
	}

	// --- 2. Get Requesting User Context & Permissions ---
	updaterUserID, err := auth.GetUserIDFromContext(c)
	if err != nil {
		return err // Error logged/returned by helper
	}
	updaterRole, err := auth.GetUserRoleFromContext(c)
	if err != nil {
		return err // Error logged/returned by helper
	}
	logger.DebugContext(ctx, "Update request initiated", "requestingUserID", updaterUserID, "requestingUserRole", updaterRole)

	// --- 3. Authorization Check (Example) ---
	// (Add specific checks if needed)

	// --- 4. Fetch Current Ticket State ---
	currentState, err := h.getCurrentTicketStateForUpdate(ctx, ticketID)
	if err != nil {
		if errors.Is(err, errors.New("ticket not found")) || errors.Is(err, pgx.ErrNoRows) {
			logger.WarnContext(ctx, "Ticket not found when fetching current state for update")
			return echo.NewHTTPError(http.StatusNotFound, "Ticket not found.")
		}
		logger.ErrorContext(ctx, "Failed to fetch current ticket state", "error", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to fetch current ticket state: "+err.Error())
	}

	// --- 5. Build Dynamic Update Query ---
	query, args, buildErr := h.buildTicketUpdateQuery(ctx, ticketID, &update, currentState)
	if buildErr != nil {
		if buildErr.Error() == "no fields to update" {
			logger.InfoContext(ctx, "No update required, request data matches current ticket state.")
			currentTicketDetails, fetchErr := h.getTicketDetailsByID(ctx, ticketID)
			if fetchErr != nil {
				logger.ErrorContext(ctx, "Failed to fetch current ticket details after no-op update check", "error", fetchErr)
				return echo.NewHTTPError(http.StatusInternalServerError, "Failed to retrieve ticket details.")
			}
			logger.InfoContext(ctx, "Returning current ticket data as no update was needed.")
			return c.JSON(http.StatusOK, currentTicketDetails)
		}
		logger.ErrorContext(ctx, "Failed to build update query", "error", buildErr)
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to build update query: "+buildErr.Error())
	}
	if query == "" {
		logger.ErrorContext(ctx, "Build query returned empty string without error")
		return echo.NewHTTPError(http.StatusInternalServerError, "Internal error building update query.")
	}

	// --- 6. Execute Update within Transaction (Manual Handling) ---
	tx, err := h.db.Pool.Begin(ctx)
	if err != nil {
		logger.ErrorContext(ctx, "Failed to begin database transaction", "error", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "Database error: failed to start transaction.")
	}
	// Defer rollback logic based on funcErr
	defer func() {
		if funcErr != nil {
			logger.WarnContext(ctx, "Rolling back transaction due to error", "error", funcErr)
			if rbErr := tx.Rollback(ctx); rbErr != nil {
				logger.ErrorContext(ctx, "Failed to rollback transaction", "rollbackError", rbErr)
			}
		}
	}()

	// Execute the main update query
	if _, err = tx.Exec(ctx, query, args...); err != nil {
		logger.ErrorContext(ctx, "Database update execution failed", "error", err)
		funcErr = fmt.Errorf("database error executing update: %w", err) // Set funcErr for defer
		// Check for specific DB errors if needed (e.g., fk violation -> bad request?)
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) {
			// Handle specific PostgreSQL errors by code if necessary
			logger.ErrorContext(ctx,"PostgreSQL Error", "Code", pgErr.Code, "Message", pgErr.Message, "Detail", pgErr.Detail)
		}
		return echo.NewHTTPError(http.StatusInternalServerError, "Database error: failed to update ticket.")
	}

	// Add system comment (still within transaction)
	updaterName := "System"
	if updaterUserID != "" {
		fetchedName, nameErr := h.getUserName(ctx, updaterUserID)
		if nameErr == nil {
			updaterName = fetchedName
		} else {
			logger.WarnContext(ctx, "Could not fetch updater name for comment", "userID", updaterUserID, "error", nameErr)
		}
	}
	changeDescription := h.generateChangeDescription(ctx, currentState, &update, updaterName)
	// Only add comment if changes were actually made (or always log 'touched'?)
	if changeDescription != fmt.Sprintf("Ticket touched by %s (no field changes detected).", updaterName) {
		if commentErr := h.addSystemComment(ctx, tx, ticketID, updaterUserID, changeDescription); commentErr != nil {
			logger.ErrorContext(ctx, "Failed to add system comment during update", "error", commentErr)
			funcErr = fmt.Errorf("failed to record ticket update comment: %w", commentErr) // Set funcErr for defer
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to record ticket update.")
		}
	}


	// --- 7. Commit Transaction ---
	if err = tx.Commit(ctx); err != nil { // Assign commit error to 'err'
		logger.ErrorContext(ctx, "Failed to commit transaction", "error", err)
		funcErr = fmt.Errorf("failed to commit transaction: %w", err) // Set funcErr for defer
		return echo.NewHTTPError(http.StatusInternalServerError, "Database error: failed to save update.")
	}

	// --- 8. Fetch and Return Updated Ticket Data ---
	updatedTicket, fetchErr := h.getTicketDetailsByID(ctx, ticketID)
	if fetchErr != nil {
		logger.ErrorContext(ctx, "Failed to fetch updated ticket details after successful update", "error", fetchErr)
		return c.JSON(http.StatusOK, map[string]string{"message": "Ticket updated, but failed to retrieve full updated details."})
	}

	logger.InfoContext(ctx, "Ticket updated successfully", "ticketID", ticketID)
	return c.JSON(http.StatusOK, updatedTicket)
}

// --- Helper Functions ---

// getCurrentTicketStateForUpdate fetches essential current ticket data before an update.
// **REVISED**: Added ResolutionNotes
func (h *Handler) getCurrentTicketStateForUpdate(ctx context.Context, ticketID string) (*models.TicketState, error) {
	query := `SELECT status, assigned_to_user_id, end_user_email, subject, ticket_number, resolution_notes FROM tickets WHERE id = $1`
	row := h.db.Pool.QueryRow(ctx, query, ticketID) // Ensure this uses the correct ticketID

	var state models.TicketState
	err := row.Scan(
		&state.Status,
		&state.AssignedToUserID,
		&state.EndUserEmail,
		&state.Subject,
		&state.TicketNumber,
		&state.ResolutionNotes, // Scan resolution notes
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, errors.New("ticket not found") // Use specific error text
		}
		return nil, fmt.Errorf("failed to fetch ticket state: %w", err)
	}
	return &state, nil
}

// getUserName fetches a user's name by their ID.
func (h *Handler) getUserName(ctx context.Context, userID string) (string, error) {
	query := `SELECT name FROM users WHERE id = $1`
	row := h.db.Pool.QueryRow(ctx, query, userID)
	var name string
	err := row.Scan(&name)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", errors.New("user not found")
		}
		return "", fmt.Errorf("failed to fetch user name: %w", err)
	}
	return name, nil
}

// buildTicketUpdateQuery constructs the SQL UPDATE statement and arguments dynamically.
// (Refined version)
func (h *Handler) buildTicketUpdateQuery(ctx context.Context, ticketID string, update *models.TicketStatusUpdate, currentState *models.TicketState) (string, []interface{}, error) {
	var setClauses []string
	var args []interface{}
	argIndex := 1

	// Status Change
	if update.Status != "" && update.Status != currentState.Status {
		setClauses = append(setClauses, fmt.Sprintf("status = $%d", argIndex))
		args = append(args, update.Status)
		argIndex++
	}

	// Assignee Change
	if update.AssignedToUserID != nil {
		newAssigneeID := *update.AssignedToUserID
		needsUpdate := false
		if newAssigneeID == "" {
			if currentState.AssignedToUserID != nil {
				needsUpdate = true
				args = append(args, nil)
			}
		} else {
			if currentState.AssignedToUserID == nil || *currentState.AssignedToUserID != newAssigneeID {
				needsUpdate = true
				args = append(args, newAssigneeID)
			}
		}
		if needsUpdate {
			setClauses = append(setClauses, fmt.Sprintf("assigned_to_user_id = $%d", argIndex))
			argIndex++
		}
	}

	// Resolution Notes
	if update.ResolutionNotes != nil {
		currentNotes := ""
		if currentState.ResolutionNotes != nil {
			currentNotes = *currentState.ResolutionNotes
		}
		if *update.ResolutionNotes != currentNotes {
			setClauses = append(setClauses, fmt.Sprintf("resolution_notes = $%d", argIndex))
			args = append(args, *update.ResolutionNotes)
			argIndex++
            // If setting resolution notes automatically closes ticket, add status change here
             if update.Status != models.StatusClosed { // Check if status isn't already being set to Closed
                 setClauses = append(setClauses, fmt.Sprintf("status = $%d", argIndex))
                 args = append(args, models.StatusClosed) // Set status to closed
                 argIndex++
                 setClauses = append(setClauses, fmt.Sprintf("closed_at = $%d", argIndex))
                 args = append(args, time.Now()) // Set closed timestamp
                 argIndex++
             }
		}
	}

	// Check if there are any actual fields to update before adding updated_at
	if len(setClauses) == 0 {
		return "", nil, errors.New("no fields to update")
	}

	// Always update the updated_at timestamp
	setClauses = append(setClauses, fmt.Sprintf("updated_at = $%d", argIndex))
	args = append(args, time.Now())
	argIndex++

	// Handle closing timestamp if status is set to Closed
	if update.Status == models.StatusClosed && currentState.Status != models.StatusClosed {
		// Check if closed_at is already being set by resolution notes logic
		alreadySettingClosedAt := false
		for _, clause := range setClauses {
			if strings.HasPrefix(clause, "closed_at =") {
				alreadySettingClosedAt = true
				break
			}
		}
		if !alreadySettingClosedAt {
			setClauses = append(setClauses, fmt.Sprintf("closed_at = $%d", argIndex))
			args = append(args, time.Now())
			argIndex++
		}
	}


	// Construct the final query
	query := fmt.Sprintf("UPDATE tickets SET %s WHERE id = $%d",
		strings.Join(setClauses, ", "),
		argIndex,
	)
	args = append(args, ticketID)

	slog.DebugContext(ctx, "Built ticket update query", "query", query, "argsCount", len(args))
	return query, args, nil
}

// generateChangeDescription creates a human-readable string describing the changes made.
// (Refined version)
func (h *Handler) generateChangeDescription(ctx context.Context, currentState *models.TicketState, update *models.TicketStatusUpdate, updaterName string) string {
	var description strings.Builder
	description.WriteString(fmt.Sprintf("Ticket updated by %s: ", updaterName))
	changed := false

	if update.Status != "" && update.Status != currentState.Status {
		description.WriteString(fmt.Sprintf("Status changed from '%s' to '%s'. ", currentState.Status, update.Status))
		changed = true
	}

	if update.AssignedToUserID != nil {
		newAssigneeID := *update.AssignedToUserID
		assigneeChanged := false
		currentAssigneeDisplay := "Unassigned"
		newAssigneeDisplay := "Unassigned"

		if currentState.AssignedToUserID != nil {
			// Try to get name, fallback to ID
			currentName, err := h.getUserName(ctx, *currentState.AssignedToUserID)
			if err == nil {
				currentAssigneeDisplay = currentName
			} else {
				currentAssigneeDisplay = *currentState.AssignedToUserID
				slog.WarnContext(ctx,"Could not fetch current assignee name for change description", "userID", *currentState.AssignedToUserID, "error", err)
			}
		}
		if newAssigneeID != "" {
            // Try to get name, fallback to ID
			newName, err := h.getUserName(ctx, newAssigneeID)
            if err == nil {
				newAssigneeDisplay = newName
			} else {
				newAssigneeDisplay = newAssigneeID
                slog.WarnContext(ctx,"Could not fetch new assignee name for change description", "userID", newAssigneeID, "error", err)
			}
		}


		if newAssigneeID == "" && currentState.AssignedToUserID != nil {
			assigneeChanged = true
			description.WriteString(fmt.Sprintf("Assignee removed (was %s). ", currentAssigneeDisplay))
		} else if newAssigneeID != "" && (currentState.AssignedToUserID == nil || *currentState.AssignedToUserID != newAssigneeID) {
			assigneeChanged = true
			description.WriteString(fmt.Sprintf("Assignee changed from '%s' to '%s'. ", currentAssigneeDisplay, newAssigneeDisplay))
		}
		if assigneeChanged { changed = true }
	}

	if update.ResolutionNotes != nil {
		currentNotes := ""
		if currentState.ResolutionNotes != nil {
			currentNotes = *currentState.ResolutionNotes
		}
		if *update.ResolutionNotes != currentNotes {
			description.WriteString("Resolution notes updated. ")
			changed = true
		}
	}

	if !changed {
		return fmt.Sprintf("Ticket touched by %s (no field changes detected).", updaterName)
	}

	return strings.TrimSpace(description.String())
}

// addSystemComment inserts a system-generated comment into the ticket_updates table.
func (h *Handler) addSystemComment(ctx context.Context, tx pgx.Tx, ticketID, userID, comment string) error {
	query := `INSERT INTO ticket_updates (ticket_id, user_id, comment, is_internal_note, is_system_update, created_at) VALUES ($1, $2, $3, $4, $5, NOW())`
	var userIDArg interface{}
	if userID != "" {
		userIDArg = userID
	} else {
		userIDArg = nil
	}
	_, err := tx.Exec(ctx, query, ticketID, userIDArg, comment, true, true)
	if err != nil {
		return fmt.Errorf("failed to add system comment: %w", err)
	}
	return nil
}


// getTicketDetailsByID fetches a single ticket with its related data.
// ** REVISED to fix unused vars and use logger **
func (h *Handler) getTicketDetailsByID(ctx context.Context, ticketID string) (*models.Ticket, error) {
    logger := slog.With("helper", "getTicketDetailsByID", "ticketID", ticketID) // Use logger
    query := `
        SELECT
            t.id, t.ticket_number, t.submitter_name, t.end_user_email, t.issue_type, t.urgency, t.subject,
            t.description, t.status, t.assigned_to_user_id, t.created_at, t.updated_at,
            t.closed_at, t.resolution_notes,
            a.id as assigned_user_id_val, a.name as assigned_user_name, a.email as assigned_user_email,
            a.role as assigned_user_role, a.created_at as assigned_user_created_at, a.updated_at as assigned_user_updated_at,
            s.id as submitter_user_id_val, s.name as submitter_user_name, s.email as submitter_user_email,
            s.role as submitter_user_role, s.created_at as submitter_user_created_at, s.updated_at as submitter_user_updated_at,
             COALESCE(
                (SELECT json_agg(json_build_object('id', tg.id, 'name', tg.name, 'created_at', tg.created_at))
                 FROM ticket_tags tt JOIN tags tg ON tt.tag_id = tg.id
                 WHERE tt.ticket_id = t.id),
                '[]'::json
            ) as tags
        FROM tickets t
        LEFT JOIN users a ON t.assigned_to_user_id = a.id
        LEFT JOIN users s ON t.end_user_email = s.email
        WHERE t.id = $1
        GROUP BY t.id, a.id, s.id
    `
    row := h.db.Pool.QueryRow(ctx, query, ticketID)
    var ticket models.Ticket
    // var assignedUser models.User // REMOVED - Unused
    // var submitterUser models.User // REMOVED - Unused
    var tagsJSON []byte
    var assignedUserIDVal, assignedUserName, assignedUserEmail, assignedUserRole *string
    var assignedUserCreatedAt, assignedUserUpdatedAt *time.Time
    var submitterUserIDVal, submitterUserName, submitterUserEmail, submitterUserRole *string
    var submitterUserCreatedAt, submitterUserUpdatedAt *time.Time

    scanErr := row.Scan(
        &ticket.ID, &ticket.TicketNumber, &ticket.SubmitterName, &ticket.EndUserEmail, &ticket.IssueType, &ticket.Urgency, &ticket.Subject,
        &ticket.Description, &ticket.Status, &ticket.AssignedToUserID,
        &ticket.CreatedAt, &ticket.UpdatedAt, &ticket.ClosedAt, &ticket.ResolutionNotes,
        &assignedUserIDVal, &assignedUserName, &assignedUserEmail, &assignedUserRole,
        &assignedUserCreatedAt, &assignedUserUpdatedAt,
        &submitterUserIDVal, &submitterUserName, &submitterUserEmail, &submitterUserRole,
        &submitterUserCreatedAt, &submitterUserUpdatedAt,
        &tagsJSON,
    )

    if scanErr != nil {
        if errors.Is(scanErr, pgx.ErrNoRows) {
            logger.WarnContext(ctx, "Ticket not found") // USE logger
            return nil, errors.New("ticket not found")
        }
        logger.ErrorContext(ctx, "Database query failed", "error", scanErr) // USE logger
        return nil, fmt.Errorf("failed to fetch ticket details: %w", scanErr)
    }

    // Populate AssignedToUser directly
    if assignedUserIDVal != nil {
        ticket.AssignedToUser = &models.User{ // Populate directly
            ID:        *assignedUserIDVal, Name:      *assignedUserName, Email:     *assignedUserEmail,
            Role:      models.UserRole(*assignedUserRole), CreatedAt: *assignedUserCreatedAt, UpdatedAt: *assignedUserUpdatedAt,
        }
    } else {
        ticket.AssignedToUser = nil
    }

    // Populate Submitter directly
    if submitterUserIDVal != nil {
        ticket.Submitter = &models.User{ // Populate directly
            ID:        *submitterUserIDVal, Name:      *submitterUserName, Email:     *submitterUserEmail,
            Role:      models.UserRole(*submitterUserRole), CreatedAt: *submitterUserCreatedAt, UpdatedAt: *submitterUserUpdatedAt,
        }
    } else {
        ticket.Submitter = nil
    }

    // Unmarshal Tags
    if err := json.Unmarshal(tagsJSON, &ticket.Tags); err != nil {
         logger.ErrorContext(ctx, "Failed to unmarshal tags JSON", "error", err) // USE logger
         ticket.Tags = []models.Tag{}
    }

    return &ticket, nil
}
