package task

import (
	"context"
	"errors"
	"time"

	"github.com/henrythedeveloper/bus-it-ticket/internal/models"
	"github.com/jackc/pgx/v5"
)

// scanTaskWithUsers scans a task row with optional user data
func scanTaskWithUsers(
	row pgx.Row,
) (models.Task, error) {
	var task models.Task
	var assignedToUser models.User
	var createdByUser models.User

	// Nullable fields for assigned user
	var assignedUserID, assignedUserName, assignedUserEmail, assignedUserRole *string
	var assignedUserCreatedAt, assignedUserUpdatedAt *time.Time

	// Creator user fields
	var createdUserID, createdUserName, createdUserEmail, createdUserRole string
	var createdUserCreatedAt, createdUserUpdatedAt time.Time

	err := row.Scan(
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
		// Assigned user fields
		&assignedUserID,
		&assignedUserName,
		&assignedUserEmail,
		&assignedUserRole,
		&assignedUserCreatedAt,
		&assignedUserUpdatedAt,
		// Created by user fields
		&createdUserID,
		&createdUserName,
		&createdUserEmail,
		&createdUserRole,
		&createdUserCreatedAt,
		&createdUserUpdatedAt,
	)
	if err != nil {
		return task, err
	}

	// Include assigned user if present
	if task.AssignedToUserID != nil && assignedUserID != nil {
		assignedToUser = models.User{
			ID:        *assignedUserID,
			Name:      *assignedUserName,
			Email:     *assignedUserEmail,
			Role:      models.UserRole(*assignedUserRole),
			CreatedAt: *assignedUserCreatedAt,
			UpdatedAt: *assignedUserUpdatedAt,
		}
		task.AssignedToUser = &assignedToUser
	}

	// Include created by user
	createdByUser = models.User{
		ID:        createdUserID,
		Name:      createdUserName,
		Email:     createdUserEmail,
		Role:      models.UserRole(createdUserRole),
		CreatedAt: createdUserCreatedAt,
		UpdatedAt: createdUserUpdatedAt,
	}
	task.CreatedByUser = &createdByUser

	return task, nil
}

// getTaskById gets a task by ID
func (h *Handler) getTaskById(ctx context.Context, taskID string) (models.Task, error) {
	row := h.db.Pool.QueryRow(ctx, `
		SELECT t.id, t.title, t.description, t.status, t.assigned_to_user_id, t.created_by_user_id,
			t.due_date, t.is_recurring, t.recurrence_rule, t.created_at, t.updated_at, t.completed_at,
			a.id, a.name, a.email, a.role, a.created_at, a.updated_at,
			c.id, c.name, c.email, c.role, c.created_at, c.updated_at
		FROM tasks t
		LEFT JOIN users a ON t.assigned_to_user_id = a.id
		LEFT JOIN users c ON t.created_by_user_id = c.id
		WHERE t.id = $1
	`, taskID)

	task, err := scanTaskWithUsers(row)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return task, errors.New("task not found")
		}
		return task, err
	}

	return task, nil
}

// checkTaskAccess checks if a user has access to update a task
func (h *Handler) checkTaskAccess(
	ctx context.Context,
	taskID string,
	userID string,
	isAdmin bool,
) (models.Task, error) {
	task, err := h.getTaskById(ctx, taskID)
	if err != nil {
		return task, err
	}

	// Check if user has access
	if !isAdmin &&
		task.CreatedByUserID != userID &&
		(task.AssignedToUserID == nil || *task.AssignedToUserID != userID) {
		return task, errors.New("not authorized to access this task")
	}

	return task, nil
}

// formatDueDate formats a due date for display
func formatDueDate(dueDate *time.Time) string {
	if dueDate == nil {
		return "No due date"
	}
	return dueDate.Format("Jan 02, 2006")
}
