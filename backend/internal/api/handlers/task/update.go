package task

import (
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/henrythedeveloper/bus-it-ticket/internal/api/middleware/auth"
	"github.com/henrythedeveloper/bus-it-ticket/internal/models"
	"github.com/jackc/pgx/v5"
	"github.com/labstack/echo/v4"
)

// UpdateTask updates a task
func (h *Handler) UpdateTask(c echo.Context) error {
	taskID := c.Param("id")
	if taskID == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "missing task ID")
	}

	var taskUpdate models.TaskCreate
	if err := c.Bind(&taskUpdate); err != nil {
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

	// Verify task exists and user has access
	var task models.Task
	var currentAssignedTo *string
	err = h.db.Pool.QueryRow(ctx, `
		SELECT id, title, description, status, assigned_to_user_id, created_by_user_id,
			due_date, is_recurring, recurrence_rule, created_at, updated_at, completed_at
		FROM tasks
		WHERE id = $1
	`, taskID).Scan(
		&task.ID,
		&task.Title,
		&task.Description,
		&task.Status,
		&task.AssignedToUserID,
		&task.CreatedByUserID,
		&task.DueDate,
		&task.IsRecurring,
		&task.RecurrenceRule,
		&task.CreatedAt,
		&task.UpdatedAt,
		&task.CompletedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return echo.NewHTTPError(http.StatusNotFound, "task not found")
		}
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to get task")
	}

	// Only admins, the task creator, or the assignee can update tasks
	if userRole != models.RoleAdmin &&
		task.CreatedByUserID != userID &&
		(task.AssignedToUserID == nil || *task.AssignedToUserID != userID) {
		return echo.NewHTTPError(http.StatusForbidden, "not authorized to update this task")
	}

	currentAssignedTo = task.AssignedToUserID

	// Begin transaction
	tx, err := h.db.Pool.Begin(ctx)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to begin transaction")
	}
	defer tx.Rollback(ctx) // Rollback if not committed

	// Update task in database
	_, err = tx.Exec(ctx, `
		UPDATE tasks
		SET title = $1, description = $2, assigned_to_user_id = $3,
			due_date = $4, is_recurring = $5, recurrence_rule = $6, updated_at = $7
		WHERE id = $8
	`,
		taskUpdate.Title,
		taskUpdate.Description,
		taskUpdate.AssignedToID,
		taskUpdate.DueDate,
		taskUpdate.IsRecurring,
		taskUpdate.RecurrenceRule,
		time.Now(),
		taskID,
	)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to update task")
	}

	// If task assignment changed, send email notification
	if (currentAssignedTo == nil && taskUpdate.AssignedToID != nil) ||
		(currentAssignedTo != nil && taskUpdate.AssignedToID == nil) ||
		(currentAssignedTo != nil && taskUpdate.AssignedToID != nil && *currentAssignedTo != *taskUpdate.AssignedToID) {

		if taskUpdate.AssignedToID != nil {
			var assignedUser models.User
			err = tx.QueryRow(ctx, `
				SELECT id, name, email, role, created_at, updated_at
				FROM users
				WHERE id = $1
			`, *taskUpdate.AssignedToID).Scan(
				&assignedUser.ID,
				&assignedUser.Name,
				&assignedUser.Email,
				&assignedUser.Role,
				&assignedUser.CreatedAt,
				&assignedUser.UpdatedAt,
			)
			if err == nil {
				// Send task assignment email
				go func() {
					dueDateStr := "No due date"
					if taskUpdate.DueDate != nil {
						dueDateStr = taskUpdate.DueDate.Format("Jan 02, 2006")
					}

					if err := h.emailService.SendTaskAssignment(
						assignedUser.Email,
						taskUpdate.Title,
						dueDateStr,
					); err != nil {
						fmt.Printf("Failed to send task assignment email: %v\n", err)
					}
				}()
			}
		}
	}

	// Commit transaction
	if err := tx.Commit(ctx); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to commit transaction")
	}

	// Return updated task
	return h.GetTaskByID(c)
}

// UpdateTaskStatus updates a task's status
func (h *Handler) UpdateTaskStatus(c echo.Context) error {
	taskID := c.Param("id")
	if taskID == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "missing task ID")
	}

	var statusUpdate models.TaskStatusUpdate
	if err := c.Bind(&statusUpdate); err != nil {
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

	// Verify task exists and user has access
	var task models.Task
	err = h.db.Pool.QueryRow(ctx, `
		SELECT id, title, description, status, assigned_to_user_id, created_by_user_id,
			due_date, is_recurring, recurrence_rule, created_at, updated_at, completed_at
		FROM tasks
		WHERE id = $1
	`, taskID).Scan(
		&task.ID,
		&task.Title,
		&task.Description,
		&task.Status,
		&task.AssignedToUserID,
		&task.CreatedByUserID,
		&task.DueDate,
		&task.IsRecurring,
		&task.RecurrenceRule,
		&task.CreatedAt,
		&task.UpdatedAt,
		&task.CompletedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return echo.NewHTTPError(http.StatusNotFound, "task not found")
		}
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to get task")
	}

	// Only admins, the task creator, or the assignee can update tasks
	if userRole != models.RoleAdmin &&
		task.CreatedByUserID != userID &&
		(task.AssignedToUserID == nil || *task.AssignedToUserID != userID) {
		return echo.NewHTTPError(http.StatusForbidden, "not authorized to update this task")
	}

	// Begin transaction
	tx, err := h.db.Pool.Begin(ctx)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to begin transaction")
	}
	defer tx.Rollback(ctx) // Rollback if not committed

	// Update query based on status change
	var completedAt *time.Time
	if statusUpdate.Status == models.TaskStatusCompleted && task.Status != models.TaskStatusCompleted {
		now := time.Now()
		completedAt = &now
	} else if statusUpdate.Status != models.TaskStatusCompleted && task.Status == models.TaskStatusCompleted {
		completedAt = nil
	} else {
		completedAt = task.CompletedAt
	}

	// Update task status in database
	_, err = tx.Exec(ctx, `
		UPDATE tasks
		SET status = $1, updated_at = $2, completed_at = $3
		WHERE id = $4
	`,
		statusUpdate.Status,
		time.Now(),
		completedAt,
		taskID,
	)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to update task status")
	}

	// Commit transaction
	if err := tx.Commit(ctx); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to commit transaction")
	}

	// Return updated task
	return h.GetTaskByID(c)
}

// DeleteTask deletes a task
func (h *Handler) DeleteTask(c echo.Context) error {
	taskID := c.Param("id")
	if taskID == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "missing task ID")
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

	// Verify task exists and user has access
	var task models.Task
	err = h.db.Pool.QueryRow(ctx, `
		SELECT created_by_user_id
		FROM tasks
		WHERE id = $1
	`, taskID).Scan(&task.CreatedByUserID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return echo.NewHTTPError(http.StatusNotFound, "task not found")
		}
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to get task")
	}

	// Only admins or the task creator can delete tasks
	if userRole != models.RoleAdmin && task.CreatedByUserID != userID {
		return echo.NewHTTPError(http.StatusForbidden, "not authorized to delete this task")
	}

	// Delete task from database
	result, err := h.db.Pool.Exec(ctx, `
		DELETE FROM tasks
		WHERE id = $1
	`, taskID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to delete task")
	}

	if result.RowsAffected() == 0 {
		return echo.NewHTTPError(http.StatusNotFound, "task not found")
	}

	return c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Message: "Task deleted successfully",
	})
}
