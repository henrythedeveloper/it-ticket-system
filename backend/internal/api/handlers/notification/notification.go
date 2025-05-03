// backend/internal/api/handlers/notification/notification.go
// ==========================================================================
// Handlers for in-app notification API endpoints.
// ==========================================================================

package notification

import (
	"net/http"
	"time"

	"github.com/henrythedeveloper/it-ticket-system/internal/api/middleware/auth"
	"github.com/henrythedeveloper/it-ticket-system/internal/models"
	"github.com/labstack/echo/v4"
	"github.com/jackc/pgx/v5"
)

// Handler struct for dependency injection (e.g., db pool)
type Handler struct {
	DB *pgx.Conn
}

// GET /notifications - list notifications for current user
func (h *Handler) GetNotifications(c echo.Context) error {
	userID, err := auth.GetUserIDFromContext(c)
	if err != nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "Unauthorized")
	}

	rows, err := h.DB.Query(c.Request().Context(),
		`SELECT id, user_id, type, message, related_ticket_id, is_read, created_at
		 FROM notifications
		 WHERE user_id = $1
		 ORDER BY created_at DESC
		 LIMIT 100`, userID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to fetch notifications")
	}
	defer rows.Close()

	var notifications []models.Notification
	for rows.Next() {
		var n models.Notification
		var relatedTicketID *string
		if err := rows.Scan(&n.ID, &n.UserID, &n.Type, &n.Message, &relatedTicketID, &n.IsRead, &n.CreatedAt); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to scan notification")
		}
		n.RelatedTicketID = relatedTicketID
		notifications = append(notifications, n)
	}

	return c.JSON(http.StatusOK, models.NotificationListResponse{
		Success: true,
		Data:    notifications,
		Total:   len(notifications),
	})
}

// POST /notifications/mark-read - mark all notifications as read for current user
func (h *Handler) MarkNotificationsAsRead(c echo.Context) error {
	userID, err := auth.GetUserIDFromContext(c)
	if err != nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "Unauthorized")
	}

	_, err = h.DB.Exec(c.Request().Context(),
		`UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND is_read = FALSE`, userID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to mark notifications as read")
	}

	return c.JSON(http.StatusOK, map[string]any{
		"success": true,
		"message": "All notifications marked as read",
		"timestamp": time.Now(),
	})
}