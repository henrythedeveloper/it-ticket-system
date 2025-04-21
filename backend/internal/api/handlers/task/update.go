package task

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"time"

	"github.com/henrythedeveloper/bus-it-ticket/internal/api/middleware/auth"
	"github.com/henrythedeveloper/bus-it-ticket/internal/models" // Use models package
	"github.com/jackc/pgx/v5"
	"github.com/labstack/echo/v4"
)

// --- UpdateTask, UpdateTaskStatus, DeleteTask functions remain the same as before ---

// UpdateTask updates a task's core details
func (h *Handler) UpdateTask(c echo.Context) error {
	// ... (Keep existing UpdateTask implementation) ...
	taskID := c.Param("id")
	if taskID == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "missing task ID")
	}

	var taskUpdate models.TaskCreate // Binding to TaskCreate for update payload
	if err := c.Bind(&taskUpdate); err != nil {
		slog.WarnContext(c.Request().Context(), "Failed to bind request body for UpdateTask", "taskID", taskID, "error", err)
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body: "+err.Error())
	}

	ctx := c.Request().Context()

	// Get user ID and role from context for authorization
	userID, err := auth.GetUserIDFromContext(c)
	if err != nil {
		return err
	}
	userRole, err := auth.GetUserRoleFromContext(c)
	if err != nil {
		return err
	}

	// --- Authorization Check: Verify task exists and user has permission ---
	var task models.Task
	var currentAssignedTo *string
	err = h.db.Pool.QueryRow(ctx, `
		SELECT id, title, description, status, assigned_to_user_id, created_by_user_id,
			due_date, is_recurring, recurrence_rule, created_at, updated_at, completed_at
		FROM tasks
		WHERE id = $1
	`, taskID).Scan(
		&task.ID, &task.Title, &task.Description, &task.Status, &task.AssignedToUserID,
		&task.CreatedByUserID, &task.DueDate, &task.IsRecurring, &task.RecurrenceRule,
		&task.CreatedAt, &task.UpdatedAt, &task.CompletedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			slog.WarnContext(ctx, "Task not found for update", "taskID", taskID)
			return echo.NewHTTPError(http.StatusNotFound, "task not found")
		}
		slog.ErrorContext(ctx, "Failed to query task for update check", "taskID", taskID, "error", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to get task details")
	}

	// Authorization logic: Only admins, the creator, or the current assignee can update
	isAssignee := task.AssignedToUserID != nil && *task.AssignedToUserID == userID
	if userRole != models.RoleAdmin && task.CreatedByUserID != userID && !isAssignee {
		slog.WarnContext(ctx, "Unauthorized attempt to update task", "taskID", taskID, "userID", userID)
		return echo.NewHTTPError(http.StatusForbidden, "not authorized to update this task")
	}
	// --- End Authorization Check ---

	currentAssignedTo = task.AssignedToUserID // Store current assignee for email check

	// Begin transaction
	tx, err := h.db.Pool.Begin(ctx)
	if err != nil {
		slog.ErrorContext(ctx, "Failed to begin transaction for UpdateTask", "taskID", taskID, "error", err)
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
		taskUpdate.AssignedToID,   // Use AssignedToID from TaskCreate struct
		taskUpdate.DueDate,        // Use DueDate from TaskCreate struct
		taskUpdate.IsRecurring,    // Use IsRecurring from TaskCreate struct
		taskUpdate.RecurrenceRule, // Use RecurrenceRule from TaskCreate struct
		time.Now(),                // Set updated_at
		taskID,
	)
	if err != nil {
		slog.ErrorContext(ctx, "Failed to execute task update query", "taskID", taskID, "error", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to update task")
	}

	// --- Email Notification Logic (if assignment changed) ---
	newAssignedTo := taskUpdate.AssignedToID
	assignmentChanged := (currentAssignedTo == nil && newAssignedTo != nil) || // Unassigned -> Assigned
		(currentAssignedTo != nil && newAssignedTo == nil) || // Assigned -> Unassigned
		(currentAssignedTo != nil && newAssignedTo != nil && *currentAssignedTo != *newAssignedTo) // Assigned -> Different User

	if assignmentChanged && newAssignedTo != nil {
		// Fetch new assignee details within the transaction
		var assignedUser models.User
		err = tx.QueryRow(ctx, `
			SELECT id, name, email, role, created_at, updated_at
			FROM users WHERE id = $1
		`, *newAssignedTo).Scan(
			&assignedUser.ID, &assignedUser.Name, &assignedUser.Email,
			&assignedUser.Role, &assignedUser.CreatedAt, &assignedUser.UpdatedAt,
		)
		if err == nil {
			// Send email in goroutine (non-blocking)
			go func(email, title string, dueDate *time.Time) {
				dueDateStr := "No due date"
				if dueDate != nil {
					dueDateStr = dueDate.Format("Jan 02, 2006")
				}
				bgCtx := context.Background() // Use background context for goroutine
				if emailErr := h.emailService.SendTaskAssignment(email, title, dueDateStr); emailErr != nil {
					slog.ErrorContext(bgCtx, "Failed to send task assignment email", "recipient", email, "error", emailErr)
				} else {
					slog.InfoContext(bgCtx, "Sent task assignment email", "recipient", email)
				}
			}(assignedUser.Email, taskUpdate.Title, taskUpdate.DueDate)
		} else {
			slog.ErrorContext(ctx, "Failed to fetch assignee details for email notification", "assigneeID", *newAssignedTo, "error", err)
		}
	}
	// --- End Email Notification Logic ---

	// Commit transaction
	if err := tx.Commit(ctx); err != nil {
		slog.ErrorContext(ctx, "Failed to commit transaction for UpdateTask", "taskID", taskID, "error", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to save task update")
	}

	slog.InfoContext(ctx, "Task updated successfully", "taskID", taskID)
	// Return updated task details by calling GetTaskByID
	return h.GetTaskByID(c)
}

// UpdateTaskStatus updates only the status and completed_at fields of a task
func (h *Handler) UpdateTaskStatus(c echo.Context) error {
	// ... (Keep existing UpdateTaskStatus implementation) ...
	taskID := c.Param("id")
	if taskID == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "missing task ID")
	}

	var statusUpdate models.TaskStatusUpdate
	if err := c.Bind(&statusUpdate); err != nil {
		slog.WarnContext(c.Request().Context(), "Failed to bind request body for UpdateTaskStatus", "taskID", taskID, "error", err)
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body: "+err.Error())
	}

	ctx := c.Request().Context()

	// Get user ID and role for authorization
	userID, err := auth.GetUserIDFromContext(c)
	if err != nil {
		return err
	}
	userRole, err := auth.GetUserRoleFromContext(c)
	if err != nil {
		return err
	}

	// --- Authorization Check: Verify task exists and user has permission ---
	var task models.Task
	err = h.db.Pool.QueryRow(ctx, `
		SELECT status, assigned_to_user_id, created_by_user_id, completed_at
		FROM tasks WHERE id = $1
	`, taskID).Scan(&task.Status, &task.AssignedToUserID, &task.CreatedByUserID, &task.CompletedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			slog.WarnContext(ctx, "Task not found for status update", "taskID", taskID)
			return echo.NewHTTPError(http.StatusNotFound, "task not found")
		}
		slog.ErrorContext(ctx, "Failed to query task for status update check", "taskID", taskID, "error", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to get task details")
	}

	// Authorization logic: Admin, creator, or assignee can update status
	isAssignee := task.AssignedToUserID != nil && *task.AssignedToUserID == userID
	if userRole != models.RoleAdmin && task.CreatedByUserID != userID && !isAssignee {
		slog.WarnContext(ctx, "Unauthorized attempt to update task status", "taskID", taskID, "userID", userID)
		return echo.NewHTTPError(http.StatusForbidden, "not authorized to update this task status")
	}
	// --- End Authorization Check ---

	// Begin transaction
	tx, err := h.db.Pool.Begin(ctx)
	if err != nil {
		slog.ErrorContext(ctx, "Failed to begin transaction for UpdateTaskStatus", "taskID", taskID, "error", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to begin transaction")
	}
	defer tx.Rollback(ctx)

	// Determine completed_at timestamp based on status change
	var completedAt *time.Time
	now := time.Now() // Get current time once
	if statusUpdate.Status == models.TaskStatusCompleted && task.Status != models.TaskStatusCompleted {
		completedAt = &now // Set completion time if moving to Completed
	} else if statusUpdate.Status != models.TaskStatusCompleted && task.Status == models.TaskStatusCompleted {
		completedAt = nil // Clear completion time if moving away from Completed
	} else {
		completedAt = task.CompletedAt // Keep existing value otherwise
	}

	// Update task status and completed_at in database
	_, err = tx.Exec(ctx, `
		UPDATE tasks
		SET status = $1, updated_at = $2, completed_at = $3
		WHERE id = $4
	`,
		statusUpdate.Status,
		now, // Update updated_at timestamp
		completedAt,
		taskID,
	)
	if err != nil {
		slog.ErrorContext(ctx, "Failed to execute task status update query", "taskID", taskID, "error", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to update task status")
	}

	// Commit transaction
	if err := tx.Commit(ctx); err != nil {
		slog.ErrorContext(ctx, "Failed to commit transaction for UpdateTaskStatus", "taskID", taskID, "error", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to save task status update")
	}

	slog.InfoContext(ctx, "Task status updated successfully", "taskID", taskID, "newStatus", statusUpdate.Status)
	// Return updated task details
	return h.GetTaskByID(c)
}

// DeleteTask deletes a task
func (h *Handler) DeleteTask(c echo.Context) error {
	// ... (Keep existing DeleteTask implementation) ...
	taskID := c.Param("id")
	if taskID == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "missing task ID")
	}

	ctx := c.Request().Context()

	// Get user ID and role for authorization
	userID, err := auth.GetUserIDFromContext(c)
	if err != nil {
		return err
	}
	userRole, err := auth.GetUserRoleFromContext(c)
	if err != nil {
		return err
	}

	// --- Authorization Check: Verify task exists and user has permission ---
	var createdByUserID string
	err = h.db.Pool.QueryRow(ctx, `SELECT created_by_user_id FROM tasks WHERE id = $1`, taskID).Scan(&createdByUserID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			slog.WarnContext(ctx, "Task not found for deletion", "taskID", taskID)
			return echo.NewHTTPError(http.StatusNotFound, "task not found")
		}
		slog.ErrorContext(ctx, "Failed to query task for deletion check", "taskID", taskID, "error", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to get task details")
	}

	// Authorization logic: Only admins or the task creator can delete tasks
	if userRole != models.RoleAdmin && createdByUserID != userID {
		slog.WarnContext(ctx, "Unauthorized attempt to delete task", "taskID", taskID, "userID", userID)
		return echo.NewHTTPError(http.StatusForbidden, "not authorized to delete this task")
	}
	// --- End Authorization Check ---

	// Delete task from database
	result, err := h.db.Pool.Exec(ctx, `DELETE FROM tasks WHERE id = $1`, taskID)
	if err != nil {
		slog.ErrorContext(ctx, "Failed to execute task deletion query", "taskID", taskID, "error", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to delete task")
	}

	// Check if any row was actually deleted
	if result.RowsAffected() == 0 {
		// This case might happen if the task was deleted between the check and the delete command
		slog.WarnContext(ctx, "Task deletion affected 0 rows, likely already deleted", "taskID", taskID)
		return echo.NewHTTPError(http.StatusNotFound, "task not found or already deleted")
	}

	slog.InfoContext(ctx, "Task deleted successfully", "taskID", taskID)
	return c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Message: "Task deleted successfully",
	})
}

// --- AddTaskUpdate Function (Moved Here) ---
// AddTaskUpdate adds a comment/update to a task
func (h *Handler) AddTaskUpdate(c echo.Context) error {
	taskID := c.Param("id")
	if taskID == "" {
		slog.Warn("AddTaskUpdate called with missing task ID")
		return echo.NewHTTPError(http.StatusBadRequest, "missing task ID")
	}

	// --- Use TaskUpdateCreate for binding ---
	var updateCreate models.TaskUpdateCreate
	if err := c.Bind(&updateCreate); err != nil {
		slog.WarnContext(c.Request().Context(), "Failed to bind request body for AddTaskUpdate", "taskID", taskID, "error", err)
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body: "+err.Error())
	}

	ctx := c.Request().Context()
	userID, err := auth.GetUserIDFromContext(c)
	if err != nil {
		return err
	}

	// --- Authorization Check ---
	var taskStatus models.TaskStatus
	var createdByID string
	var assignedToID *string
	err = h.db.Pool.QueryRow(ctx, `SELECT status, created_by_user_id, assigned_to_user_id FROM tasks WHERE id = $1`, taskID).Scan(&taskStatus, &createdByID, &assignedToID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			slog.WarnContext(ctx, "Attempted to add update to non-existent task", "taskID", taskID, "userID", userID)
			return echo.NewHTTPError(http.StatusNotFound, "task not found")
		}
		slog.ErrorContext(ctx, "Failed to get task details for authorization check", "taskID", taskID, "error", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to check task details")
	}
	userRole, _ := auth.GetUserRoleFromContext(c)
	isAssignee := assignedToID != nil && *assignedToID == userID
	if userRole != models.RoleAdmin && createdByID != userID && !isAssignee {
		slog.WarnContext(ctx, "Unauthorized attempt to add task update", "taskID", taskID, "userID", userID)
		return echo.NewHTTPError(http.StatusForbidden, "not authorized to update this task")
	}
	// --- End Authorization Check ---

	tx, err := h.db.Pool.Begin(ctx)
	if err != nil {
		slog.ErrorContext(ctx, "Failed to begin transaction for AddTaskUpdate", "taskID", taskID, "error", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to start transaction")
	}
	defer tx.Rollback(ctx)

	var updateID string
	// Insert into task_updates table
	err = tx.QueryRow(ctx, `
		INSERT INTO task_updates (task_id, user_id, comment, created_at) 
		VALUES ($1, $2, $3, $4) 
		RETURNING id
	`, taskID, userID, updateCreate.Comment, time.Now()).Scan(&updateID)
	if err != nil {
		slog.ErrorContext(ctx, "Failed to insert task update", "taskID", taskID, "userID", userID, "error", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to add update")
	}

	// Update task's updated_at timestamp
	_, err = tx.Exec(ctx, `UPDATE tasks SET updated_at = $1 WHERE id = $2`, time.Now(), taskID)
	if err != nil {
		slog.ErrorContext(ctx, "Failed to update task updated_at timestamp after adding update", "taskID", taskID, "error", err)
	}

	if err := tx.Commit(ctx); err != nil {
		slog.ErrorContext(ctx, "Failed to commit transaction for AddTaskUpdate", "taskID", taskID, "error", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to save update")
	}

	slog.InfoContext(ctx, "Successfully added task update", "taskID", taskID, "updateID", updateID, "userID", userID)

	// --- Fetch the newly created update using TaskUpdate struct ---
	var createdUpdate models.TaskUpdate // Use TaskUpdate struct
	var updateUserID *string
	var updateUserName, updateUserEmail, updateUserRole *string
	var updateUserCreatedAt, updateUserUpdatedAt *time.Time

	err = h.db.Pool.QueryRow(ctx, `
		SELECT tu.id, tu.task_id, tu.user_id, tu.comment, tu.created_at, 
		       u.id as update_user_id, u.name as update_user_name, u.email as update_user_email, u.role as update_user_role, 
			   u.created_at as update_user_created_at, u.updated_at as update_user_updated_at
		FROM task_updates tu 
		LEFT JOIN users u ON tu.user_id = u.id 
		WHERE tu.id = $1
	`, updateID).Scan(
		&createdUpdate.ID,
		&createdUpdate.TaskID, // Scan into TaskID field
		&updateUserID,         // Scan the user_id from task_updates
		&createdUpdate.Comment,
		// &createdUpdate.IsInternalNote, // Add if using this field
		&createdUpdate.CreatedAt,
		// User details (all nullable from LEFT JOIN) - use aliases
		&updateUserID, // Scan user ID again for the User struct
		&updateUserName,
		&updateUserEmail,
		&updateUserRole,
		&updateUserCreatedAt,
		&updateUserUpdatedAt,
	)

	if err != nil {
		slog.ErrorContext(ctx, "Failed to fetch created task update details", "updateID", updateID, "error", err)
		return c.JSON(http.StatusCreated, models.APIResponse{
			Success: true,
			Message: "Update added successfully, but failed to fetch details.",
			Data:    map[string]string{"id": updateID},
		})
	}

	// Populate the nested User struct if the user exists
	if updateUserID != nil && updateUserName != nil {
		createdUpdate.UserID = updateUserID
		createdUpdate.User = &models.User{
			ID: *updateUserID, Name: *updateUserName, Email: *updateUserEmail,
			Role: models.UserRole(*updateUserRole), CreatedAt: *updateUserCreatedAt, UpdatedAt: *updateUserUpdatedAt,
		}
	}

	return c.JSON(http.StatusCreated, models.APIResponse{
		Success: true,
		Message: "Update added successfully",
		Data:    createdUpdate, // Return TaskUpdate object
	})
}
