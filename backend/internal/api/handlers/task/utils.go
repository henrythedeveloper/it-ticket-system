// backend/internal/api/handlers/task/utils.go
// ==========================================================================
// Utility functions specific to the task handler package.
// Includes helpers for scanning rows, fetching related data, checking access,
// formatting data, and adding system comments.
// ==========================================================================

package task

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"strconv"
	"strings"
	"time"

	"github.com/henrythedeveloper/it-ticket-system/internal/db"    // Corrected import path
	"github.com/henrythedeveloper/it-ticket-system/internal/models" // Data models
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn" // Import for pgconn.PgError
)

// --- Row Scanning Helper ---

// scanTaskWithUsers scans a task row along with potentially joined user data
// (assignee and creator). Handles nullable user fields.
//
// Parameters:
//   - rowScanner: An interface (like pgx.Row or *pgx.Rows) that has a Scan method.
//
// Returns:
//   - models.Task: The scanned task object, potentially with user details populated.
//   - error: An error if scanning fails.
func scanTaskWithUsers(rowScanner interface{ Scan(...interface{}) error }) (models.Task, error) {
	var task models.Task
	var assignedUser models.User
	var createdByUser models.User

	// Nullable fields for assigned user
	var assignedUserID, assignedUserName, assignedUserEmail, assignedUserRole *string
	var assignedUserCreatedAt, assignedUserUpdatedAt *time.Time

	// Creator user fields (assuming created_by_user_id is NOT NULL)
	var creatorUserID, creatorUserName, creatorUserEmail, creatorUserRole string
	var creatorUserCreatedAt, creatorUserUpdatedAt time.Time

	// Add total_count if using COUNT(*) OVER() - adjust scan list accordingly
	// var totalCount int // Uncomment if using COUNT(*) OVER()

	err := rowScanner.Scan(
		&task.ID, &task.TaskNumber, &task.Title, &task.Description, &task.Status,
		&task.AssignedToUserID, &task.CreatedByUserID, &task.DueDate, &task.IsRecurring,
		&task.RecurrenceRule, &task.CreatedAt, &task.UpdatedAt, &task.CompletedAt,
		// Assigned user fields (scan into nullable pointers)
		&assignedUserID, &assignedUserName, &assignedUserEmail, &assignedUserRole,
		&assignedUserCreatedAt, &assignedUserUpdatedAt,
		// Creator user fields (scan into non-nullable types)
		&creatorUserID, &creatorUserName, &creatorUserEmail, &creatorUserRole,
		&creatorUserCreatedAt, &creatorUserUpdatedAt,
		// &totalCount, // Uncomment if using COUNT(*) OVER()
	)
	if err != nil {
		// Let the caller handle ErrNoRows specifically if needed
		return task, err
	}

	// Populate assigned user struct if data exists
	if task.AssignedToUserID != nil && assignedUserID != nil {
		assignedUser = models.User{
			ID:        *assignedUserID,
			Name:      *assignedUserName,
			Email:     *assignedUserEmail,
			Role:      models.UserRole(*assignedUserRole), // Cast role string
			CreatedAt: *assignedUserCreatedAt,
			UpdatedAt: *assignedUserUpdatedAt,
		}
		task.AssignedToUser = &assignedUser
	}

	// Populate creator user struct (should always exist if FK constraint holds)
	createdByUser = models.User{
		ID:        creatorUserID,
		Name:      creatorUserName,
		Email:     creatorUserEmail,
		Role:      models.UserRole(creatorUserRole), // Cast role string
		CreatedAt: creatorUserCreatedAt,
		UpdatedAt: creatorUserUpdatedAt,
	}
	task.CreatedByUser = &createdByUser

	// Return totalCount if scanned
	// return task, totalCount, nil // Adjust return signature if using COUNT(*) OVER()

	return task, nil
}

// --- Related Data Fetching Helpers ---

// getTaskUpdates fetches all updates/comments for a specific task ID.
//
// Parameters:
//   - ctx: The request context.
//   - db: The database connection pool.
//   - taskID: The UUID of the task.
//
// Returns:
//   - []models.TaskUpdate: A slice of updates/comments for the task.
//   - error: An error if the database query fails.
func getTaskUpdates(ctx context.Context, db *db.DB, taskID string) ([]models.TaskUpdate, error) {
	logger := slog.With("helper", "getTaskUpdates", "taskUUID", taskID)
	query := `
        SELECT
            tu.id, tu.task_id, tu.user_id, tu.comment, tu.created_at,
            -- User details (nullable)
            u.id as author_id, u.name as author_name, u.email as author_email,
            u.role as author_role, u.created_at as author_created_at, u.updated_at as author_updated_at
        FROM task_updates tu -- Query the correct table
        LEFT JOIN users u ON tu.user_id = u.id -- LEFT JOIN handles NULL user_id or deleted users
        WHERE tu.task_id = $1
        ORDER BY tu.created_at ASC -- Show oldest first
    `
	rows, err := db.Pool.Query(ctx, query, taskID)
	if err != nil {
		logger.ErrorContext(ctx, "Failed to query task updates", "error", err)
		return nil, fmt.Errorf("database error fetching task updates: %w", err)
	}
	defer rows.Close()

	updates := make([]models.TaskUpdate, 0)
	for rows.Next() {
		var update models.TaskUpdate
		var author models.User
		var authorID, authorName, authorEmail, authorRole *string // Nullable pointers
		var authorCreatedAt, authorUpdatedAt *time.Time

		// Scan into TaskUpdate fields and author details
		if err := rows.Scan(
			&update.ID, &update.TaskID, &update.UserID, // UserID from task_updates might be NULL
			&update.Comment, &update.CreatedAt,
			// Scan author details into nullable pointers
			&authorID, &authorName, &authorEmail, &authorRole,
			&authorCreatedAt, &authorUpdatedAt,
		); err != nil {
			logger.ErrorContext(ctx, "Failed to scan task update row", "error", err)
			return nil, fmt.Errorf("database error scanning task update: %w", err)
		}

		// Populate author details if available
		if update.UserID != nil && authorID != nil { // Check both user_id from update and joined id
			author = models.User{
				ID: *authorID, Name: *authorName, Email: *authorEmail,
				Role: models.UserRole(*authorRole), CreatedAt: *authorCreatedAt, UpdatedAt: *authorUpdatedAt,
			}
			update.User = &author
		} else if update.UserID == nil {
			// Indicate system update if user_id is NULL (if applicable for tasks)
			update.User = &models.User{Name: "System"}
		} else {
			// User ID exists in update, but user not found in users table (deleted?)
			update.User = &models.User{ID: *update.UserID, Name: "Unknown User"}
			logger.WarnContext(ctx, "Author details not found for task update", "authorUserID", *update.UserID)
		}

		// TODO: Implement internal note filtering if tasks support it
		// if update.IsInternalNote && requestingUserRole != models.RoleAdmin { continue }

		updates = append(updates, update)
	}

	if err = rows.Err(); err != nil {
		logger.ErrorContext(ctx, "Error iterating task update rows", "error", err)
		return nil, fmt.Errorf("database error processing task updates: %w", err)
	}

	logger.DebugContext(ctx, "Fetched task updates successfully", "count", len(updates))
	return updates, nil
}

// GetTaskUpdateByID fetches a single task update and its author details. (Exported)
//
// Parameters:
//   - ctx: The request context.
//   - db: The database connection pool.
//   - updateID: The UUID of the task update to retrieve.
//
// Returns:
//   - *models.TaskUpdate: Pointer to the task update object if found.
//   - error: An error if not found or if a database error occurs.
func GetTaskUpdateByID(ctx context.Context, db *db.DB, updateID string) (*models.TaskUpdate, error) {
	logger := slog.With("helper", "GetTaskUpdateByID", "updateID", updateID) // Corrected helper name
	var update models.TaskUpdate
	var author models.User
	var authorID, authorName, authorEmail, authorRole *string // Nullable pointers
	var authorCreatedAt, authorUpdatedAt *time.Time

	err := db.Pool.QueryRow(ctx, `
        SELECT
            tu.id, tu.task_id, tu.user_id, tu.comment, tu.created_at,
            -- User details (nullable)
            u.id as author_id, u.name as author_name, u.email as author_email,
            u.role as author_role, u.created_at as author_created_at, u.updated_at as author_updated_at
        FROM task_updates tu
        LEFT JOIN users u ON tu.user_id = u.id
        WHERE tu.id = $1
    `, updateID).Scan(
		&update.ID, &update.TaskID, &update.UserID, // UserID from task_updates
		&update.Comment, &update.CreatedAt,
		// Scan author details into nullable pointers
		&authorID, &authorName, &authorEmail, &authorRole,
		&authorCreatedAt, &authorUpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			logger.WarnContext(ctx, "Task update not found")
			return nil, errors.New("task update not found")
		}
		logger.ErrorContext(ctx, "Failed to query task update by ID", "error", err)
		return nil, fmt.Errorf("database error fetching task update: %w", err)
	}

	// Populate author details if available
	if update.UserID != nil && authorID != nil {
		author = models.User{
			ID: *authorID, Name: *authorName, Email: *authorEmail,
			Role: models.UserRole(*authorRole), CreatedAt: *authorCreatedAt, UpdatedAt: *authorUpdatedAt,
		}
		update.User = &author
	} else if update.UserID == nil {
		update.User = &models.User{Name: "System"} // Indicate system action if applicable
	} else {
		update.User = &models.User{ID: *update.UserID, Name: "Unknown User"}
		logger.WarnContext(ctx, "Author details not found for task update", "authorUserID", *update.UserID)
	}

	return &update, nil
}

// --- Access Control Helper ---

// checkTaskAccess verifies if a user has permission to view/modify a specific task.
// Checks if the user is an admin, the creator, or the assignee.
//
// Parameters:
//   - ctx: The request context.
//   - db: The database connection pool.
//   - taskID: The UUID of the task.
//   - requestingUserID: The ID of the user making the request.
//   - requestingUserRole: The role of the user making the request.
//
// Returns:
//   - *models.Task: Pointer to a partially filled task struct (containing IDs) if access is granted, otherwise nil.
//   - error: An error indicating "not found", "not authorized", or a database failure.
func checkTaskAccess(
	ctx context.Context,
	db *db.DB,
	taskID string,
	requestingUserID string,
	requestingUserRole models.UserRole,
) (*models.Task, error) {
	logger := slog.With("helper", "checkTaskAccess", "taskUUID", taskID, "userID", requestingUserID, "role", requestingUserRole)
	var task models.Task // Only IDs will be populated

	// Fetch only the IDs needed for the access check
	err := db.Pool.QueryRow(ctx, `
        SELECT id, created_by_user_id, assigned_to_user_id
        FROM tasks
        WHERE id = $1
    `, taskID).Scan(&task.ID, &task.CreatedByUserID, &task.AssignedToUserID)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			logger.WarnContext(ctx, "Task not found during access check")
			return nil, errors.New("task not found")
		}
		logger.ErrorContext(ctx, "Database error during access check", "error", err)
		return nil, fmt.Errorf("database error checking task access: %w", err)
	}

	// --- Permission Logic ---
	if requestingUserRole == models.RoleAdmin {
		logger.DebugContext(ctx, "Access granted (Admin)")
		return &task, nil
	}
	if task.CreatedByUserID == requestingUserID {
		logger.DebugContext(ctx, "Access granted (Creator)")
		return &task, nil
	}
	if task.AssignedToUserID != nil && *task.AssignedToUserID == requestingUserID {
		logger.DebugContext(ctx, "Access granted (Assignee)")
		return &task, nil
	}

	logger.WarnContext(ctx, "Access denied", "creatorUserID", task.CreatedByUserID, "assignedUserID", task.AssignedToUserID)
	return nil, errors.New("not authorized to access this task")
}

// --- System Comment Helper ---

// addSystemComment inserts a system-generated comment into the task_updates table within a transaction.
//
// Parameters:
//   - ctx: The request context.
//   - tx: The database transaction (pgx.Tx).
//   - taskID: The UUID of the task to add the comment to.
//   - userID: The ID of the user performing the action (can be system user ID or actor).
//   - comment: The text content of the system comment.
//
// Returns:
//   - error: An error if the database insertion fails.
func addSystemComment(ctx context.Context, tx pgx.Tx, taskID, userID, comment string) error {
	logger := slog.With("helper", "addSystemComment", "taskUUID", taskID)
	// Assuming system comments for tasks are not marked as internal notes
	// If tasks need internal notes, add an 'is_internal_note' column to task_updates table
	// and pass a boolean flag here.
	_, err := tx.Exec(ctx, `
        INSERT INTO task_updates (task_id, user_id, comment, created_at)
        VALUES ($1, $2, $3, $4)
    `, taskID, userID, comment, time.Now())

	if err != nil {
		// Check for specific errors if needed, e.g., foreign key violation
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) {
			logger.ErrorContext(ctx, "PostgreSQL error inserting system comment", "pgErrCode", pgErr.Code, "pgErrMsg", pgErr.Message)
		} else {
			logger.ErrorContext(ctx, "Failed to insert system comment for task", "error", err)
		}
		return fmt.Errorf("database error adding system task comment: %w", err)
	}
	logger.DebugContext(ctx, "System comment added successfully")
	return nil
}

// --- Formatting Helpers ---

// formatDueDate formats a due date pointer for display, handling nil values.
func formatDueDate(dueDate *time.Time) string {
	if dueDate == nil {
		return "No due date"
	}
	// Example format, adjust as needed
	return dueDate.Format("Jan 02, 2006")
}

// --- Parsing Helpers ---

// parseTaskStatus parses a string into a valid TaskStatus pointer, returning nil if invalid.
func parseTaskStatus(statusStr string) *models.TaskStatus {
	s := models.TaskStatus(statusStr)
	switch s {
	case models.TaskStatusOpen, models.TaskStatusInProgress, models.TaskStatusCompleted:
		return &s
	default:
		return nil // Invalid or empty status
	}
}

// parseAssigneeFilter handles "me", "unassigned", or a specific user ID string.
func parseAssigneeFilter(assigneeStr, currentUserID string) *string {
	if assigneeStr == "me" {
		if currentUserID != "" {
			return &currentUserID // Replace "me" with actual user ID
		}
		return nil // Cannot filter by "me" if user ID is unknown
	}
	if assigneeStr == "unassigned" || assigneeStr != "" {
		// Return "unassigned" or the actual UUID string
		return &assigneeStr
	}
	return nil // Empty or invalid assignee filter
}

// parseInt parses an integer from a string, returning a default value on error or empty string.
func parseInt(valueStr string, defaultValue int) int {
	if valueStr == "" {
		return defaultValue
	}
	value, err := strconv.Atoi(valueStr)
	if err != nil || value <= 0 { // Basic validation (e.g., page/limit > 0)
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

// parseBoolPtr parses a string ("true", "false") into a boolean pointer.
func parseBoolPtr(valueStr string) *bool {
	if valueStr == "" {
		return nil
	}
	value, err := strconv.ParseBool(strings.ToLower(valueStr))
	if err != nil {
		return nil // Invalid boolean string
	}
	return &value
}

// parseDate parses a date string (e.g., "YYYY-MM-DD") into a time.Time pointer.
func parseDate(dateStr string) *time.Time {
	if dateStr == "" {
		return nil
	}
	// Adjust the layout string based on the expected input format
	layout := "2006-01-02"
	t, err := time.Parse(layout, dateStr)
	if err != nil {
		slog.Warn("Failed to parse date string", "dateString", dateStr, "error", err)
		return nil
	}
	return &t
}
