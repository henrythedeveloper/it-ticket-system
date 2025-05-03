// backend/internal/api/handlers/ticket/ticket_update.go
// ==========================================================================
// Contains all ticket update operations: status changes, assignments, resolution notes.
// Extracted from ticket_operations.go for better maintainability.
// ==========================================================================

package ticket

import (
	"context"
	"fmt"

	"github.com/henrythedeveloper/it-ticket-system/internal/api/middleware/auth"
	"github.com/henrythedeveloper/it-ticket-system/internal/models"
	"github.com/jackc/pgx/v5"
	"github.com/labstack/echo/v4"
)

// --- UPDATE OPERATIONS ---

// UpdateTicket handles requests to modify a ticket's status, assignee, or resolution notes.
func (h *Handler) UpdateTicket(c echo.Context) error {
	ticketID := c.Param("ticketID")
	var update models.TicketStatusUpdate
	if err := c.Bind(&update); err != nil {
		return echo.NewHTTPError(400, "Invalid request payload")
	}

	ctx := c.Request().Context()
	currentState, err := h.getCurrentTicketStateForUpdate(ctx, ticketID)
	if err != nil {
		return echo.NewHTTPError(500, "Failed to fetch current ticket state")
	}

	query, args, err := h.buildTicketUpdateQuery(ctx, ticketID, &update, currentState)
	if err != nil {
		return echo.NewHTTPError(500, "Failed to build update query")
	}

	tx, err := h.db.Pool.Begin(ctx)
	if err != nil {
		return echo.NewHTTPError(500, "Failed to start transaction")
	}
	defer tx.Rollback(ctx)

	_, err = tx.Exec(ctx, query, args...)
	if err != nil {
		return echo.NewHTTPError(500, "Failed to execute update query")
	}

	// Get updater user ID from context
	updaterUserID, err := auth.GetUserIDFromContext(c)
	if err != nil {
		return echo.NewHTTPError(500, "Failed to get updater user ID")
	}
	updaterName, err := h.getUserName(ctx, updaterUserID)
	if err != nil {
		return echo.NewHTTPError(500, "Failed to fetch updater name")
	}

	changeDescription := h.generateChangeDescription(ctx, currentState, &update, updaterName)
	if err := h.addSystemComment(ctx, tx, ticketID, updaterUserID, changeDescription); err != nil {
		return echo.NewHTTPError(500, "Failed to add system comment")
	}

	if err := tx.Commit(ctx); err != nil {
		return echo.NewHTTPError(500, "Failed to commit transaction")
	}

	return c.JSON(200, map[string]string{"message": "Ticket updated successfully"})
}

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
	query := `SELECT status, assigned_to_user_id, end_user_email, subject, ticket_number FROM tickets WHERE id = $1`
	row := h.db.Pool.QueryRow(ctx, query, ticketID)

	var state ticketState
	err := row.Scan(&state.Status, &state.AssignedToUserID, &state.EndUserEmail, &state.Subject, &state.TicketNumber)
	if err != nil {
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
		return "", fmt.Errorf("failed to fetch user name: %w", err)
	}

	return name, nil
}

// buildTicketUpdateQuery constructs the SQL UPDATE statement and arguments dynamically.
func (h *Handler) buildTicketUpdateQuery(ctx context.Context, ticketID string, update *models.TicketStatusUpdate, currentState *ticketState) (string, []interface{}, error) {
	query := `UPDATE tickets SET `
	args := []interface{}{}
	argIndex := 1

	if update.Status != "" && update.Status != currentState.Status {
		query += fmt.Sprintf("status = $%d, ", argIndex)
		args = append(args, update.Status)
		argIndex++
	}

	if update.AssignedToUserID != nil && update.AssignedToUserID != currentState.AssignedToUserID {
		query += fmt.Sprintf("assigned_to_user_id = $%d, ", argIndex)
		args = append(args, *update.AssignedToUserID)
		argIndex++
	}

	if update.ResolutionNotes != nil && *update.ResolutionNotes != "" {
		query += fmt.Sprintf("resolution_notes = $%d, ", argIndex)
		args = append(args, *update.ResolutionNotes)
		argIndex++
	}

	query = query[:len(query)-2] // Remove trailing comma and space
	query += fmt.Sprintf(" WHERE id = $%d", argIndex)
	args = append(args, ticketID)

	return query, args, nil
}

// generateChangeDescription creates a human-readable string describing the changes made.
func (h *Handler) generateChangeDescription(ctx context.Context, currentState *ticketState, update *models.TicketStatusUpdate, updaterName string) string {
	description := fmt.Sprintf("Ticket updated by %s: ", updaterName)

	if update.Status != "" && update.Status != currentState.Status {
		description += fmt.Sprintf("Status changed from %s to %s. ", currentState.Status, update.Status)
	}

	if update.AssignedToUserID != nil && update.AssignedToUserID != currentState.AssignedToUserID {
		description += fmt.Sprintf("Assigned user changed. ")
	}

	if update.ResolutionNotes != nil && *update.ResolutionNotes != "" {
		description += fmt.Sprintf("Resolution notes updated. ")
	}

	return description
}

// addSystemComment inserts a system-generated comment into the ticket_updates table.
func (h *Handler) addSystemComment(ctx context.Context, tx pgx.Tx, ticketID, userID, comment string) error {
	query := `INSERT INTO ticket_updates (ticket_id, user_id, comment, created_at) VALUES ($1, $2, $3, NOW())`
	_, err := tx.Exec(ctx, query, ticketID, userID, comment)
	if err != nil {
		return fmt.Errorf("failed to add system comment: %w", err)
	}

	return nil
}
