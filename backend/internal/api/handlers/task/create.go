// backend/internal/api/handlers/task/create.go
// ==========================================================================
// Handler function for creating new tasks.
// **REVISED**: Updated SQL query to use snake_case column names.
// **REVISED AGAIN**: Fixed imports and validation call. Corrected Scan target for ticket_id.
// ==========================================================================

package task

import (
	// "context" // Removed unused import
	"fmt"     // Added missing import
	"log/slog"
	"net/http"
	"time"
	"strings"

	"github.com/go-playground/validator/v10" // Added missing import
	"github.com/henrythedeveloper/it-ticket-system/internal/api/middleware/auth"
	"github.com/henrythedeveloper/it-ticket-system/internal/models"
	"github.com/labstack/echo/v4"
)

// CreateTask handles the HTTP request to create a new task.
func (h *Handler) CreateTask(c echo.Context) error {
	ctx := c.Request().Context() // Use context from request
	logger := slog.With("handler", "CreateTask")

	// --- 1. Get User ID from Context ---
	userID, err := auth.GetUserIDFromContext(c)
	if err != nil { return err }

	// --- 2. Bind and Validate Input ---
	var input models.TaskCreate
	if err := c.Bind(&input); err != nil { logger.WarnContext(ctx, "Failed to bind request body", "error", err); return echo.NewHTTPError(http.StatusBadRequest, "Invalid request body: "+err.Error()) }
	// Use the validator instance from the handler
	if err := h.validate.StructCtx(ctx, input); err != nil { // Use StructCtx for context-aware validation if needed
		logger.WarnContext(ctx, "Input validation failed", "error", err)
		// Improve validation error response
		validationErrors, ok := err.(validator.ValidationErrors)
		if !ok {
			return echo.NewHTTPError(http.StatusBadRequest, "Validation error: "+err.Error())
		}
		// Format validation errors nicely (example)
		var errorMsgs []string
		for _, fieldErr := range validationErrors {
			errorMsgs = append(errorMsgs, fmt.Sprintf("Field '%s' failed validation on the '%s' tag", fieldErr.Field(), fieldErr.Tag()))
		}
		return echo.NewHTTPError(http.StatusBadRequest, "Validation failed: "+strings.Join(errorMsgs, "; "))
	}


	// --- 3. Insert Task into Database ---
	var createdTask models.Task
	// Use snake_case column names in INSERT and RETURNING
	// Ensure RETURNING list matches Scan targets
	err = h.db.Pool.QueryRow(ctx, `
        INSERT INTO tasks (
            title, description, status, assigned_to_user_id, created_by_user_id,
            due_date, is_recurring, recurrence_rule, created_at, updated_at, ticket_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING
            id, task_number, title, description, status, assigned_to_user_id,
            created_by_user_id, due_date, is_recurring, recurrence_rule,
            created_at, updated_at, completed_at, ticket_id
        `,
		input.Title, input.Description, models.TaskStatusOpen, input.AssignedToID, userID,
		input.DueDate, input.IsRecurring, input.RecurrenceRule, time.Now(), time.Now(), input.TicketID,
	).Scan(
		&createdTask.ID, &createdTask.TaskNumber, &createdTask.Title, &createdTask.Description, &createdTask.Status, &createdTask.AssignedToUserID,
		&createdTask.CreatedByUserID, &createdTask.DueDate, &createdTask.IsRecurring, &createdTask.RecurrenceRule,
		&createdTask.CreatedAt, &createdTask.UpdatedAt, &createdTask.CompletedAt, &createdTask.TaskNumber, // Correctly scan into TicketID
	)
	if err != nil { logger.ErrorContext(ctx, "Failed to insert task into database", "error", err); return echo.NewHTTPError(http.StatusInternalServerError, "Database error: failed to create task.") }

	// --- 4. Fetch Associated User Details (Optional, for response) ---
	// Fetch AssignedToUser and CreatedByUser details if needed

	logger.InfoContext(ctx, "Task created successfully", "taskUUID", createdTask.ID, "taskNumber", createdTask.TaskNumber)

	// --- 5. Return Success Response ---
	return c.JSON(http.StatusCreated, models.APIResponse{
		Success: true,
		Message: "Task created successfully.",
		Data:    createdTask,
	})
}

