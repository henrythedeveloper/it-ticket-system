// backend/internal/api/handlers/task/query.go
// ==========================================================================
// Handler functions for querying task data (listing, details, counts).
// **REVISED**: Updated SQL queries to use snake_case column names.
// **REVISED AGAIN**: Refactored helper functions for readability.

// ==========================================================================

package task

import (
	// "context" // Removed unused import
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/henrythedeveloper/it-ticket-system/internal/api/middleware/auth"
	"github.com/henrythedeveloper/it-ticket-system/internal/models"
	"github.com/jackc/pgx/v5"
	"github.com/labstack/echo/v4"
)

// GetAllTasks retrieves a list of tasks based on query parameters.
func (h *Handler) GetAllTasks(c echo.Context) error {
	ctx := c.Request().Context() // Use context from request
	logger := slog.With("handler", "GetAllTasks")

	// --- 1. Get User Context and Filters ---
	userID, err := auth.GetUserIDFromContext(c)
	if err != nil { return err }

	filters := models.TaskFilter{
		Status:       parseTaskStatus(c.QueryParam("status")),
		AssignedTo:   parseAssigneeFilter(c.QueryParam("assignee_id"), userID),
		CreatedBy:    parseStringPtr(c.QueryParam("created_by")),
		DueFromDate:  parseDate(c.QueryParam("due_from_date")),
		DueToDate:    parseDate(c.QueryParam("due_to_date")),
		IsRecurring:  parseBoolPtr(c.QueryParam("is_recurring")),
		Search:       c.QueryParam("search"),
		Page:         parseInt(c.QueryParam("page"), 1),
		Limit:        parseInt(c.QueryParam("limit"), 15),
		SortBy:       parseSortBy(c.QueryParam("sort_by"), "created_at", []string{"created_at", "updated_at", "due_date", "title", "status"}),
		SortOrder:    parseSortOrder(c.QueryParam("sort_order"), "desc"),
	}
	logger.DebugContext(ctx, "Fetching tasks with filters", "filters", filters)

	// --- 2. Build SQL Query ---
	queryBuilder := strings.Builder{}
	queryBuilder.WriteString(`
        SELECT
            t.id, t.task_number, t.title, t.description, t.status,
            t.assigned_to_user_id, t.created_by_user_id, t.due_date, t.is_recurring,
            t.recurrence_rule, t.created_at, t.updated_at, t.completed_at, t.task_number,
            a.id as assigned_user_id_col, a.name as assigned_user_name, a.email as assigned_user_email,
            a.role as assigned_user_role, a.created_at as assigned_user_created_at, a.updated_at as assigned_user_updated_at,
            cb.id as created_by_user_id_col, cb.name as created_by_user_name, cb.email as created_by_user_email,
            cb.role as created_by_user_role, cb.created_at as created_by_user_created_at, cb.updated_at as created_by_user_updated_at,
            COUNT(*) OVER() AS total_count
        FROM tasks t
        LEFT JOIN users a ON t.assigned_to_user_id = a.id
        LEFT JOIN users cb ON t.created_by_user_id = cb.id
    `)
	args := []interface{}{}
	paramCount := 0
	whereClauses := []string{"1=1"}

	// Apply WHERE clauses (logic remains the same)
	if filters.Status != nil { paramCount++; whereClauses = append(whereClauses, fmt.Sprintf("t.status = $%d", paramCount)); args = append(args, *filters.Status) }
	if filters.AssignedTo != nil { if *filters.AssignedTo == "unassigned" { whereClauses = append(whereClauses, "t.assigned_to_user_id IS NULL") } else { paramCount++; whereClauses = append(whereClauses, fmt.Sprintf("t.assigned_to_user_id = $%d", paramCount)); args = append(args, *filters.AssignedTo) } }
	if filters.CreatedBy != nil { paramCount++; whereClauses = append(whereClauses, fmt.Sprintf("t.created_by_user_id = $%d", paramCount)); args = append(args, *filters.CreatedBy) }
	if filters.DueFromDate != nil { paramCount++; whereClauses = append(whereClauses, fmt.Sprintf("t.due_date >= $%d", paramCount)); args = append(args, *filters.DueFromDate) }
	if filters.DueToDate != nil { paramCount++; whereClauses = append(whereClauses, fmt.Sprintf("t.due_date <= $%d", paramCount)); args = append(args, (*filters.DueToDate).Add(24*time.Hour-time.Nanosecond)) }
	if filters.IsRecurring != nil { paramCount++; whereClauses = append(whereClauses, fmt.Sprintf("t.is_recurring = $%d", paramCount)); args = append(args, *filters.IsRecurring) }
	if filters.Search != "" { paramCount++; searchPattern := "%" + filters.Search + "%"; whereClauses = append(whereClauses, fmt.Sprintf("(t.title ILIKE $%d OR t.description ILIKE $%d)", paramCount, paramCount)); args = append(args, searchPattern) }

	if len(whereClauses) > 1 { queryBuilder.WriteString(" WHERE " + strings.Join(whereClauses, " AND ")) }

	// Apply ORDER BY and Pagination (logic remains the same)
	orderByClause := fmt.Sprintf(" ORDER BY t.%s %s, t.id %s", filters.SortBy, filters.SortOrder, filters.SortOrder)
	queryBuilder.WriteString(orderByClause)
	paramCount++; queryBuilder.WriteString(fmt.Sprintf(" LIMIT $%d", paramCount)); args = append(args, filters.Limit)
	paramCount++; queryBuilder.WriteString(fmt.Sprintf(" OFFSET $%d", paramCount)); args = append(args, (filters.Page-1)*filters.Limit)

	// --- 3. Execute Query ---
	finalQuery := queryBuilder.String()
	logger.DebugContext(ctx, "Executing GetAllTasks query", "query", finalQuery, "args", args)

	rows, err := h.db.Pool.Query(ctx, finalQuery, args...)
	if err != nil { logger.ErrorContext(ctx, "Database query failed", "error", err); return echo.NewHTTPError(http.StatusInternalServerError, "Failed to retrieve tasks.") }
	defer rows.Close()

	// --- 4. Scan Results ---
	tasks := make([]models.Task, 0)
	var totalCount int = 0

	for rows.Next() {
		var task models.Task
		var assignedUser models.User
		var createdByUser models.User
		var assignedUserIDCol, assignedUserName, assignedUserEmail, assignedUserRole *string
		var assignedUserCreatedAt, assignedUserUpdatedAt *time.Time
		var createdByUserIDCol, createdByUserName, createdByUserEmail, createdByUserRole *string
		var createdByUserCreatedAt, createdByUserUpdatedAt *time.Time

		// Scan into task.TaskNumber
		scanErr := rows.Scan(
			&task.ID, &task.TaskNumber, &task.Title, &task.Description, &task.Status,
			&task.AssignedToUserID, &task.CreatedByUserID, &task.DueDate, &task.IsRecurring,
			&task.RecurrenceRule, &task.CreatedAt, &task.UpdatedAt, &task.CompletedAt, &task.TaskNumber, // Scan into TaskNumber
			&assignedUserIDCol, &assignedUserName, &assignedUserEmail, &assignedUserRole,
			&assignedUserCreatedAt, &assignedUserUpdatedAt,
			&createdByUserIDCol, &createdByUserName, &createdByUserEmail, &createdByUserRole,
			&createdByUserCreatedAt, &createdByUserUpdatedAt,
			&totalCount,
		)
		if scanErr != nil { logger.ErrorContext(ctx, "Failed to scan task row", "error", scanErr); return echo.NewHTTPError(http.StatusInternalServerError, "Failed to process task data.") }

		if task.AssignedToUserID != nil && assignedUserIDCol != nil { assignedUser = models.User{ ID: *assignedUserIDCol, Name: *assignedUserName, Email: *assignedUserEmail, Role: models.UserRole(*assignedUserRole), CreatedAt: *assignedUserCreatedAt, UpdatedAt: *assignedUserUpdatedAt, }; task.AssignedToUser = &assignedUser }
		if createdByUserIDCol != nil { createdByUser = models.User{ ID: *createdByUserIDCol, Name: *createdByUserName, Email: *createdByUserEmail, Role: models.UserRole(*createdByUserRole), CreatedAt: *createdByUserCreatedAt, UpdatedAt: *createdByUserUpdatedAt, }; task.CreatedByUser = &createdByUser }

		tasks = append(tasks, task)
	}

	if err = rows.Err(); err != nil { logger.ErrorContext(ctx, "Error iterating task rows", "error", err); return echo.NewHTTPError(http.StatusInternalServerError, "Failed to process task results.") }

	// --- 5. Return Paginated Response ---
	totalPages := 0
	if totalCount > 0 { totalPages = (totalCount + filters.Limit - 1) / filters.Limit }

	return c.JSON(http.StatusOK, models.PaginatedResponse{ Success: true, Message: "Tasks retrieved successfully.", Data: tasks, Total: totalCount, Page: filters.Page, Limit: filters.Limit, TotalPages: totalPages, HasMore: filters.Page < totalPages, })
}


// GetTaskByID retrieves details for a single task.
func (h *Handler) GetTaskByID(c echo.Context) error {
	ctx := c.Request().Context() // Use context from request
	taskID := c.Param("id")
	logger := slog.With("handler", "GetTaskByID", "taskUUID", taskID)

	if taskID == "" { logger.WarnContext(ctx, "Missing task ID in request path"); return echo.NewHTTPError(http.StatusBadRequest, "Missing task ID.") }

	// Use the single query with joins
	row := h.db.Pool.QueryRow(ctx, `
        SELECT
            t.id, t.task_number, t.title, t.description, t.status,
            t.assigned_to_user_id, t.created_by_user_id, t.due_date, t.is_recurring,
            t.recurrence_rule, t.created_at, t.updated_at, t.completed_at,
            a.id as assigned_user_id_col, a.name as assigned_user_name, a.email as assigned_user_email,
            a.role as assigned_user_role, a.created_at as assigned_user_created_at, a.updated_at as assigned_user_updated_at,
            cb.id as created_by_user_id_col, cb.name as created_by_user_name, cb.email as created_by_user_email,
            cb.role as created_by_user_role, cb.created_at as created_by_user_created_at, cb.updated_at as created_by_user_updated_at
        FROM tasks t
        LEFT JOIN users a ON t.assigned_to_user_id = a.id
        LEFT JOIN users cb ON t.created_by_user_id = cb.id
        WHERE t.id = $1
    `, taskID)

	// Use the corrected scan utility function
	task, err := scanTaskWithUsers(row)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) { logger.WarnContext(ctx, "Task not found"); return echo.NewHTTPError(http.StatusNotFound, "Task not found.") }
		logger.ErrorContext(ctx, "Failed to scan task details", "error", err); return echo.NewHTTPError(http.StatusInternalServerError, "Failed to retrieve task details.")
	}


	// Fetch related task updates if needed (could be concurrent)
	updates, updatesErr := getTaskUpdates(ctx, h.db, taskID)
	if updatesErr != nil {
		logger.ErrorContext(ctx, "Failed to fetch task updates", "error", updatesErr)
		// Decide whether to return partial data or an error
		// return echo.NewHTTPError(http.StatusInternalServerError, "Failed to retrieve task updates.")
	}
	task.Updates = updates // Assign updates even if there was an error fetching them (might be nil)


	// Log final data before sending
	jsonData, jsonErr := json.MarshalIndent(task, "", "  ")
	if jsonErr != nil { logger.ErrorContext(ctx, "Failed to marshal final task data for logging", "error", jsonErr)
	} else { logger.DebugContext(ctx, "Final task data being sent in response", "taskData", string(jsonData)) }


	logger.DebugContext(ctx, "Successfully retrieved task details")
	return c.JSON(http.StatusOK, models.APIResponse{ Success: true, Data: task, })
}

// --- Helper Functions (Parsing Query Params) ---
// Keep helpers here as they are specific to task query params


// Helper to scan row without total_count (fallback)
func scanTaskWithUsersNoCount(row pgx.Row) (models.Task, error) {
	var task models.Task
	var assignedUser models.User
	var createdByUser models.User
	var assignedUserIDCol, assignedUserName, assignedUserEmail, assignedUserRole *string
	var assignedUserCreatedAt, assignedUserUpdatedAt *time.Time
	var createdByUserIDCol, createdByUserName, createdByUserEmail, createdByUserRole *string
	var createdByUserCreatedAt, createdByUserUpdatedAt *time.Time

	scanErr := row.Scan(
		&task.ID, &task.TaskNumber, &task.Title, &task.Description, &task.Status,
		&task.AssignedToUserID, &task.CreatedByUserID, &task.DueDate, &task.IsRecurring,
		&task.RecurrenceRule, &task.CreatedAt, &task.UpdatedAt, &task.CompletedAt,
		&assignedUserIDCol, &assignedUserName, &assignedUserEmail, &assignedUserRole,
		&assignedUserCreatedAt, &assignedUserUpdatedAt,
		&createdByUserIDCol, &createdByUserName, &createdByUserEmail, &createdByUserRole,
		&createdByUserCreatedAt, &createdByUserUpdatedAt,
	)
	if scanErr != nil { return task, scanErr }

	if task.AssignedToUserID != nil && assignedUserIDCol != nil { assignedUser = models.User{ ID: *assignedUserIDCol, Name: *assignedUserName, Email: *assignedUserEmail, Role: models.UserRole(*assignedUserRole), CreatedAt: *assignedUserCreatedAt, UpdatedAt: *assignedUserUpdatedAt, }; task.AssignedToUser = &assignedUser }
	if createdByUserIDCol != nil { createdByUser = models.User{ ID: *createdByUserIDCol, Name: *createdByUserName, Email: *createdByUserEmail, Role: models.UserRole(*createdByUserRole), CreatedAt: *createdByUserCreatedAt, UpdatedAt: *createdByUserUpdatedAt, }; task.CreatedByUser = &createdByUser }

	return task, nil
}

// Helper to build the COUNT query separately
func buildCountQuery(whereClauses []string, args []interface{}) (string, []interface{}) {
	query := "SELECT COUNT(*) FROM tasks t"
	if len(whereClauses) > 1 {
		query += " WHERE " + strings.Join(whereClauses[1:], " AND ") // Skip the dummy '1=1'
	}
	return query, args
}


// parseTaskStatus validates the task status string and returns a pointer or nil.
func parseTaskStatus(statusStr string) *models.TaskStatus {
	s := models.TaskStatus(statusStr)
	switch s {
	case models.TaskStatusOpen, models.TaskStatusInProgress, models.TaskStatusCompleted:
		return &s
	default:
		return nil // Invalid or empty status
	}
}

// parseAssigneeFilter handles "me", "unassigned", or a specific user ID.
func parseAssigneeFilter(assigneeStr, currentUserID string) *string {
	if assigneeStr == "me" {
		if currentUserID != "" {
			return &currentUserID // Replace "me" with actual user ID
		}
		slog.Warn("Assignee filter 'me' used but currentUserID is empty")
		return nil
	}
	if assigneeStr == "unassigned" || assigneeStr != "" {
		return &assigneeStr
	}
	return nil
}

// parseInt parses an integer from a string, returning a default value on error or empty string.
func parseInt(valueStr string, defaultValue int) int {
	if valueStr == "" {
		return defaultValue
	}
	value, err := strconv.Atoi(valueStr)
	if err != nil || value <= 0 {
		return defaultValue
	}
	return value
}

// parseStringPtr returns a pointer to the string if it's not empty, otherwise nil.
func parseStringPtr(value string) *string {
	if value == "" {
		return nil
	}
	return &value
}

// parseDate parses a YYYY-MM-DD string into a *time.Time pointer. Returns nil on error.
func parseDate(dateStr string) *time.Time {
	if dateStr == "" {
		return nil
	}
	layout := "2006-01-02"
	t, err := time.Parse(layout, dateStr)
	if err != nil {
		slog.Warn("Failed to parse date query parameter", "input", dateStr, "error", err)
		return nil
	}
	return &t
}

// parseSortOrder validates the sort order, defaulting to the provided default.
func parseSortOrder(orderStr, defaultOrder string) string {
	order := strings.ToLower(strings.TrimSpace(orderStr))
	if order == "asc" || order == "desc" {
		return order
	}
	return defaultOrder
}

// parseSortBy validates the sort field against allowed fields, defaulting if invalid.
// Maps frontend query param names (camelCase) to backend DB column names (snake_case).
func parseSortBy(fieldStr, defaultField string, allowedFields []string) string {
	field := strings.ToLower(strings.TrimSpace(fieldStr))
	dbColumn := field
	switch field {
	case "createdat": dbColumn = "created_at"
	case "updatedat": dbColumn = "updated_at"
	case "duedate": dbColumn = "due_date"
	}

	for _, allowed := range allowedFields {
		if dbColumn == allowed {
			return dbColumn
		}
	}

	slog.Warn("Invalid sort_by parameter received, using default", "requested", fieldStr, "default", defaultField)
	switch defaultField {
	case "createdAt": return "created_at"
	case "updatedAt": return "updated_at"
	case "dueDate": return "due_date"
	default: return defaultField
	}
}

// parseBoolPtr parses a boolean string ("true", "false") into a *bool pointer.
func parseBoolPtr(valueStr string) *bool {
	if valueStr == "" {
		return nil
	}
	b, err := strconv.ParseBool(strings.ToLower(valueStr))
	if err != nil {
		slog.Warn("Failed to parse boolean query parameter", "input", valueStr, "error", err)
		return nil
	}
	return &b
}

