// backend/internal/api/handlers/task/update.go
// ==========================================================================
// Handler function for updating existing tasks.
// **REVISED**: Updated SQL query to use snake_case column names.
// **REVISED AGAIN**: Corrected Scan target for ticket_id. Removed unused context import.
// ==========================================================================

package task

import (
	// "context" // Removed unused import
	"database/sql"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/henrythedeveloper/it-ticket-system/internal/models"
	"github.com/jackc/pgx/v5"
	"github.com/labstack/echo/v4"
	// Note: Removed validator import as it's not used directly here for partial updates
)

// UpdateTask handles requests to modify an existing task.
func (h *Handler) UpdateTask(c echo.Context) error {
	ctx := c.Request().Context() // Use context from request
	taskID := c.Param("id")
	logger := slog.With("handler", "UpdateTask", "taskUUID", taskID)

	// --- 1. Input Validation ---
	if taskID == "" { logger.WarnContext(ctx, "Missing task ID in request path"); return echo.NewHTTPError(http.StatusBadRequest, "Missing task ID.") }

	// --- 2. Bind Input ---
	// Bind to a map first to see which fields were actually sent
	var input map[string]interface{}
	if err := c.Bind(&input); err != nil {
		logger.WarnContext(ctx, "Failed to bind request body", "error", err)
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid request body: "+err.Error())
	}

	// --- 3. Fetch Current Task Status (for completed_at logic) ---
	var currentStatus models.TaskStatus
	err := h.db.Pool.QueryRow(ctx, `SELECT status FROM tasks WHERE id = $1`, taskID).Scan(&currentStatus)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) { logger.WarnContext(ctx, "Task not found for update"); return echo.NewHTTPError(http.StatusNotFound, "Task not found.") }
		logger.ErrorContext(ctx, "Failed to query current task status", "error", err); return echo.NewHTTPError(http.StatusInternalServerError, "Failed to retrieve task.")
	}

	// --- 4. Build Update Query Dynamically ---
	queryBuilder := strings.Builder{}
	queryBuilder.WriteString("UPDATE tasks SET ")
	args := []interface{}{}
	paramCount := 0
	updates := []string{}

	// Dynamically add fields to update based on the input map
	if title, ok := input["title"].(string); ok { paramCount++; updates = append(updates, fmt.Sprintf("title = $%d", paramCount)); args = append(args, title) }
	if description, ok := input["description"].(string); ok { paramCount++; updates = append(updates, fmt.Sprintf("description = $%d", paramCount)); args = append(args, description) }
	if statusStr, ok := input["status"].(string); ok { if status := parseTaskStatus(statusStr); status != nil { paramCount++; updates = append(updates, fmt.Sprintf("status = $%d", paramCount)); args = append(args, *status)
			// Handle completed_at based on status change
			if *status == models.TaskStatusCompleted && currentStatus != models.TaskStatusCompleted { paramCount++; updates = append(updates, fmt.Sprintf("completed_at = $%d", paramCount)); args = append(args, time.Now())
			} else if *status != models.TaskStatusCompleted && currentStatus == models.TaskStatusCompleted { paramCount++; updates = append(updates, fmt.Sprintf("completed_at = $%d", paramCount)); args = append(args, sql.NullTime{}) } // Set to NULL
		}
	}
	if assignedToID, ok := input["assigned_to_user_id"].(string); ok { paramCount++; updates = append(updates, fmt.Sprintf("assigned_to_user_id = $%d", paramCount)); args = append(args, assignedToID) }
	if dueDateStr, ok := input["due_date"].(string); ok { if dueDate := parseDate(dueDateStr); dueDate != nil { paramCount++; updates = append(updates, fmt.Sprintf("due_date = $%d", paramCount)); args = append(args, *dueDate) } }
	// Add other updatable fields (is_recurring, recurrence_rule, ticket_id) similarly if needed

	// Ensure at least one field is being updated besides updated_at
	if len(updates) == 0 { logger.WarnContext(ctx, "No valid update fields provided"); return echo.NewHTTPError(http.StatusBadRequest, "No valid fields provided for update.") }

	// Always update the updated_at timestamp
	paramCount++; updates = append(updates, fmt.Sprintf("updated_at = $%d", paramCount)); args = append(args, time.Now())

	queryBuilder.WriteString(strings.Join(updates, ", "))
	paramCount++; queryBuilder.WriteString(fmt.Sprintf(" WHERE id = $%d", paramCount)); args = append(args, taskID)
	// Ensure RETURNING list matches Scan targets
	queryBuilder.WriteString(`
        RETURNING
            id, task_number, title, description, status, assigned_to_user_id,
            created_by_user_id, due_date, is_recurring, recurrence_rule,
            created_at, updated_at, completed_at, ticket_id
    `)

	// --- 5. Execute Update Query ---
	finalQuery := queryBuilder.String()
	logger.DebugContext(ctx, "Executing UpdateTask query", "query", finalQuery, "argsCount", len(args))

	var updatedTask models.Task
	// Scan ticket_id into update TaskNumber
	err = h.db.Pool.QueryRow(ctx, finalQuery, args...).Scan(
		&updatedTask.ID, &updatedTask.TaskNumber, &updatedTask.Title, &updatedTask.Description, &updatedTask.Status, &updatedTask.AssignedToUserID,
		&updatedTask.CreatedByUserID, &updatedTask.DueDate, &updatedTask.IsRecurring, &updatedTask.RecurrenceRule,
		&updatedTask.CreatedAt, &updatedTask.UpdatedAt, &updatedTask.CompletedAt, &updatedTask.TaskNumber, // Scan into TicketID
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) { logger.WarnContext(ctx, "Task not found during update RETURNING"); return echo.NewHTTPError(http.StatusNotFound, "Task not found.") }
		logger.ErrorContext(ctx, "Failed to update task in database", "error", err); return echo.NewHTTPError(http.StatusInternalServerError, "Database error: failed to update task.")
	}

	// --- 6. Fetch Associated User Details (Optional) ---
	// Fetch AssignedToUser and CreatedByUser if needed for the response

	logger.InfoContext(ctx, "Task updated successfully", "taskUUID", updatedTask.ID)

	// --- 7. Return Success Response ---
	return c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Message: "Task updated successfully.",
		Data:    updatedTask,
	})
}
