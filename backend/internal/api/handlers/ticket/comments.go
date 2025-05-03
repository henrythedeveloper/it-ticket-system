// backend/internal/api/handlers/ticket/comments.go
// ==========================================================================
// Handler function for adding comments or updates to a ticket.
// **REVISED**: Added validation to prevent empty comments.
// **REVISED AGAIN**: Added entry logging and raw body logging to debug 400 errors.
// **REVISED AGAIN**: Explicitly bind as JSON.
// **REVISED AGAIN**: Reverted c.Bind to single argument syntax.
// ==========================================================================

package ticket

import (
	"bytes" // Import bytes for reading raw body
	"context"
	"errors"
	"fmt"
	"io" // Import io for ReadAll
	"log/slog"
	"net/http"
	"strings" // Import strings package for TrimSpace
	"time"

	"github.com/henrythedeveloper/it-ticket-system/internal/api/middleware/auth" // Auth helpers
	"github.com/henrythedeveloper/it-ticket-system/internal/models"              // Data models
	"github.com/jackc/pgx/v5"
	"github.com/labstack/echo/v4"
)

// --- Handler Function ---

// AddTicketComment handles requests to add a new comment or update to a ticket.
// It performs authorization checks and inserts the comment into the database.
//
// Path Parameters:
//   - id: The UUID of the ticket to add the comment to.
//
// Request Body:
//   - Expects JSON matching models.TicketUpdateCreate.
//
// Returns:
//   - JSON response with the newly created TicketUpdate object or an error response.
func (h *Handler) AddTicketComment(c echo.Context) (err error) { // Use named return for defer rollback check
	ctx := c.Request().Context()
	ticketID := c.Param("id")
	logger := slog.With("handler", "AddTicketComment", "ticketUUID", ticketID)

	// *** ADDED: Entry log ***
	logger.DebugContext(ctx, "AddTicketComment handler invoked.")
	// *** END ADDED LOG ***

	// --- 1. Input Validation & Binding ---
	if ticketID == "" {
		logger.WarnContext(ctx, "Missing ticket ID in request path")
		return echo.NewHTTPError(http.StatusBadRequest, "Missing ticket ID.")
	}

	// *** ADDED: Log raw request body BEFORE binding ***
	var rawBodyBytes []byte
	if c.Request().Body != nil {
		rawBodyBytes, _ = io.ReadAll(c.Request().Body)
		// Restore the body so it can be read again by Bind
		c.Request().Body = io.NopCloser(bytes.NewBuffer(rawBodyBytes))
		logger.DebugContext(ctx, "Raw request body received", "rawBody", string(rawBodyBytes))
	} else {
		logger.WarnContext(ctx, "Request body is nil before binding")
	}
	// *** END ADDED LOG ***

	var commentCreate models.TicketUpdateCreate
	// *** REVERTED: Use single argument for c.Bind ***
	if err = c.Bind(&commentCreate); err != nil {
		// Log the binding error specifically
		logger.ErrorContext(ctx, "Failed to bind request body", "error", err)
		// Log the raw body again in case of error
		logger.DebugContext(ctx, "Raw request body on bind failure", "rawBody", string(rawBodyBytes))
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid request body: "+err.Error())
	}
	// Log the bound data *after* successful binding
	logger.DebugContext(ctx, "Request body bound successfully", "commentContentLength", len(commentCreate.Comment), "commentContent", commentCreate.Comment, "isInternal", commentCreate.IsInternalNote)


	// Validation: Check if comment content is empty AFTER binding
	if strings.TrimSpace(commentCreate.Comment) == "" {
		logger.WarnContext(ctx, "Attempted to add empty comment (post-binding check)")
		return echo.NewHTTPError(http.StatusBadRequest, "Comment content cannot be empty.")
	}

	// --- 2. Get User Context ---
	userID, err := auth.GetUserIDFromContext(c)
	if err != nil {
		return err // Error logged in helper
	}
	userRole, err := auth.GetUserRoleFromContext(c) // Needed for internal note check later
	if err != nil {
		return err
	}

	logger.DebugContext(ctx, "Add comment request processing", "userID", userID, "role", userRole, "isInternal", commentCreate.IsInternalNote)

	// --- 3. Authorization & Pre-checks ---
	// Fetch ticket status and assignee ID to check permissions
	var currentStatus models.TicketStatus
	var assignedToUserID *string
	err = h.db.Pool.QueryRow(ctx, `
        SELECT status, assigned_to_user_id FROM tickets WHERE id = $1
    `, ticketID).Scan(&currentStatus, &assignedToUserID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			logger.WarnContext(ctx, "Ticket not found")
			return echo.NewHTTPError(http.StatusNotFound, "Ticket not found.")
		}
		logger.ErrorContext(ctx, "Failed to query ticket for comment check", "error", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to retrieve ticket details.")
	}

	// Check if ticket is closed
	if currentStatus == models.StatusClosed {
		logger.WarnContext(ctx, "Attempted to add comment to closed ticket")
		return echo.NewHTTPError(http.StatusBadRequest, "Cannot add comments to a closed ticket.")
	}

	// Authorization: Check if user is allowed to add this type of comment
	// Check if non-staff/admin is trying to add an internal note
	if commentCreate.IsInternalNote && userRole != models.RoleAdmin && userRole != models.RoleStaff {
		logger.WarnContext(ctx, "Unauthorized attempt to add internal note", "userID", userID, "userRole", userRole)
		return echo.NewHTTPError(http.StatusForbidden, "You are not authorized to add internal notes.")
	}

	// --- 4. Database Insertion (within Transaction) ---
	tx, err := h.db.Pool.Begin(ctx)
	if err != nil {
		logger.ErrorContext(ctx, "Failed to begin database transaction", "error", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "Database error: failed to start transaction.")
	}
	// Defer rollback on error
	defer func() {
		if err != nil {
			logger.WarnContext(ctx, "Rolling back transaction due to error", "error", err)
			if rbErr := tx.Rollback(ctx); rbErr != nil {
				logger.ErrorContext(ctx, "Failed to rollback transaction", "rollbackError", rbErr)
			}
		}
	}()

	// Insert the comment
	var commentID string
	err = tx.QueryRow(ctx, `
        INSERT INTO ticket_updates (ticket_id, user_id, comment, is_internal_note, created_at)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
    `, ticketID, userID, commentCreate.Comment, commentCreate.IsInternalNote, time.Now()).Scan(&commentID)
	if err != nil {
		logger.ErrorContext(ctx, "Failed to insert ticket update", "error", err)
		// Use the named return variable 'err' to trigger the deferred rollback
		err = fmt.Errorf("database error: failed to add comment: %w", err)
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	// Update the ticket's updated_at timestamp
	_, err = tx.Exec(ctx, `UPDATE tickets SET updated_at = $1 WHERE id = $2`, time.Now(), ticketID)
	if err != nil {
		// Log error but don't necessarily fail the whole operation if comment insert succeeded
		logger.ErrorContext(ctx, "Failed to update ticket's updated_at timestamp", "error", err)
		// Decide if this error should cause a rollback:
		// err = fmt.Errorf("failed to update ticket timestamp: %w", err) // Uncomment to trigger rollback
	}

	// Commit transaction (only if no critical error occurred)
	if err == nil {
		err = tx.Commit(ctx)
		if err != nil {
			logger.ErrorContext(ctx, "Failed to commit transaction", "error", err)
			// Use the named return variable 'err' to trigger the deferred rollback
			err = fmt.Errorf("database error: failed to save comment: %w", err)
			return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
		}
	} else {
		// If err is set (e.g., from timestamp update), defer handles rollback
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to complete comment addition.")
	}

	// --- 5. Fetch Created Comment with User Details ---
	// Fetch the comment we just created to include user details in the response
	createdComment, fetchErr := h.getTicketUpdateByID(ctx, commentID)
	if fetchErr != nil {
		logger.ErrorContext(ctx, "Failed to fetch created comment details", "commentID", commentID, "error", fetchErr)
		// Return success but indicate details couldn't be fetched
		return c.JSON(http.StatusCreated, models.APIResponse{
			Success: true,
			Message: "Comment added successfully, but failed to retrieve full details.",
			Data:    map[string]string{"id": commentID}, // Return at least the ID
		})
	}

	// --- 6. Return Success Response ---
	logger.InfoContext(ctx, "Comment added successfully", "commentID", commentID, "userID", userID)
	return c.JSON(http.StatusCreated, models.APIResponse{
		Success: true,
		Message: "Comment added successfully.",
		Data:    createdComment,
	})
}

// --- Helper Function ---

// getTicketUpdateByID fetches a single ticket update and its author details.
func (h *Handler) getTicketUpdateByID(ctx context.Context, updateID string) (*models.TicketUpdate, error) {
	logger := slog.With("helper", "getTicketUpdateByID", "updateID", updateID)
	var update models.TicketUpdate
	var user models.User
	var updateUserID *string // User ID from ticket_updates table might be null
	var userName, userEmail, userRole *string
	var userCreatedAt, userUpdatedAt *time.Time

	err := h.db.Pool.QueryRow(ctx, `
        SELECT
            tu.id, tu.ticket_id, tu.user_id, tu.comment, tu.is_internal_note, tu.created_at,
            -- User details (nullable)
            u.id, u.name, u.email, u.role, u.created_at, u.updated_at
        FROM ticket_updates tu
        LEFT JOIN users u ON tu.user_id = u.id -- Use LEFT JOIN in case user is deleted or system comment
        WHERE tu.id = $1
    `, updateID).Scan(
		&update.ID, &update.TicketID, &updateUserID, &update.Comment,
		&update.IsInternalNote, &update.CreatedAt,
		// User details (scan into nullable pointers)
		&user.ID, // Scan directly into user.ID (string)
		&userName, &userEmail, &userRole,
		&userCreatedAt, &userUpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			logger.WarnContext(ctx, "Ticket update not found")
			return nil, errors.New("ticket update not found")
		}
		logger.ErrorContext(ctx, "Failed to query ticket update by ID", "error", err)
		return nil, fmt.Errorf("database error fetching ticket update: %w", err)
	}

	// Populate the nested User struct if the user exists and details were fetched
	if updateUserID != nil { // Check if the user_id from ticket_updates was not NULL
		update.UserID = updateUserID // Assign the user ID to the update struct
		// Check if user details were actually found (LEFT JOIN might return NULLs)
		if userName != nil {
			user.Name = *userName
			user.Email = *userEmail
			user.Role = models.UserRole(*userRole)
			user.CreatedAt = *userCreatedAt
			user.UpdatedAt = *userUpdatedAt
			update.User = &user // Assign the populated user struct
		} else {
			// Handle case where user exists in ticket_updates but not in users table (deleted user?)
			update.User = &models.User{ID: *updateUserID, Name: "Unknown User"} // Provide fallback
			logger.WarnContext(ctx, "User details not found for update author", "authorUserID", *updateUserID)
		}
	} else {
		// Handle system comment where user_id might be NULL
		update.User = &models.User{Name: "System"} // Indicate system action
	}

	return &update, nil
}
