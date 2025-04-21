package ticket

import (
	"errors"
	"net/http"
	"time"

	"github.com/henrythedeveloper/bus-it-ticket/internal/api/middleware/auth"
	"github.com/henrythedeveloper/bus-it-ticket/internal/models"
	"github.com/jackc/pgx/v5"
	"github.com/labstack/echo/v4"
)

// AddTicketComment adds a comment or update to a ticket
func (h *Handler) AddTicketComment(c echo.Context) error {
	ticketID := c.Param("id")
	if ticketID == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "missing ticket ID")
	}

	var commentCreate models.TicketUpdateCreate
	if err := c.Bind(&commentCreate); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}

	ctx := c.Request().Context()

	// Get user ID from context
	userID, err := auth.GetUserIDFromContext(c)
	if err != nil {
		return err
	}

	// Verify ticket exists and user has access
	var assignedTo *string
	var status models.TicketStatus
	err = h.db.Pool.QueryRow(ctx, `
		SELECT assigned_to_user_id, status
		FROM tickets
		WHERE id = $1
	`, ticketID).Scan(&assignedTo, &status)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return echo.NewHTTPError(http.StatusNotFound, "ticket not found")
		}
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to get ticket")
	}

	// Check if ticket is closed
	if status == models.StatusClosed {
		return echo.NewHTTPError(http.StatusBadRequest, "cannot add comment to closed ticket")
	}

	// Add comment to database
	var commentID string
	err = h.db.Pool.QueryRow(ctx, `
		INSERT INTO ticket_updates (ticket_id, user_id, comment, is_internal_note, created_at)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id
	`, ticketID, userID, commentCreate.Comment, true, time.Now()).Scan(&commentID) // Set is_internal_note to true
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to add comment")
	}

	// Always update the ticket's updated_at timestamp when a comment is added
	_, err = h.db.Pool.Exec(ctx, `
		UPDATE tickets
		SET updated_at = $1
		WHERE id = $2
	`, time.Now(), ticketID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to update ticket")
	}

	// Get the comment with user info
	var comment models.TicketUpdate
	var user models.User
	var userName, userEmail, userRole string
	var userCreatedAt, userUpdatedAt time.Time

	err = h.db.Pool.QueryRow(ctx, `
		SELECT tu.id, tu.ticket_id, tu.user_id, tu.comment, tu.is_internal_note, tu.created_at,
			u.name, u.email, u.role, u.created_at, u.updated_at
		FROM ticket_updates tu
		JOIN users u ON tu.user_id = u.id
		WHERE tu.id = $1
	`, commentID).Scan(
		&comment.ID,
		&comment.TicketID,
		&comment.UserID,
		&comment.Comment,
		&comment.IsInternalNote,
		&comment.CreatedAt,
		&userName,
		&userEmail,
		&userRole,
		&userCreatedAt,
		&userUpdatedAt,
	)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to get created comment")
	}

	// Include user info
	user = models.User{
		ID:        *comment.UserID,
		Name:      userName,
		Email:     userEmail,
		Role:      models.UserRole(userRole),
		CreatedAt: userCreatedAt,
		UpdatedAt: userUpdatedAt,
	}
	comment.User = &user

	return c.JSON(http.StatusCreated, models.APIResponse{
		Success: true,
		Message: "Comment added successfully",
		Data:    comment,
	})
}
