// backend/internal/api/handlers/task/update.go
// ==========================================================================
// Handler functions for modifying tasks (updating details, status, adding comments, deleting).
// Includes authorization, transaction management, and notifications.
// ==========================================================================

package task

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/henrythedeveloper/it-ticket-system/internal/api/middleware/auth" // Auth helpers
	// No longer need db import here, use h.db "github.com/henrythedeveloper/it-ticket-system/internal/db"
	"github.com/henrythedeveloper/it-ticket-system/internal/models" // Data models
	"github.com/jackc/pgx/v5"
	"github.com/labstack/echo/v4"
)

// --- Handler Functions ---

// UpdateTask handles requests to modify core details of a task (title, description, assignee, due date, recurrence).
// It performs authorization checks and updates the database within a transaction.
//
// Path Parameters:
//   - id: The UUID of the task to update.
//
// Request Body:
//   - Expects JSON matching models.TaskCreate (reused for update payload).
//
// Returns:
//   - JSON response with the fully updated task details or an error response.
func (h *Handler) UpdateTask(c echo.Context) (err error) { // Use named return for defer rollback check
	ctx := c.Request().Context()
	taskID := c.Param("id")
	logger := slog.With("handler", "UpdateTask", "taskUUID", taskID)

	// --- 1. Input Validation & Binding ---
	if taskID == "" {
		logger.WarnContext(ctx, "Missing task ID in request path")
		return echo.NewHTTPError(http.StatusBadRequest, "Missing task ID.")
	}

	var taskUpdate models.TaskCreate // Reuse TaskCreate struct for update payload
	if err = c.Bind(&taskUpdate); err != nil {
		logger.WarnContext(ctx, "Failed to bind request body", "error", err)
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid request body: "+err.Error())
	}
	// TODO: Add validation for taskUpdate fields if needed

	// --- 2. Get User Context & Permissions ---
	updaterUserID, err := auth.GetUserIDFromContext(c)
	if err != nil {
		return err
	}
	updaterRole, err := auth.GetUserRoleFromContext(c)
	if err != nil {
		return err
	}
	logger.DebugContext(ctx, "Update request initiated", "updaterUserID", updaterUserID, "updaterRole", updaterRole)

	// --- 3. Authorization Check & Fetch Current Assignee ---
	// Verify user has permission to update this task
	_, authErr := checkTaskAccess(ctx, h.db, taskID, updaterUserID, updaterRole)
	if authErr != nil {
		logger.WarnContext(ctx, "Authorization check failed", "error", authErr)
		if authErr.Error() == "task not found" {
			return echo.NewHTTPError(http.StatusNotFound, authErr.Error())
		}
		if authErr.Error() == "not authorized to access this task" {
			return echo.NewHTTPError(http.StatusForbidden, authErr.Error())
		}
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to verify task access.")
	}

	// Fetch current assignee ID *after* auth check, only if needed for notification logic
	var currentAssignedToUserID *string
	err = h.db.Pool.QueryRow(ctx, `SELECT assigned_to_user_id FROM tasks WHERE id = $1`, taskID).Scan(&currentAssignedToUserID)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) { // Ignore ErrNoRows as auth check passed
		logger.ErrorContext(ctx, "Failed to fetch current assignee ID", "error", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to retrieve current task details.")
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

	// --- 5. Execute Update Query ---
	// Update core task fields. Status is NOT updated here (use UpdateTaskStatus).
	_, err = tx.Exec(ctx, `
        UPDATE tasks
        SET title = $1, description = $2, assigned_to_user_id = $3, due_date = $4,
            is_recurring = $5, recurrence_rule = $6, updated_at = $7
        WHERE id = $8
    `,
		taskUpdate.Title, taskUpdate.Description, taskUpdate.AssignedToID, taskUpdate.DueDate,
		taskUpdate.IsRecurring, taskUpdate.RecurrenceRule, time.Now(), // updated_at
		taskID,
	)
	if err != nil {
		logger.ErrorContext(ctx, "Failed to execute task update query", "error", err)
		// TODO: Handle specific DB errors like invalid assigned_to_user_id if possible
		return echo.NewHTTPError(http.StatusInternalServerError, "Database error: failed to update task.")
	}
	logger.DebugContext(ctx, "Task record updated successfully")

	// --- 6. Commit Transaction ---
	// Commit before sending notifications
	err = tx.Commit(ctx)
	if err != nil {
		logger.ErrorContext(ctx, "Failed to commit transaction", "error", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "Database error: failed to save task update.")
	}

	// --- 7. Trigger Assignment Notification (If Changed) ---
	newAssignedToUserID := taskUpdate.AssignedToID
	assignmentChanged := (currentAssignedToUserID == nil && newAssignedToUserID != nil && *newAssignedToUserID != "") || // Unassigned -> Assigned
		(currentAssignedToUserID != nil && (newAssignedToUserID == nil || *newAssignedToUserID == "")) || // Assigned -> Unassigned
		(currentAssignedToUserID != nil && newAssignedToUserID != nil && *newAssignedToUserID != "" && *currentAssignedToUserID != *newAssignedToUserID) // Assigned -> Different User

	if assignmentChanged && newAssignedToUserID != nil && *newAssignedToUserID != "" {
		// Fetch assignee email for notification (outside transaction now)
		var assigneeEmail string
		// Use a background context for potentially slow email operations
		bgCtx := context.Background()
		dbErr := h.db.Pool.QueryRow(bgCtx, `SELECT email FROM users WHERE id = $1`, *newAssignedToUserID).Scan(&assigneeEmail)
		if dbErr == nil {
			// Send notification asynchronously
			// Call the method defined (presumably) in create.go
			go h.sendTaskAssignmentNotification(assigneeEmail, taskUpdate.Title, taskUpdate.DueDate)
		} else {
			logger.ErrorContext(ctx, "Failed to fetch assignee email for notification after update", "assigneeID", *newAssignedToUserID, "error", dbErr)
		}
	}

	// --- 8. Return Updated Task Details ---
	logger.InfoContext(ctx, "Task updated successfully")
	return h.GetTaskByID(c) // Reuse GetTaskByID handler to return the full updated task
}

// UpdateTaskStatus handles requests to specifically update a task's status.
// It also updates the completed_at timestamp accordingly.
//
// Path Parameters:
//   - id: The UUID of the task to update.
//
// Request Body:
//   - Expects JSON matching models.TaskStatusUpdate.
//
// Returns:
//   - JSON response with the fully updated task details or an error response.
func (h *Handler) UpdateTaskStatus(c echo.Context) (err error) { // Use named return
	ctx := c.Request().Context()
	taskID := c.Param("id")
	logger := slog.With("handler", "UpdateTaskStatus", "taskUUID", taskID)

	// --- 1. Input Validation & Binding ---
	if taskID == "" {
		logger.WarnContext(ctx, "Missing task ID in request path")
		return echo.NewHTTPError(http.StatusBadRequest, "Missing task ID.")
	}

	var statusUpdate models.TaskStatusUpdate
	if err = c.Bind(&statusUpdate); err != nil {
		logger.WarnContext(ctx, "Failed to bind request body", "error", err)
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid request body: "+err.Error())
	}
	// Validate the status value
	if statusUpdate.Status != models.TaskStatusOpen &&
		statusUpdate.Status != models.TaskStatusInProgress &&
		statusUpdate.Status != models.TaskStatusCompleted {
		logger.WarnContext(ctx, "Invalid status value provided", "status", statusUpdate.Status)
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid status value.")
	}

	// --- 2. Get User Context & Permissions ---
	updaterUserID, err := auth.GetUserIDFromContext(c)
	if err != nil {
		return err
	}
	updaterRole, err := auth.GetUserRoleFromContext(c)
	if err != nil {
		return err
	}
	logger.DebugContext(ctx, "Status update request initiated", "updaterUserID", updaterUserID, "newStatus", statusUpdate.Status)

	// --- 3. Authorization Check ---
	// Use checkTaskAccess helper
	if _, authErr := checkTaskAccess(ctx, h.db, taskID, updaterUserID, updaterRole); authErr != nil {
		logger.WarnContext(ctx, "Authorization check failed", "error", authErr)
		if authErr.Error() == "task not found" {
			return echo.NewHTTPError(http.StatusNotFound, authErr.Error())
		}
		if authErr.Error() == "not authorized to access this task" {
			return echo.NewHTTPError(http.StatusForbidden, authErr.Error())
		}
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to verify task access.")
	}

	// Fetch the current status specifically for comparison
	var currentStatus models.TaskStatus
	var currentCompletedAt *time.Time
	err = h.db.Pool.QueryRow(ctx, `SELECT status, completed_at FROM tasks WHERE id = $1`, taskID).Scan(&currentStatus, &currentCompletedAt)
	if err != nil {
		logger.ErrorContext(ctx, "Failed to fetch current task status after auth check", "error", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to retrieve current task status.")
	}

	// --- 4. Determine completed_at Timestamp ---
	var newCompletedAt *time.Time
	now := time.Now()
	if statusUpdate.Status == models.TaskStatusCompleted && currentStatus != models.TaskStatusCompleted {
		newCompletedAt = &now // Set completion time if moving to Completed
	} else if statusUpdate.Status != models.TaskStatusCompleted && currentStatus == models.TaskStatusCompleted {
		newCompletedAt = nil // Clear completion time if moving away from Completed
	} else {
		newCompletedAt = currentCompletedAt // Keep existing value otherwise
	}

	// --- 5. Database Transaction ---
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

	// --- 6. Execute Update Query ---
	_, err = tx.Exec(ctx, `
        UPDATE tasks SET status = $1, updated_at = $2, completed_at = $3 WHERE id = $4
    `, statusUpdate.Status, now, newCompletedAt, taskID)
	if err != nil {
		logger.ErrorContext(ctx, "Failed to execute task status update query", "error", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "Database error: failed to update task status.")
	}

	// --- 7. Log Status Change as System Comment ---
	// Fetch updater's name (best effort)
	updaterName := "System" // Default
	var name string
	// Use background context as this is non-critical path for the request
	if nameErr := h.db.Pool.QueryRow(context.Background(), `SELECT name FROM users WHERE id = $1`, updaterUserID).Scan(&name); nameErr == nil {
		updaterName = name
	} else {
		logger.WarnContext(ctx, "Could not fetch updater name for system comment", "error", nameErr)
	}

	changeDesc := fmt.Sprintf("Status changed from '%s' to '%s' by %s.", currentStatus, statusUpdate.Status, updaterName)
	// Use the addSystemComment helper defined in utils.go
	commentErr := addSystemComment(ctx, tx, taskID, updaterUserID, changeDesc)
	if commentErr != nil {
		logger.ErrorContext(ctx, "Failed to add automatic status change comment", "error", commentErr)
		// Decide if this should rollback the status update
		// err = commentErr // Uncomment to make comment failure critical
	}

	// --- 8. Commit Transaction ---
	if err == nil {
		err = tx.Commit(ctx)
		if err != nil {
			logger.ErrorContext(ctx, "Failed to commit transaction", "error", err)
			return echo.NewHTTPError(http.StatusInternalServerError, "Database error: failed to save status update.")
		}
	} else {
		// Defer handles rollback
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to complete status update.")
	}

	// --- 9. Return Updated Task Details ---
	logger.InfoContext(ctx, "Task status updated successfully", "newStatus", statusUpdate.Status)
	return h.GetTaskByID(c) // Reuse GetTaskByID handler
}

// DeleteTask handles requests to delete a task.
// Performs authorization checks (only creator or admin can delete).
//
// Path Parameters:
//   - id: The UUID of the task to delete.
//
// Returns:
//   - JSON success message or an error response.
func (h *Handler) DeleteTask(c echo.Context) error {
	ctx := c.Request().Context()
	taskID := c.Param("id")
	logger := slog.With("handler", "DeleteTask", "taskUUID", taskID)

	// --- 1. Input Validation ---
	if taskID == "" {
		logger.WarnContext(ctx, "Missing task ID in request path")
		return echo.NewHTTPError(http.StatusBadRequest, "Missing task ID.")
	}

	// --- 2. Get User Context & Permissions ---
	deleterUserID, err := auth.GetUserIDFromContext(c)
	if err != nil {
		return err
	}
	deleterRole, err := auth.GetUserRoleFromContext(c)
	if err != nil {
		return err
	}
	logger.DebugContext(ctx, "Delete request initiated", "deleterUserID", deleterUserID, "deleterRole", deleterRole)

	// --- 3. Authorization Check ---
	// Fetch only the creator ID for the check
	var creatorUserID string
	err = h.db.Pool.QueryRow(ctx, `SELECT created_by_user_id FROM tasks WHERE id = $1`, taskID).Scan(&creatorUserID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			logger.WarnContext(ctx, "Task not found for deletion")
			return echo.NewHTTPError(http.StatusNotFound, "Task not found.")
		}
		logger.ErrorContext(ctx, "Failed to query task for deletion check", "error", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to retrieve task details.")
	}

	// Authorization: Only Admin or the creator can delete
	if deleterRole != models.RoleAdmin && creatorUserID != deleterUserID {
		logger.WarnContext(ctx, "Unauthorized attempt to delete task", "creatorUserID", creatorUserID)
		return echo.NewHTTPError(http.StatusForbidden, "Not authorized to delete this task.")
	}

	// --- 4. Execute Delete Query ---
	// Associated task_updates should be deleted automatically via ON DELETE CASCADE foreign key constraint.
	commandTag, err := h.db.Pool.Exec(ctx, `DELETE FROM tasks WHERE id = $1`, taskID)
	if err != nil {
		logger.ErrorContext(ctx, "Failed to execute task deletion query", "error", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "Database error: failed to delete task.")
	}

	// Check if any row was actually deleted
	if commandTag.RowsAffected() == 0 {
		logger.WarnContext(ctx, "Task deletion affected 0 rows, likely already deleted")
		return echo.NewHTTPError(http.StatusNotFound, "Task not found or already deleted.")
	}

	// --- 5. Return Success Response ---
	logger.InfoContext(ctx, "Task deleted successfully")
	return c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Message: "Task deleted successfully.",
	})
}

// AddTaskUpdate handles requests to add a comment/update to a task.
// Performs authorization checks.
//
// Path Parameters:
//   - id: The UUID of the task to add the update to.
//
// Request Body:
//   - Expects JSON matching models.TaskUpdateCreate.
//
// Returns:
//   - JSON response with the newly created TaskUpdate object or an error response.
func (h *Handler) AddTaskUpdate(c echo.Context) (err error) { // Use named return
	ctx := c.Request().Context()
	taskID := c.Param("id")
	logger := slog.With("handler", "AddTaskUpdate", "taskUUID", taskID)

	// --- 1. Input Validation & Binding ---
	if taskID == "" {
		logger.WarnContext(ctx, "Missing task ID in request path")
		return echo.NewHTTPError(http.StatusBadRequest, "Missing task ID.")
	}

	var updateCreate models.TaskUpdateCreate
	if err = c.Bind(&updateCreate); err != nil {
		logger.WarnContext(ctx, "Failed to bind request body", "error", err)
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid request body: "+err.Error())
	}
	if strings.TrimSpace(updateCreate.Comment) == "" {
		logger.WarnContext(ctx, "Attempted to add empty comment")
		return echo.NewHTTPError(http.StatusBadRequest, "Comment cannot be empty.")
	}
	// TODO: Add other validation if needed (e.g., comment length)

	// --- 2. Get User Context & Permissions ---
	updaterUserID, err := auth.GetUserIDFromContext(c)
	if err != nil {
		return err
	}
	updaterRole, err := auth.GetUserRoleFromContext(c)
	if err != nil {
		return err
	}
	logger.DebugContext(ctx, "Add update request initiated", "updaterUserID", updaterUserID)

	// --- 3. Authorization Check ---
	// Verify user has access to the task they are commenting on
	if _, authErr := checkTaskAccess(ctx, h.db, taskID, updaterUserID, updaterRole); authErr != nil {
		logger.WarnContext(ctx, "Authorization failed for adding task update", "error", authErr)
		if authErr.Error() == "task not found" {
			return echo.NewHTTPError(http.StatusNotFound, authErr.Error())
		}
		if authErr.Error() == "not authorized to access this task" {
			return echo.NewHTTPError(http.StatusForbidden, authErr.Error())
		}
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to verify task access.")
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

	// --- 5. Insert Task Update ---
	var updateID string
	// Insert into task_updates table
	err = tx.QueryRow(ctx, `
        INSERT INTO task_updates (task_id, user_id, comment, created_at)
        VALUES ($1, $2, $3, $4) RETURNING id
    `, taskID, updaterUserID, updateCreate.Comment, time.Now()).Scan(&updateID)
	if err != nil {
		logger.ErrorContext(ctx, "Failed to insert task update", "error", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "Database error: failed to add update.")
	}

	// --- 6. Update Task's updated_at Timestamp ---
	_, err = tx.Exec(ctx, `UPDATE tasks SET updated_at = $1 WHERE id = $2`, time.Now(), taskID)
	if err != nil {
		logger.ErrorContext(ctx, "Failed to update task's updated_at timestamp", "error", err)
		// Decide if this is critical enough to rollback
		// err = fmt.Errorf("failed to update task timestamp: %w", err) // Uncomment to trigger rollback
	}

	// --- 7. Commit Transaction ---
	if err == nil {
		err = tx.Commit(ctx)
		if err != nil {
			logger.ErrorContext(ctx, "Failed to commit transaction", "error", err)
			return echo.NewHTTPError(http.StatusInternalServerError, "Database error: failed to save update.")
		}
	} else {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to complete update addition.")
	}

	// --- 8. Fetch Created Update with User Details ---
	// Use the helper function from utils.go (which is now exported)
	createdUpdate, fetchErr := GetTaskUpdateByID(ctx, h.db, updateID) // Corrected function name
	if fetchErr != nil {
		logger.ErrorContext(ctx, "Failed to fetch created task update details", "updateID", updateID, "error", fetchErr)
		return c.JSON(http.StatusCreated, models.APIResponse{
			Success: true,
			Message: "Update added successfully, but failed to retrieve full details.",
			Data:    map[string]string{"id": updateID},
		})
	}

	// --- 9. Return Success Response ---
	logger.InfoContext(ctx, "Task update added successfully", "updateID", updateID)
	return c.JSON(http.StatusCreated, models.APIResponse{
		Success: true,
		Message: "Update added successfully.",
		Data:    createdUpdate, // Return the TaskUpdate object with user details
	})
}
