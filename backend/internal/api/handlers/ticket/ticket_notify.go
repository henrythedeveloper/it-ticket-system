// backend/internal/api/handlers/ticket/ticket_notify.go
// ==========================================================================
// Centralized notification logic for ticket events (in-app and email).
// ==========================================================================

package ticket

import (
	"context"
	"fmt"

	"github.com/henrythedeveloper/it-ticket-system/internal/models"
)

// CreateNotification inserts a notification for a user (used by ticket updates).
func (h *Handler) CreateNotification(userID, notifType, message string, relatedTicketID *string) error {
	_, err := h.db.Pool.Exec(
		context.Background(),
		`INSERT INTO notifications (user_id, type, message, related_ticket_id) VALUES ($1, $2, $3, $4)`,
		userID, notifType, message, relatedTicketID,
	)
	return err
}

// triggerUpdateNotifications sends relevant emails and creates in-app notifications based on the changes made.
func (h *Handler) triggerUpdateNotifications(currentState *models.TicketState, update *models.TicketStatusUpdate, recipientEmail, subject string, ticketNumber int32) {
	if update.Status != "" && update.Status != currentState.Status {
		msg := fmt.Sprintf("Ticket #%d status changed from %s to %s", ticketNumber, currentState.Status, update.Status)
		h.CreateNotification(recipientEmail, "status_change", msg, nil)
	}
	// Add more notification logic as needed
}
