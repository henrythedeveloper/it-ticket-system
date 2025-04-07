package task

import (
	"fmt"
	"net/http"
	"time"

	"github.com/henrythedeveloper/bus-it-ticket/internal/api/middleware/auth"
	"github.com/henrythedeveloper/bus-it-ticket/internal/models"
	"github.com/labstack/echo/v4"
)

// CreateTask creates a new task
func (h *Handler) CreateTask(c echo.Context) error {
	var taskCreate models.TaskCreate
	if err := c.Bind(&taskCreate); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}

	ctx := c.Request().Context()

	// Get user ID from context
	userID, err := auth.GetUserIDFromContext(c)
	if err != nil {
		return err
	}

	// Create task in database
	var task models.Task
	err = h.db.Pool.QueryRow(ctx, `
		INSERT INTO tasks (
			title, description, status, assigned_to_user_id, created_by_user_id,
			due_date, is_recurring, recurrence_rule, created_at, updated_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		RETURNING id, title, description, status, assigned_to_user_id, created_by_user_id,
			due_date, is_recurring, recurrence_rule, created_at, updated_at, completed_at
	`,
		taskCreate.Title,
		taskCreate.Description,
		models.TaskStatusOpen,
		taskCreate.AssignedToID,
		userID,
		taskCreate.DueDate,
		taskCreate.IsRecurring,
		taskCreate.RecurrenceRule,
		time.Now(),
		time.Now(),
	).Scan(
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
	)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to create task")
	}

	// If task is assigned to someone, load their info
	if task.AssignedToUserID != nil {
		var assignedUser models.User
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
			// Don't fail the whole request if this fails
			fmt.Printf("Failed to load assigned user: %v\n", err)
		} else {
			task.AssignedToUser = &assignedUser

			// Send task assignment email
			go func() {
				dueDateStr := "No due date"
				if task.DueDate != nil {
					dueDateStr = task.DueDate.Format("Jan 02, 2006")
				}

				if err := h.emailService.SendTaskAssignment(
					assignedUser.Email,
					task.Title,
					dueDateStr,
				); err != nil {
					fmt.Printf("Failed to send task assignment email: %v\n", err)
				}
			}()
		}
	}

	// Load creator info
	var createdByUser models.User
	err = h.db.Pool.QueryRow(ctx, `
		SELECT id, name, email, role, created_at, updated_at
		FROM users
		WHERE id = $1
	`, task.CreatedByUserID).Scan(
		&createdByUser.ID,
		&createdByUser.Name,
		&createdByUser.Email,
		&createdByUser.Role,
		&createdByUser.CreatedAt,
		&createdByUser.UpdatedAt,
	)
	if err != nil {
		// Don't fail the whole request if this fails
		fmt.Printf("Failed to load creator user: %v\n", err)
	} else {
		task.CreatedByUser = &createdByUser
	}

	return c.JSON(http.StatusCreated, models.APIResponse{
		Success: true,
		Message: "Task created successfully",
		Data:    task,
	})
}
