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

// GetAllTasks returns all tasks with filtering
func (h *Handler) GetAllTasks(c echo.Context) error {
	ctx := c.Request().Context()

	// Get user role and ID from context
	userRole, err := auth.GetUserRoleFromContext(c)
	if err != nil {
		return err
	}
	userID, err := auth.GetUserIDFromContext(c)
	if err != nil {
		return err
	}

	// Build query based on filters
	query := `
		SELECT t.id, t.task_number, t.title, t.description, t.status, t.assigned_to_user_id, t.created_by_user_id,
			t.due_date, t.is_recurring, t.recurrence_rule, t.created_at, t.updated_at, t.completed_at,
			a.id, a.name, a.email, a.role, a.created_at, a.updated_at,
			c.id, c.name, c.email, c.role, c.created_at, c.updated_at
		FROM tasks t
		LEFT JOIN users a ON t.assigned_to_user_id = a.id
		LEFT JOIN users c ON t.created_by_user_id = c.id
		WHERE 1=1
	`
	args := []interface{}{}
	paramCount := 0

	// Apply filters
	status := c.QueryParam("status")
	if status != "" {
		paramCount++
		query += fmt.Sprintf(" AND t.status = $%d", paramCount)
		args = append(args, status)
	}

	assignedTo := c.QueryParam("assigned_to")
	if assignedTo != "" {
		if assignedTo == "me" {
			paramCount++
			query += fmt.Sprintf(" AND t.assigned_to_user_id = $%d", paramCount)
			args = append(args, userID)
		} else if assignedTo == "unassigned" {
			query += " AND t.assigned_to_user_id IS NULL"
		} else {
			paramCount++
			query += fmt.Sprintf(" AND t.assigned_to_user_id = $%d", paramCount)
			args = append(args, assignedTo)
		}
	}

	createdBy := c.QueryParam("created_by")
	if createdBy != "" {
		if createdBy == "me" {
			paramCount++
			query += fmt.Sprintf(" AND t.created_by_user_id = $%d", paramCount)
			args = append(args, userID)
		} else {
			paramCount++
			query += fmt.Sprintf(" AND t.created_by_user_id = $%d", paramCount)
			args = append(args, createdBy)
		}
	}

	// Staff users can only see tasks they created or are assigned to them unless they're admins
	if userRole != models.RoleAdmin {
		paramCount++
		query += fmt.Sprintf(" AND (t.assigned_to_user_id = $%d OR t.created_by_user_id = $%d)", paramCount, paramCount)
		args = append(args, userID)
	}

	// Add due date filter
	dueDate := c.QueryParam("due_date")
	if dueDate == "today" {
		query += " AND DATE(t.due_date) = CURRENT_DATE"
	} else if dueDate == "week" {
		query += " AND t.due_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + INTERVAL '7 days')"
	} else if dueDate == "overdue" {
		query += " AND t.due_date < CURRENT_DATE AND t.status != 'Completed'"
	}

	query += " ORDER BY CASE WHEN t.due_date IS NULL THEN 1 ELSE 0 END, t.due_date, t.created_at DESC"

	// Get tasks from database
	rows, err := h.db.Pool.Query(ctx, query, args...)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to get tasks")
	}
	defer rows.Close()

	var tasks []models.Task
	for rows.Next() {
		var task models.Task
		var assignedToUser models.User
		var createdByUser models.User

		// Nullable fields for assigned user
		var assignedUserID, assignedUserName, assignedUserEmail, assignedUserRole *string
		var assignedUserCreatedAt, assignedUserUpdatedAt *time.Time

		// Creator user fields
		var createdUserID, createdUserName, createdUserEmail, createdUserRole string
		var createdUserCreatedAt, createdUserUpdatedAt time.Time

		if err := rows.Scan(
			&task.ID,
			&task.TaskNumber,
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
		); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "failed to scan task")
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

		tasks = append(tasks, task)
	}

	return c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    tasks,
	})
}

// GetTaskByID returns a task by ID
func (h *Handler) GetTaskByID(c echo.Context) error {
	taskID := c.Param("id")
	if taskID == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "missing task ID")
	}

	ctx := c.Request().Context()

	// Get user role and ID from context
	userRole, err := auth.GetUserRoleFromContext(c)
	if err != nil {
		return err
	}
	userID, err := auth.GetUserIDFromContext(c)
	if err != nil {
		return err
	}

	// Get task from database
	var task models.Task
	var assignedToUser models.User
	var createdByUser models.User

	// Nullable fields for assigned user
	var assignedUserID, assignedUserName, assignedUserEmail, assignedUserRole *string
	var assignedUserCreatedAt, assignedUserUpdatedAt *time.Time

	// Creator user fields
	var createdUserID, createdUserName, createdUserEmail, createdUserRole string
	var createdUserCreatedAt, createdUserUpdatedAt time.Time

	err = h.db.Pool.QueryRow(ctx, `
		SELECT t.id, t.title, t.description, t.status, t.assigned_to_user_id, t.created_by_user_id,
			t.due_date, t.is_recurring, t.recurrence_rule, t.created_at, t.updated_at, t.completed_at,
			a.id, a.name, a.email, a.role, a.created_at, a.updated_at,
			c.id, c.name, c.email, c.role, c.created_at, c.updated_at
		FROM tasks t
		LEFT JOIN users a ON t.assigned_to_user_id = a.id
		LEFT JOIN users c ON t.created_by_user_id = c.id
		WHERE t.id = $1
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
		if errors.Is(err, pgx.ErrNoRows) {
			return echo.NewHTTPError(http.StatusNotFound, "task not found")
		}
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to get task")
	}

	// Check if user has permission to view this task (admin, creator, or assignee)
	if userRole != models.RoleAdmin &&
		task.CreatedByUserID != userID &&
		(task.AssignedToUserID == nil || *task.AssignedToUserID != userID) {
		return echo.NewHTTPError(http.StatusForbidden, "not authorized to view this task")
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

	return c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    task,
	})
}

// GetTaskCounts returns counts of tasks by status and due date
func (h *Handler) GetTaskCounts(c echo.Context) error {
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

	// Build the query based on the user's role
	query := `
		SELECT
			COUNT(*) FILTER (WHERE status = 'Open') AS open,
			COUNT(*) FILTER (WHERE status = 'In Progress') AS in_progress,
			COUNT(*) FILTER (WHERE status = 'Completed') AS completed,
			COUNT(*) FILTER (WHERE due_date < CURRENT_DATE AND status != 'Completed') AS overdue,
			COUNT(*) FILTER (WHERE DATE(due_date) = CURRENT_DATE) AS due_today,
			COUNT(*) FILTER (WHERE due_date BETWEEN (CURRENT_DATE + INTERVAL '1 day') AND (CURRENT_DATE + INTERVAL '7 days')) AS due_this_week,
			COUNT(*) AS total
		FROM tasks
	`

	// If not admin, only count tasks assigned to the user or created by the user
	if userRole != models.RoleAdmin {
		query += ` WHERE assigned_to_user_id = $1 OR created_by_user_id = $1`
	}

	// Execute the query
	var counts struct {
		Open        int `json:"open"`
		InProgress  int `json:"in_progress"`
		Completed   int `json:"completed"`
		Overdue     int `json:"overdue"`
		DueToday    int `json:"due_today"`
		DueThisWeek int `json:"due_this_week"`
		Total       int `json:"total"`
	}

	if userRole == models.RoleAdmin {
		err = h.db.Pool.QueryRow(ctx, query).Scan(
			&counts.Open,
			&counts.InProgress,
			&counts.Completed,
			&counts.Overdue,
			&counts.DueToday,
			&counts.DueThisWeek,
			&counts.Total,
		)
	} else {
		err = h.db.Pool.QueryRow(ctx, query, userID).Scan(
			&counts.Open,
			&counts.InProgress,
			&counts.Completed,
			&counts.Overdue,
			&counts.DueToday,
			&counts.DueThisWeek,
			&counts.Total,
		)
	}

	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to get task counts")
	}

	return c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    counts,
	})
}
