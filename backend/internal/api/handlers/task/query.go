// backend/internal/api/handlers/task/query.go
// ==========================================================================
// Handler functions for querying task data (listing, counts, details).
// Includes filtering, pagination, authorization, and data aggregation.
// ==========================================================================

package task

import (
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strings"

	"github.com/henrythedeveloper/it-ticket-system/internal/api/middleware/auth" // Auth helpers
	// Removed unused db import: "github.com/henrythedeveloper/it-ticket-system/internal/db"
	"github.com/henrythedeveloper/it-ticket-system/internal/models" // Data models
	"github.com/jackc/pgx/v5"
	"github.com/labstack/echo/v4"
)

// --- Handler Functions ---

// GetAllTasks retrieves a list of tasks based on query parameters for filtering and pagination.
// Applies role-based access control (RBAC) to filter results appropriately.
//
// Query Parameters:
//   - status: Filter by task status (e.g., "Open", "Completed").
//   - assigned_to: Filter by assignee ID, "me", or "unassigned".
//   - created_by: Filter by creator ID or "me".
//   - due_date: Filter by due date ("today", "week", "overdue").
//   - page: Page number for pagination (default: 1).
//   - limit: Number of tasks per page (default: 15).
//   - sort_by: Field to sort by (e.g., "due_date", "created_at").
//   - sort_order: Sort direction ("asc" or "desc").
//   - search: Search term for title/description.
//
// Returns:
//   - JSON response with paginated task data or an error response.
func (h *Handler) GetAllTasks(c echo.Context) error {
	ctx := c.Request().Context()
	logger := slog.With("handler", "GetAllTasks")

	// --- 1. Get User Context and Pagination/Filter Params ---
	userRole, err := auth.GetUserRoleFromContext(c)
	if err != nil {
		return err
	}
	userID, err := auth.GetUserIDFromContext(c)
	if err != nil {
		return err
	}

	// Extract filter parameters using helpers
	filters := models.TaskFilter{
		Status:     parseTaskStatus(c.QueryParam("status")),
		AssignedTo: parseAssigneeFilter(c.QueryParam("assigned_to"), userID),
		CreatedBy:  parseCreatorFilter(c.QueryParam("created_by"), userID),
		// TODO: Parse due date filters (DueFromDate, DueToDate) if needed
		// DueFromDate: parseDate(c.QueryParam("due_from_date")),
		// DueToDate:   parseDate(c.QueryParam("due_to_date")),
		IsRecurring: parseBoolPtr(c.QueryParam("is_recurring")),
		Search:      c.QueryParam("search"),
		Page:        parseInt(c.QueryParam("page"), 1),
		Limit:       parseInt(c.QueryParam("limit"), 15),
	}
	// Special due date filters
	dueDateFilter := c.QueryParam("due_date") // "today", "week", "overdue"

	logger.DebugContext(ctx, "Fetching tasks with filters", "filters", filters, "dueDateFilter", dueDateFilter, "userRole", userRole)

	// --- 2. Build SQL Query ---
	// ** IMPORTANT: For accurate pagination, a separate COUNT(*) query matching the WHERE clauses is needed. **
	// ** The COUNT(*) OVER() approach used here is less reliable and harder to manage with complex filters/joins. **
	// ** We will proceed with COUNT(*) OVER() for now but recommend refactoring to a separate count query. **
	countQueryBuilder := strings.Builder{}
	selectQueryBuilder := strings.Builder{}
	args := []interface{}{}
	paramCount := 0

	// Base SELECT clause
	selectQueryBuilder.WriteString(`
        SELECT
            t.id, t.task_number, t.title, t.description, t.status, t.assigned_to_user_id,
            t.created_by_user_id, t.due_date, t.is_recurring, t.recurrence_rule,
            t.created_at, t.updated_at, t.completed_at,
            -- Assignee details (nullable)
            a.id as assigned_user_id, a.name as assigned_user_name, a.email as assigned_user_email,
            a.role as assigned_user_role, a.created_at as assigned_user_created_at, a.updated_at as assigned_user_updated_at,
            -- Creator details (non-nullable)
            c.id as creator_user_id, c.name as creator_user_name, c.email as creator_user_email,
            c.role as creator_user_role, c.created_at as creator_user_created_at, c.updated_at as creator_user_updated_at
	`)
	// Base FROM and JOINs
	fromJoinClause := `
        FROM tasks t
        LEFT JOIN users a ON t.assigned_to_user_id = a.id
        JOIN users c ON t.created_by_user_id = c.id
    `
	selectQueryBuilder.WriteString(fromJoinClause)
	countQueryBuilder.WriteString("SELECT COUNT(*) ")
	countQueryBuilder.WriteString(fromJoinClause)

	// --- Apply WHERE clauses based on filters (apply to both queries) ---
	whereClauses := []string{"1=1"}

	if filters.Status != nil {
		paramCount++
		whereClauses = append(whereClauses, fmt.Sprintf("t.status = $%d", paramCount))
		args = append(args, *filters.Status)
	}
	if filters.AssignedTo != nil {
		if *filters.AssignedTo == "unassigned" {
			whereClauses = append(whereClauses, "t.assigned_to_user_id IS NULL")
		} else { // Assumes "me" was converted to actual userID
			paramCount++
			whereClauses = append(whereClauses, fmt.Sprintf("t.assigned_to_user_id = $%d", paramCount))
			args = append(args, *filters.AssignedTo)
		}
	}
	if filters.CreatedBy != nil { // Assumes "me" was converted
		paramCount++
		whereClauses = append(whereClauses, fmt.Sprintf("t.created_by_user_id = $%d", paramCount))
		args = append(args, *filters.CreatedBy)
	}
	if filters.IsRecurring != nil {
		paramCount++
		whereClauses = append(whereClauses, fmt.Sprintf("t.is_recurring = $%d", paramCount))
		args = append(args, *filters.IsRecurring)
	}

	// Apply special due date filters
	switch dueDateFilter {
	case "today":
		whereClauses = append(whereClauses, "DATE(t.due_date) = CURRENT_DATE")
	case "week":
		whereClauses = append(whereClauses, "t.due_date >= CURRENT_DATE AND t.due_date < (CURRENT_DATE + INTERVAL '7 days')")
	case "overdue":
		whereClauses = append(whereClauses, "t.due_date < CURRENT_DATE AND t.status != 'Completed'")
	}

	// --- RBAC Filter ---
	if userRole != models.RoleAdmin {
		paramCount++
		whereClauses = append(whereClauses, fmt.Sprintf("(t.created_by_user_id = $%d OR t.assigned_to_user_id = $%d)", paramCount, paramCount))
		args = append(args, userID)
	}

	// --- Search Filtering ---
	if filters.Search != "" {
		paramCount++
		searchPattern := "%" + filters.Search + "%"
		whereClauses = append(whereClauses, fmt.Sprintf("(t.title ILIKE $%d OR t.description ILIKE $%d)", paramCount, paramCount))
		args = append(args, searchPattern)
	}

	// Append WHERE clauses to both queries
	whereClauseStr := ""
	if len(whereClauses) > 1 {
		whereClauseStr = " WHERE " + strings.Join(whereClauses, " AND ")
		selectQueryBuilder.WriteString(whereClauseStr)
		countQueryBuilder.WriteString(whereClauseStr)
	}

	// --- Apply ORDER BY and Pagination (only to SELECT query) ---
	selectQueryBuilder.WriteString(" ORDER BY CASE WHEN t.due_date IS NULL THEN 1 ELSE 0 END, t.due_date ASC NULLS LAST, t.created_at DESC") // Prioritize tasks with due dates
	paramCount++
	selectQueryBuilder.WriteString(fmt.Sprintf(" LIMIT $%d", paramCount))
	args = append(args, filters.Limit)
	paramCount++
	selectQueryBuilder.WriteString(fmt.Sprintf(" OFFSET $%d", paramCount))
	args = append(args, (filters.Page-1)*filters.Limit)

	// --- 3. Execute Queries ---
	// Execute Count Query first
	countQuery := countQueryBuilder.String()
	// Use only the args needed for the WHERE clause for the count query
	countArgs := args[:paramCount-2] // Exclude LIMIT and OFFSET args
	logger.DebugContext(ctx, "Executing Task Count query", "query", countQuery, "args", countArgs)
	var totalCount int = 0
	err = h.db.Pool.QueryRow(ctx, countQuery, countArgs...).Scan(&totalCount)
	if err != nil {
		logger.ErrorContext(ctx, "Database count query failed", "error", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to count tasks.")
	}
	logger.DebugContext(ctx, "Task count retrieved", "totalCount", totalCount)

	// Execute Select Query
	selectQuery := selectQueryBuilder.String()
	logger.DebugContext(ctx, "Executing Task Select query", "query", selectQuery, "args", args)
	rows, err := h.db.Pool.Query(ctx, selectQuery, args...)
	if err != nil {
		logger.ErrorContext(ctx, "Database select query failed", "error", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to retrieve tasks.")
	}
	defer rows.Close()

	// --- 4. Scan Results ---
	tasks := make([]models.Task, 0, filters.Limit) // Pre-allocate slice capacity

	for rows.Next() {
		// Use the scanning helper function from utils.go
		task, scanErr := scanTaskWithUsers(rows) // Pass rows directly
		if scanErr != nil {
			logger.ErrorContext(ctx, "Failed to scan task row", "error", scanErr)
			// Consider returning partial results or failing completely
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to process task data.")
		}
		tasks = append(tasks, task)
	}

	if err = rows.Err(); err != nil {
		logger.ErrorContext(ctx, "Error iterating task rows", "error", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to process task results.")
	}

	// --- 5. Return Paginated Response ---
	totalPages := 0
	if totalCount > 0 && filters.Limit > 0 {
		totalPages = (totalCount + filters.Limit - 1) / filters.Limit // Calculate total pages
	}

	return c.JSON(http.StatusOK, models.PaginatedResponse{
		Success:    true,
		Message:    "Tasks retrieved successfully.",
		Data:       tasks,
		Total:      totalCount,
		Page:       filters.Page,
		Limit:      filters.Limit,
		TotalPages: totalPages,
		HasMore:    filters.Page < totalPages,
	})
}

// GetTaskByID retrieves details for a single task, including its updates/comments.
// Performs RBAC checks.
//
// Path Parameters:
//   - id: The UUID of the task to retrieve.
//
// Returns:
//   - JSON response with the full task details or an error response.
func (h *Handler) GetTaskByID(c echo.Context) error {
	ctx := c.Request().Context()
	taskID := c.Param("id")
	logger := slog.With("handler", "GetTaskByID", "taskUUID", taskID)

	if taskID == "" {
		logger.WarnContext(ctx, "Missing task ID in request path")
		return echo.NewHTTPError(http.StatusBadRequest, "Missing task ID.")
	}

	// --- 1. Get User Context ---
	userRole, err := auth.GetUserRoleFromContext(c)
	if err != nil {
		return err
	}
	userID, err := auth.GetUserIDFromContext(c)
	if err != nil {
		return err
	}

	// --- 2. Fetch Core Task Data ---
	// Query includes joins for creator and assignee details
	query := `
        SELECT
            t.id, t.task_number, t.title, t.description, t.status, t.assigned_to_user_id,
            t.created_by_user_id, t.due_date, t.is_recurring, t.recurrence_rule,
            t.created_at, t.updated_at, t.completed_at,
            -- Assignee details
            a.id, a.name, a.email, a.role, a.created_at, a.updated_at,
            -- Creator details
            c.id, c.name, c.email, c.role, c.created_at, c.updated_at
        FROM tasks t
        LEFT JOIN users a ON t.assigned_to_user_id = a.id
        JOIN users c ON t.created_by_user_id = c.id
        WHERE t.id = $1
    `
	row := h.db.Pool.QueryRow(ctx, query, taskID)

	// Use the scanning helper
	task, err := scanTaskWithUsers(row)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			logger.WarnContext(ctx, "Task not found")
			return echo.NewHTTPError(http.StatusNotFound, "Task not found.")
		}
		logger.ErrorContext(ctx, "Failed to query task by ID", "error", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to retrieve task details.")
	}

	// --- 3. RBAC Check ---
	// Use the checkTaskAccess helper function
	if _, authErr := checkTaskAccess(ctx, h.db, taskID, userID, userRole); authErr != nil {
		logger.WarnContext(ctx, "Authorization failed for task access", "error", authErr)
		if authErr.Error() == "not authorized to access this task" {
			return echo.NewHTTPError(http.StatusForbidden, authErr.Error())
		}
		// Handle other potential errors from checkTaskAccess if necessary
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to verify task access.")
	}
	logger.DebugContext(ctx, "Access granted for task")

	// --- 4. Fetch Task Updates/Comments ---
	// Pass h.db to the helper function
	updates, err := getTaskUpdates(ctx, h.db, taskID)
	if err != nil {
		logger.ErrorContext(ctx, "Failed to get task updates", "error", err)
		task.Updates = []models.TaskUpdate{} // Return empty slice on error
	} else {
		task.Updates = updates // Assign fetched updates
	}

	// --- 5. Return Success Response ---
	logger.DebugContext(ctx, "Successfully retrieved task details", "taskNumber", task.TaskNumber, "updateCount", len(task.Updates))
	return c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    task, // Return the full task object with users and updates
	})
}

// GetTaskCounts retrieves counts of tasks grouped by status and due date categories.
// Applies RBAC filters for non-admin users.
//
// Returns:
//   - JSON response with task counts or an error response.
func (h *Handler) GetTaskCounts(c echo.Context) error {
	ctx := c.Request().Context()
	logger := slog.With("handler", "GetTaskCounts")

	// --- 1. Get User Context ---
	userRole, err := auth.GetUserRoleFromContext(c)
	if err != nil {
		return err
	}
	userID, err := auth.GetUserIDFromContext(c)
	if err != nil {
		return err
	}

	// --- 2. Build Query ---
	queryBuilder := strings.Builder{}
	queryBuilder.WriteString(`
        SELECT
            COUNT(*) FILTER (WHERE status = 'Open') AS open,
            COUNT(*) FILTER (WHERE status = 'In Progress') AS in_progress,
            COUNT(*) FILTER (WHERE status = 'Completed') AS completed,
            COUNT(*) FILTER (WHERE due_date < CURRENT_DATE AND status != 'Completed') AS overdue,
            COUNT(*) FILTER (WHERE DATE(due_date) = CURRENT_DATE) AS due_today,
            COUNT(*) FILTER (WHERE due_date >= CURRENT_DATE AND due_date < (CURRENT_DATE + INTERVAL '7 days')) AS due_this_week,
            COUNT(*) AS total
        FROM tasks
    `)
	args := []interface{}{}

	// Apply RBAC filter for non-admins
	if userRole != models.RoleAdmin {
		queryBuilder.WriteString(" WHERE created_by_user_id = $1 OR assigned_to_user_id = $1")
		args = append(args, userID)
	}

	// --- 3. Execute Query ---
	finalQuery := queryBuilder.String()
	logger.DebugContext(ctx, "Executing GetTaskCounts query", "query", finalQuery, "args", args)

	var counts struct {
		Open        int `json:"open"`
		InProgress  int `json:"in_progress"`
		Completed   int `json:"completed"`
		Overdue     int `json:"overdue"`
		DueToday    int `json:"due_today"`
		DueThisWeek int `json:"due_this_week"`
		Total       int `json:"total"`
	}

	err = h.db.Pool.QueryRow(ctx, finalQuery, args...).Scan(
		&counts.Open, &counts.InProgress, &counts.Completed,
		&counts.Overdue, &counts.DueToday, &counts.DueThisWeek,
		&counts.Total,
	)
	if err != nil {
		logger.ErrorContext(ctx, "Failed to execute GetTaskCounts query", "error", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to retrieve task counts.")
	}

	// --- 4. Return Response ---
	logger.DebugContext(ctx, "Task counts retrieved successfully", "counts", counts)
	return c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    counts,
	})
}

// --- Helper Function ---

// parseCreatorFilter handles "me" or a specific user ID string for created_by filter.
func parseCreatorFilter(creatorStr, currentUserID string) *string {
	if creatorStr == "me" {
		if currentUserID != "" {
			return &currentUserID // Replace "me" with actual user ID
		}
		return nil // Cannot filter by "me" if user ID is unknown
	}
	if creatorStr != "" {
		// Assume it's a specific user ID
		return &creatorStr
	}
	return nil // Empty or invalid creator filter
}
