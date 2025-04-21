package task

import (
	"context" 
	"errors"
	"fmt"
	"log/slog" 
	"net/http"
	"time"

	"github.com/henrythedeveloper/bus-it-ticket/internal/api/middleware/auth"
	"github.com/henrythedeveloper/bus-it-ticket/internal/models" // Use models package
	"github.com/jackc/pgx/v5"
	"github.com/labstack/echo/v4"
)

// --- GetAllTasks and GetTaskCounts functions remain the same as before ---

// GetAllTasks returns all tasks with filtering
func (h *Handler) GetAllTasks(c echo.Context) error {
	// ... (Keep existing GetAllTasks implementation) ...
	ctx := c.Request().Context()
	userRole, err := auth.GetUserRoleFromContext(c)
	if err != nil { return err }
	userID, err := auth.GetUserIDFromContext(c)
	if err != nil { return err }

	query := `
		SELECT t.id, t.task_number, t.title, t.description, t.status, t.assigned_to_user_id, t.created_by_user_id,
			t.due_date, t.is_recurring, t.recurrence_rule, t.created_at, t.updated_at, t.completed_at,
			a.id as assigned_user_id, a.name as assigned_user_name, a.email as assigned_user_email, a.role as assigned_user_role, a.created_at as assigned_user_created_at, a.updated_at as assigned_user_updated_at,
			c.id as creator_user_id, c.name as creator_user_name, c.email as creator_user_email, c.role as creator_user_role, c.created_at as creator_user_created_at, c.updated_at as creator_user_updated_at
		FROM tasks t
		LEFT JOIN users a ON t.assigned_to_user_id = a.id
		LEFT JOIN users c ON t.created_by_user_id = c.id
		WHERE 1=1
	` 
	args := []interface{}{}
	paramCount := 1 

	status := c.QueryParam("status")
	if status != "" { query += fmt.Sprintf(" AND t.status = $%d", paramCount); args = append(args, status); paramCount++ }
	assignedTo := c.QueryParam("assigned_to")
	if assignedTo != "" {
		if assignedTo == "me" { query += fmt.Sprintf(" AND t.assigned_to_user_id = $%d", paramCount); args = append(args, userID); paramCount++
		} else if assignedTo == "unassigned" { query += " AND t.assigned_to_user_id IS NULL"
		} else { query += fmt.Sprintf(" AND t.assigned_to_user_id = $%d", paramCount); args = append(args, assignedTo); paramCount++ }
	}
	createdBy := c.QueryParam("created_by")
	if createdBy != "" {
		if createdBy == "me" { query += fmt.Sprintf(" AND t.created_by_user_id = $%d", paramCount); args = append(args, userID); paramCount++
		} else { query += fmt.Sprintf(" AND t.created_by_user_id = $%d", paramCount); args = append(args, createdBy); paramCount++ }
	}
	if userRole != models.RoleAdmin { query += fmt.Sprintf(" AND (t.assigned_to_user_id = $%d OR t.created_by_user_id = $%d)", paramCount, paramCount); args = append(args, userID); paramCount++ }
	dueDate := c.QueryParam("due_date")
	if dueDate == "today" { query += " AND DATE(t.due_date) = CURRENT_DATE"
	} else if dueDate == "week" { query += " AND t.due_date >= CURRENT_DATE AND t.due_date < (CURRENT_DATE + INTERVAL '7 days')"
	} else if dueDate == "overdue" { query += " AND t.due_date < CURRENT_DATE AND t.status != 'Completed'" }
	query += " ORDER BY CASE WHEN t.due_date IS NULL THEN 1 ELSE 0 END, t.due_date ASC NULLS LAST, t.created_at DESC" 

	slog.DebugContext(ctx, "Executing GetAllTasks query", "query", query, "args", args)
	rows, err := h.db.Pool.Query(ctx, query, args...)
	if err != nil { slog.ErrorContext(ctx, "Failed to execute GetAllTasks query", "error", err); return echo.NewHTTPError(http.StatusInternalServerError, "failed to get tasks") }
	defer rows.Close()

	var tasks []models.Task
	for rows.Next() {
		var task models.Task; var assignedToUser models.User; var createdByUser models.User
		var assignedUserID, assignedUserName, assignedUserEmail, assignedUserRole *string; var assignedUserCreatedAt, assignedUserUpdatedAt *time.Time
		var creatorUserID, creatorUserName, creatorUserEmail, creatorUserRole string; var creatorUserCreatedAt, creatorUserUpdatedAt time.Time
		if err := rows.Scan(
			&task.ID, &task.TaskNumber, &task.Title, &task.Description, &task.Status, &task.AssignedToUserID, &task.CreatedByUserID,
			&task.DueDate, &task.IsRecurring, &task.RecurrenceRule, &task.CreatedAt, &task.UpdatedAt, &task.CompletedAt,
			&assignedUserID, &assignedUserName, &assignedUserEmail, &assignedUserRole, &assignedUserCreatedAt, &assignedUserUpdatedAt,
			&creatorUserID, &creatorUserName, &creatorUserEmail, &creatorUserRole, &creatorUserCreatedAt, &creatorUserUpdatedAt,
		); err != nil { slog.ErrorContext(ctx, "Failed to scan task row in GetAllTasks", "error", err); return echo.NewHTTPError(http.StatusInternalServerError, "failed to scan task data") }
		if task.AssignedToUserID != nil && assignedUserID != nil {
			assignedToUser = models.User{ ID: *assignedUserID, Name: *assignedUserName, Email: *assignedUserEmail, Role: models.UserRole(*assignedUserRole), CreatedAt: *assignedUserCreatedAt, UpdatedAt: *assignedUserUpdatedAt, }; task.AssignedToUser = &assignedToUser
		}
		createdByUser = models.User{ ID: creatorUserID, Name: creatorUserName, Email: creatorUserEmail, Role: models.UserRole(creatorUserRole), CreatedAt: creatorUserCreatedAt, UpdatedAt: creatorUserUpdatedAt, }; task.CreatedByUser = &createdByUser 
		tasks = append(tasks, task)
	}
	if err := rows.Err(); err != nil { slog.ErrorContext(ctx, "Error iterating task rows in GetAllTasks", "error", err); return echo.NewHTTPError(http.StatusInternalServerError, "failed to process tasks") }
	return c.JSON(http.StatusOK, models.APIResponse{ Success: true, Data: tasks, })
}


// GetTaskByID returns a task by ID, including its updates
func (h *Handler) GetTaskByID(c echo.Context) error {
	taskID := c.Param("id")
	if taskID == "" { slog.Warn("GetTaskByID called with missing task ID"); return echo.NewHTTPError(http.StatusBadRequest, "missing task ID") }
	ctx := c.Request().Context()
	userRole, err := auth.GetUserRoleFromContext(c); if err != nil { return err }
	userID, err := auth.GetUserIDFromContext(c); if err != nil { return err }

	// Get task details from database
	var task models.Task
	var assignedToUser models.User; var createdByUser models.User
	var assignedUserID, assignedUserName, assignedUserEmail, assignedUserRole *string; var assignedUserCreatedAt, assignedUserUpdatedAt *time.Time
	var creatorUserID, creatorUserName, creatorUserEmail, creatorUserRole string; var creatorUserCreatedAt, creatorUserUpdatedAt time.Time

	err = h.db.Pool.QueryRow(ctx, `
		SELECT t.id, t.task_number, t.title, t.description, t.status, t.assigned_to_user_id, t.created_by_user_id,
			t.due_date, t.is_recurring, t.recurrence_rule, t.created_at, t.updated_at, t.completed_at,
			a.id as assigned_user_id, a.name as assigned_user_name, a.email as assigned_user_email, a.role as assigned_user_role, a.created_at as assigned_user_created_at, a.updated_at as assigned_user_updated_at,
			c.id as creator_user_id, c.name as creator_user_name, c.email as creator_user_email, c.role as creator_user_role, c.created_at as creator_user_created_at, c.updated_at as creator_user_updated_at
		FROM tasks t
		LEFT JOIN users a ON t.assigned_to_user_id = a.id
		LEFT JOIN users c ON t.created_by_user_id = c.id
		WHERE t.id = $1
	`, taskID).Scan(
		&task.ID, &task.TaskNumber, &task.Title, &task.Description, &task.Status, &task.AssignedToUserID, &task.CreatedByUserID,
		&task.DueDate, &task.IsRecurring, &task.RecurrenceRule, &task.CreatedAt, &task.UpdatedAt, &task.CompletedAt,
		&assignedUserID, &assignedUserName, &assignedUserEmail, &assignedUserRole, &assignedUserCreatedAt, &assignedUserUpdatedAt,
		&creatorUserID, &creatorUserName, &creatorUserEmail, &creatorUserRole, &creatorUserCreatedAt, &creatorUserUpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) { slog.WarnContext(ctx, "Task not found", "taskID", taskID); return echo.NewHTTPError(http.StatusNotFound, "task not found") }
		slog.ErrorContext(ctx, "Failed to query task by ID", "taskID", taskID, "error", err); return echo.NewHTTPError(http.StatusInternalServerError, "failed to get task details")
	}

	// Authorization Check
	isAssignee := task.AssignedToUserID != nil && *task.AssignedToUserID == userID
	if userRole != models.RoleAdmin && task.CreatedByUserID != userID && !isAssignee {
		slog.WarnContext(ctx, "Unauthorized attempt to view task", "taskID", taskID, "requestingUserID", userID); return echo.NewHTTPError(http.StatusForbidden, "not authorized to view this task")
	}

	// Populate assigned user
	if task.AssignedToUserID != nil && assignedUserID != nil {
		assignedToUser = models.User{ ID: *assignedUserID, Name: *assignedUserName, Email: *assignedUserEmail, Role: models.UserRole(*assignedUserRole), CreatedAt: *assignedUserCreatedAt, UpdatedAt: *assignedUserUpdatedAt, }; task.AssignedToUser = &assignedToUser
	}
	// Populate created by user
	createdByUser = models.User{ ID: creatorUserID, Name: creatorUserName, Email: creatorUserEmail, Role: models.UserRole(creatorUserRole), CreatedAt: creatorUserCreatedAt, UpdatedAt: creatorUserUpdatedAt, }; task.CreatedByUser = &createdByUser

	// --- Fetch Task Updates (using updated helper) ---
	taskUpdates, err := h.getTaskUpdates(ctx, taskID, userID, userRole, task.AssignedToUserID)
	if err != nil {
		slog.ErrorContext(ctx, "Failed to get task updates", "taskID", taskID, "error", err)
		task.Updates = []models.TaskUpdate{} // Initialize as empty slice on error
	} else {
		task.Updates = taskUpdates // Assign fetched updates
	}
	// --- END Fetch Task Updates ---

	slog.DebugContext(ctx, "Successfully retrieved task details", "taskID", taskID, "taskNumber", task.TaskNumber, "updateCount", len(task.Updates))
	return c.JSON(http.StatusOK, models.APIResponse{ Success: true, Data: task, })
}


// --- UPDATED HELPER FUNCTION: getTaskUpdates ---
// Fetches updates for a specific task, uses TaskUpdate struct
func (h *Handler) getTaskUpdates(
	ctx context.Context,
	taskID string,
	requestingUserID string,
	requestingUserRole models.UserRole,
	taskAssignedToUserID *string, 
) ([]models.TaskUpdate, error) { // Return type is now []models.TaskUpdate

	query := `
		SELECT tu.id, tu.task_id, tu.user_id, tu.comment, tu.created_at, 
		       u.id as update_user_id, u.name as update_user_name, u.email as update_user_email, u.role as update_user_role, 
			   u.created_at as update_user_created_at, u.updated_at as update_user_updated_at
		FROM task_updates tu -- Query task_updates table
		LEFT JOIN users u ON tu.user_id = u.id 
		WHERE tu.task_id = $1
		ORDER BY tu.created_at ASC 
	`
	rows, err := h.db.Pool.Query(ctx, query, taskID)
	if err != nil {
		return nil, fmt.Errorf("failed to query task updates: %w", err)
	}
	defer rows.Close()

	var updates []models.TaskUpdate // Use TaskUpdate slice
	for rows.Next() {
		var update models.TaskUpdate // Use TaskUpdate struct
		var updateUser models.User
		var updateUserID, updateUserName, updateUserEmail, updateUserRole *string
		var updateUserCreatedAt, updateUserUpdatedAt *time.Time

		// Scan into TaskUpdate fields
		err := rows.Scan(
			&update.ID,
			&update.TaskID, // Scan task_id
			&update.UserID, // user_id from task_updates
			&update.Comment,
			// &update.IsInternalNote, // Add if using this field
			&update.CreatedAt,
			// User details
			&updateUserID, 
			&updateUserName,
			&updateUserEmail,
			&updateUserRole,
			&updateUserCreatedAt,
			&updateUserUpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan task update row: %w", err)
		}

		// Populate nested User struct
		if updateUserID != nil && updateUserName != nil {
			update.UserID = updateUserID 
			updateUser = models.User{
				ID: *updateUserID, Name: *updateUserName, Email: *updateUserEmail,
				Role: models.UserRole(*updateUserRole), CreatedAt: *updateUserCreatedAt, UpdatedAt: *updateUserUpdatedAt,
			}
			update.User = &updateUser
		}

		// Optional: Internal Note Filtering Logic (if implemented)
		// if update.IsInternalNote && requestingUserRole != models.RoleAdmin { ... }

		updates = append(updates, update)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating task update rows: %w", err)
	}

	return updates, nil // Return []models.TaskUpdate
}
// --- END UPDATED HELPER FUNCTION ---


// GetTaskCounts returns counts of tasks by status and due date
func (h *Handler) GetTaskCounts(c echo.Context) error {
	// ... (Keep existing GetTaskCounts implementation) ...
	ctx := c.Request().Context()
	userID, err := auth.GetUserIDFromContext(c); if err != nil { return err }
	userRole, err := auth.GetUserRoleFromContext(c); if err != nil { return err }

	query := `
		SELECT
			COUNT(*) FILTER (WHERE status = 'Open') AS open,
			COUNT(*) FILTER (WHERE status = 'In Progress') AS in_progress,
			COUNT(*) FILTER (WHERE status = 'Completed') AS completed,
			COUNT(*) FILTER (WHERE due_date < CURRENT_DATE AND status != 'Completed') AS overdue,
			COUNT(*) FILTER (WHERE DATE(due_date) = CURRENT_DATE) AS due_today,
			COUNT(*) FILTER (WHERE due_date >= (CURRENT_DATE + INTERVAL '1 day') AND due_date < (CURRENT_DATE + INTERVAL '8 days')) AS due_this_week, 
			COUNT(*) AS total
		FROM tasks
	` 
	args := []interface{}{}
	paramCount := 1 
	if userRole != models.RoleAdmin { query += fmt.Sprintf(" WHERE assigned_to_user_id = $%d OR created_by_user_id = $%d", paramCount, paramCount); args = append(args, userID); paramCount++ }

	var counts struct {
		Open int `json:"open"`; InProgress int `json:"in_progress"`; Completed int `json:"completed"`
		Overdue int `json:"overdue"`; DueToday int `json:"due_today"`; DueThisWeek int `json:"due_this_week"`
		Total int `json:"total"`
	}
	slog.DebugContext(ctx, "Executing GetTaskCounts query", "query", query, "args", args)
	err = h.db.Pool.QueryRow(ctx, query, args...).Scan( &counts.Open, &counts.InProgress, &counts.Completed, &counts.Overdue, &counts.DueToday, &counts.DueThisWeek, &counts.Total, )
	if err != nil { slog.ErrorContext(ctx, "Failed to execute GetTaskCounts query", "error", err); return echo.NewHTTPError(http.StatusInternalServerError, "failed to get task counts") }
	return c.JSON(http.StatusOK, models.APIResponse{ Success: true, Data: counts, })
}

