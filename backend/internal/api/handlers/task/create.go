// backend/internal/api/handlers/task/create.go
// ==========================================================================
// Handler function for creating new tasks.
// Handles request binding, validation, database insertion, and notifications.
// ==========================================================================

package task

import (
	"context"
	"log/slog"
	"net/http"
	"time"

	"github.com/henrythedeveloper/it-ticket-system/internal/api/middleware/auth" // Auth helpers
	"github.com/henrythedeveloper/it-ticket-system/internal/models"              // Data models
	"github.com/labstack/echo/v4"
)

// --- Handler Function ---

// CreateTask handles the HTTP request to create a new task.
// It expects task details in the request body (JSON format).
//
// Parameters:
//   - c: The echo context, providing access to request and response.
//
// Returns:
//   - error: An error if processing fails (e.g., bad request, database error),
//     otherwise nil. Returns a JSON response with the created task on success.
func (h *Handler) CreateTask(c echo.Context) error {
	ctx := c.Request().Context()
	logger := slog.With("handler", "CreateTask")

	// --- 1. Bind and Validate Request Body ---
	var taskCreate models.TaskCreate
	if err := c.Bind(&taskCreate); err != nil {
		logger.WarnContext(ctx, "Failed to bind request body", "error", err)
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid request body: "+err.Error())
	}
	// TODO: Add validation for TaskCreate struct fields (e.g., title length)
	// Example using a validation library:
	// if err := validate.Struct(taskCreate); err != nil {
	//     logger.WarnContext(ctx, "Request body validation failed", "error", err)
	//     return echo.NewHTTPError(http.StatusBadRequest, "Validation errors: "+err.Error())
	// }

	logger.DebugContext(ctx, "Task creation request received", "title", taskCreate.Title, "assigneeID", taskCreate.AssignedToID)

	// --- 2. Get Creator User Context ---
	creatorUserID, err := auth.GetUserIDFromContext(c)
	if err != nil {
		return err // Error logged in helper
	}
	logger.DebugContext(ctx, "Creator identified", "creatorUserID", creatorUserID)

	// --- 3. Insert Task into Database ---
	var createdTask models.Task
	// Note: Status is set server-side to TaskStatusOpen initially.
	// RecurrenceRule is directly taken from input. DueDate can be null. AssignedToID can be null.
	err = h.db.Pool.QueryRow(ctx, `
        INSERT INTO tasks (
            title, description, status, assigned_to_user_id, created_by_user_id,
            due_date, is_recurring, recurrence_rule, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id, task_number, title, description, status, assigned_to_user_id, created_by_user_id,
                  due_date, is_recurring, recurrence_rule, created_at, updated_at, completed_at
    `,
		taskCreate.Title,          // $1
		taskCreate.Description,    // $2 (Nullable)
		models.TaskStatusOpen,     // $3 (Initial status)
		taskCreate.AssignedToID,   // $4 (Nullable UUID string)
		creatorUserID,             // $5 (Creator's UUID string)
		taskCreate.DueDate,        // $6 (Nullable timestamp)
		taskCreate.IsRecurring,    // $7 (Boolean)
		taskCreate.RecurrenceRule, // $8 (Nullable string)
		time.Now(),                // $9 (created_at)
		time.Now(),                // $10 (updated_at)
	).Scan(
		&createdTask.ID, &createdTask.TaskNumber, &createdTask.Title, &createdTask.Description,
		&createdTask.Status, &createdTask.AssignedToUserID, &createdTask.CreatedByUserID,
		&createdTask.DueDate, &createdTask.IsRecurring, &createdTask.RecurrenceRule,
		&createdTask.CreatedAt, &createdTask.UpdatedAt, &createdTask.CompletedAt,
	)
	if err != nil {
		logger.ErrorContext(ctx, "Failed to insert task into database", "error", err, "payload", taskCreate)
		// TODO: Check for specific DB errors like foreign key violations (e.g., invalid assigned_to_user_id)
		// if pgErr, ok := err.(*pgconn.PgError); ok && pgErr.Code == "23503" { // Foreign key violation
		//     return echo.NewHTTPError(http.StatusBadRequest, "Invalid assigned user ID.")
		// }
		return echo.NewHTTPError(http.StatusInternalServerError, "Database error: failed to create task.")
	}
	logger.InfoContext(ctx, "Task created successfully in database", "taskUUID", createdTask.ID, "taskNumber", createdTask.TaskNumber)

	// --- 4. Populate User Details for Response & Notifications ---
	// Fetch creator details (should always exist)
	creator, err := h.getUserDetails(ctx, createdTask.CreatedByUserID)
	if err != nil {
		logger.WarnContext(ctx, "Failed to load creator details after task creation", "creatorUserID", createdTask.CreatedByUserID, "error", err)
		// Continue without creator details in response, but log the issue
	} else {
		createdTask.CreatedByUser = creator // Assign creator details to response object
		logger.DebugContext(ctx, "Loaded creator user details", "creatorUserName", creator.Name)
	}

	// Fetch assignee details if assigned
	var assignedUser *models.User
	if createdTask.AssignedToUserID != nil {
		assignedUser, err = h.getUserDetails(ctx, *createdTask.AssignedToUserID)
		if err != nil {
			logger.WarnContext(ctx, "Failed to load assigned user details after task creation", "assignedUserID", *createdTask.AssignedToUserID, "error", err)
			// Continue without assignee details, but log the issue
		} else {
			createdTask.AssignedToUser = assignedUser // Assign assignee details to response object
			logger.DebugContext(ctx, "Loaded assigned user details", "assignedUserName", assignedUser.Name)

			// --- 5. Trigger Assignment Notification (Asynchronously) ---
			go h.sendTaskAssignmentNotification(assignedUser.Email, createdTask.Title, createdTask.DueDate)
		}
	}

	// --- 6. Return Success Response ---
	return c.JSON(http.StatusCreated, models.APIResponse{
		Success: true,
		Message: "Task created successfully.",
		Data:    createdTask, // Return the created task with populated user details
	})
}

// --- Helper Functions ---

// getUserDetails fetches basic user information by ID.
// Used to populate CreatedByUser and AssignedToUser in the response.
func (h *Handler) getUserDetails(ctx context.Context, userID string) (*models.User, error) {
	var user models.User
	// Select only necessary fields
	err := h.db.Pool.QueryRow(ctx, `
        SELECT id, name, email, role, created_at, updated_at
        FROM users WHERE id = $1
    `, userID).Scan(
		&user.ID, &user.Name, &user.Email, &user.Role, &user.CreatedAt, &user.UpdatedAt,
	)
	if err != nil {
		// Let caller log context-specific messages
		return nil, err
	}
	return &user, nil
}

// sendTaskAssignmentNotification sends the assignment email in a separate goroutine.
func (h *Handler) sendTaskAssignmentNotification(recipientEmail, taskTitle string, dueDate *time.Time) {
	// Use background context for the goroutine
	bgCtx := context.Background()
	emailLogger := slog.With("operation", "SendTaskAssignmentEmail", "recipient", recipientEmail, "taskTitle", taskTitle)

	dueDateStr := formatDueDate(dueDate) // Use utility function

	if emailErr := h.emailService.SendTaskAssignment(recipientEmail, taskTitle, dueDateStr); emailErr != nil {
		emailLogger.ErrorContext(bgCtx, "Failed to send task assignment email", "error", emailErr)
	} else {
		emailLogger.InfoContext(bgCtx, "Sent task assignment email successfully")
	}
}

// formatDueDate is a local helper (could be moved to utils if used elsewhere)
// func formatDueDate(dueDate *time.Time) string {
// 	if dueDate == nil {
// 		return "Not set"
// 	}
// 	return dueDate.Format("Jan 02, 2006") // Example format
// }
