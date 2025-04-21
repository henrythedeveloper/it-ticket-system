package task

import (
	"bytes" // Import bytes package
	"context"
	"io"       // Import io package
	"log/slog" // Import slog
	"net/http"
	"time"

	"github.com/henrythedeveloper/bus-it-ticket/internal/api/middleware/auth"
	"github.com/henrythedeveloper/bus-it-ticket/internal/models"
	"github.com/labstack/echo/v4"
)

// CreateTask creates a new task
func (h *Handler) CreateTask(c echo.Context) error {
	ctx := c.Request().Context() // Get context first

	// --- Start Debug Logging ---
	// Read the raw request body without consuming it from the context
	var requestBodyBytes []byte
	if c.Request().Body != nil {
		requestBodyBytes, _ = io.ReadAll(c.Request().Body)
	}
	// Restore the request body so it can be read again by c.Bind
	c.Request().Body = io.NopCloser(bytes.NewBuffer(requestBodyBytes))

	slog.DebugContext(ctx, "Received CreateTask request", "rawBody", string(requestBodyBytes))
	// --- End Debug Logging ---

	var taskCreate models.TaskCreate
	// Attempt to bind the request body to the struct
	if err := c.Bind(&taskCreate); err != nil {
		// Log the binding error specifically
		slog.ErrorContext(ctx, "Failed to bind request body for CreateTask", "error", err, "rawBody", string(requestBodyBytes))
		// Return the 400 error immediately if binding fails
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body: "+err.Error())
	}

	// --- Start Debug Logging ---
	// Log the struct *after* successful binding
	slog.DebugContext(ctx, "Successfully bound request body to TaskCreate struct", "boundData", taskCreate)
	// --- End Debug Logging ---

	// Get user ID from context (should happen *after* successful bind potentially)
	userID, err := auth.GetUserIDFromContext(c)
	if err != nil {
		slog.ErrorContext(ctx, "Failed to get user ID from context", "error", err)
		return err // Return the specific error from GetUserIDFromContext (likely 401/500)
	}
	slog.DebugContext(ctx, "Retrieved user ID from context", "userID", userID)

	// Create task in database
	var task models.Task
	// Note: Using QueryRowContext which is preferred
	err = h.db.Pool.QueryRow(ctx, `
		INSERT INTO tasks (
			title, description, status, assigned_to_user_id, created_by_user_id,
			due_date, is_recurring, recurrence_rule, created_at, updated_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		RETURNING id, task_number, title, description, status, assigned_to_user_id, created_by_user_id,
			due_date, is_recurring, recurrence_rule, created_at, updated_at, completed_at
	`,
		taskCreate.Title,          // $1
		taskCreate.Description,    // $2
		models.TaskStatusOpen,     // $3 (Status is set server-side)
		taskCreate.AssignedToID,   // $4 (*string - should be null or UUID)
		userID,                    // $5 (string - from JWT)
		taskCreate.DueDate,        // $6 (*time.Time - should be null or valid date)
		taskCreate.IsRecurring,    // $7 (bool)
		taskCreate.RecurrenceRule, // $8 (*string - should be null or rule string)
		time.Now(),                // $9
		time.Now(),                // $10
	).Scan(
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
	)
	if err != nil {
		// Log the detailed database error
		slog.ErrorContext(ctx, "Failed to insert task into database", "error", err, "payload", taskCreate, "creatorUserID", userID)
		// Return a 500 error for database issues
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to create task in database")
	}
	slog.InfoContext(ctx, "Successfully created task in database", "taskID", task.ID, "taskNumber", task.TaskNumber)

	// --- Post-Creation Logic (Loading user info, sending email) ---

	// If task is assigned to someone, load their info for the response and email
	if task.AssignedToUserID != nil {
		var assignedUser models.User
		// Use QueryRowContext
		err = h.db.Pool.QueryRow(ctx, `
			SELECT id, name, email, role, created_at, updated_at
			FROM users
			WHERE id = $1
		`, *task.AssignedToUserID).Scan(
			&assignedUser.ID,
			&assignedUser.Name,
			&assignedUser.Email,
			&assignedUser.Role,
			&assignedUser.CreatedAt,
			&assignedUser.UpdatedAt,
		)
		if err != nil {
			// Log failure to load user but don't fail the whole request
			slog.WarnContext(ctx, "Failed to load assigned user details after task creation", "assignedUserID", *task.AssignedToUserID, "error", err)
		} else {
			task.AssignedToUser = &assignedUser // Add user details to the response object
			slog.DebugContext(ctx, "Loaded assigned user details", "assignedUserName", assignedUser.Name)

			// Send task assignment email in a separate goroutine
			go func(assignedEmail, taskTitle string, dueDate *time.Time) {
				dueDateStr := "No due date"
				if dueDate != nil {
					dueDateStr = dueDate.Format("Jan 02, 2006")
				}
				// Use background context for the goroutine
				bgCtx := context.Background()
				if emailErr := h.emailService.SendTaskAssignment(
					assignedEmail,
					taskTitle,
					dueDateStr,
				); emailErr != nil {
					// Log email sending failure
					slog.ErrorContext(bgCtx, "Failed to send task assignment email", "recipient", assignedEmail, "taskTitle", taskTitle, "error", emailErr)
				} else {
					slog.InfoContext(bgCtx, "Sent task assignment email", "recipient", assignedEmail, "taskTitle", taskTitle)
				}
			}(assignedUser.Email, task.Title, task.DueDate) // Pass necessary data
		}
	}

	// Load creator info for the response object
	var createdByUser models.User
	// Use QueryRowContext
	err = h.db.Pool.QueryRow(ctx, `
		SELECT id, name, email, role, created_at, updated_at
		FROM users
		WHERE id = $1
	`, task.CreatedByUserID).Scan( // Use task.CreatedByUserID which comes from the DB insert
		&createdByUser.ID,
		&createdByUser.Name,
		&createdByUser.Email,
		&createdByUser.Role,
		&createdByUser.CreatedAt,
		&createdByUser.UpdatedAt,
	)
	if err != nil {
		// Log failure but don't fail the request
		slog.WarnContext(ctx, "Failed to load creator user details after task creation", "creatorUserID", task.CreatedByUserID, "error", err)
	} else {
		task.CreatedByUser = &createdByUser // Add creator details to response
		slog.DebugContext(ctx, "Loaded creator user details", "creatorUserName", createdByUser.Name)
	}

	// Return successful response with the created task data
	return c.JSON(http.StatusCreated, models.APIResponse{
		Success: true,
		Message: "Task created successfully",
		Data:    task,
	})
}
