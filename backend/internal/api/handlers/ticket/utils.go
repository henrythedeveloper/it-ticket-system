package ticket

import (
	"context"
	"errors"
	"time"

	"github.com/henrythedeveloper/bus-it-ticket/internal/models"
	"github.com/jackc/pgx/v5"
)

// scanTicketWithUser scans a ticket row with optional user data
func scanTicketWithUser(
	row pgx.Row,
) (models.Ticket, error) {
	var ticket models.Ticket
	var assignedToUser models.User
	var userID, userName, userEmail, userRole *string
	var userCreatedAt, userUpdatedAt *time.Time

	err := row.Scan(
		&ticket.ID,
		&ticket.EndUserEmail,
		&ticket.IssueType,
		&ticket.Urgency,
		&ticket.Subject,
		&ticket.Body,
		&ticket.Status,
		&ticket.AssignedToUserID,
		&ticket.CreatedAt,
		&ticket.UpdatedAt,
		&ticket.ClosedAt,
		&ticket.ResolutionNotes,
		&userID,
		&userName,
		&userEmail,
		&userRole,
		&userCreatedAt,
		&userUpdatedAt,
	)
	if err != nil {
		return ticket, err
	}

	// Include assigned user if present
	if ticket.AssignedToUserID != nil && userID != nil {
		assignedToUser = models.User{
			ID:        *userID,
			Name:      *userName,
			Email:     *userEmail,
			Role:      models.UserRole(*userRole),
			CreatedAt: *userCreatedAt,
			UpdatedAt: *userUpdatedAt,
		}
		ticket.AssignedToUser = &assignedToUser
	}

	return ticket, nil
}

// getTicketTags gets all tags for a ticket
func (h *Handler) getTicketTags(ctx context.Context, ticketID string) ([]models.Tag, error) {
	rows, err := h.db.Pool.Query(ctx, `
		SELECT t.id, t.name, t.created_at
		FROM tags t
		JOIN ticket_tags tt ON t.id = tt.tag_id
		WHERE tt.ticket_id = $1
	`, ticketID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tags []models.Tag
	for rows.Next() {
		var tag models.Tag
		if err := rows.Scan(&tag.ID, &tag.Name, &tag.CreatedAt); err != nil {
			return nil, err
		}
		tags = append(tags, tag)
	}

	return tags, nil
}

// getTicketUpdates gets all updates/comments for a ticket
func (h *Handler) getTicketUpdates(
	ctx context.Context,
	ticketID string,
	userID string,
	userRole models.UserRole,
	assignedToUserID *string,
) ([]models.TicketUpdate, error) {
	rows, err := h.db.Pool.Query(ctx, `
		SELECT tu.id, tu.ticket_id, tu.user_id, tu.comment, tu.is_internal_note, tu.created_at,
			u.id, u.name, u.email, u.role, u.created_at, u.updated_at
		FROM ticket_updates tu
		LEFT JOIN users u ON tu.user_id = u.id
		WHERE tu.ticket_id = $1
		ORDER BY tu.created_at
	`, ticketID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var updates []models.TicketUpdate
	for rows.Next() {
		var update models.TicketUpdate
		var updateUser models.User
		var updateUserID *string
		var updateUserName, updateUserEmail, updateUserRole *string
		var updateUserCreatedAt, updateUserUpdatedAt *time.Time

		if err := rows.Scan(
			&update.ID,
			&update.TicketID,
			&updateUserID,
			&update.Comment,
			&update.IsInternalNote,
			&update.CreatedAt,
			&updateUserName,
			&updateUserName,
			&updateUserEmail,
			&updateUserRole,
			&updateUserCreatedAt,
			&updateUserUpdatedAt,
		); err != nil {
			return nil, err
		}

		// Include user if present
		if updateUserID != nil {
			updateUser = models.User{
				ID:        *updateUserID,
				Name:      *updateUserName,
				Email:     *updateUserEmail,
				Role:      models.UserRole(*updateUserRole),
				CreatedAt: *updateUserCreatedAt,
				UpdatedAt: *updateUserUpdatedAt,
			}
			update.User = &updateUser
			update.UserID = updateUserID
		}

		// Staff users shouldn't see internal notes unless they're assigned or an admin
		if !update.IsInternalNote || userRole == models.RoleAdmin ||
			(assignedToUserID != nil && *assignedToUserID == userID) {
			updates = append(updates, update)
		}
	}

	return updates, nil
}

// getTicketAttachments gets all attachments for a ticket
func (h *Handler) getTicketAttachments(ctx context.Context, ticketID string) ([]models.Attachment, error) {
	rows, err := h.db.Pool.Query(ctx, `
		SELECT id, ticket_id, filename, storage_path, mime_type, size, uploaded_at
		FROM attachments
		WHERE ticket_id = $1
	`, ticketID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var attachments []models.Attachment
	for rows.Next() {
		var attachment models.Attachment
		if err := rows.Scan(
			&attachment.ID,
			&attachment.TicketID,
			&attachment.Filename,
			&attachment.StoragePath,
			&attachment.MimeType,
			&attachment.Size,
			&attachment.UploadedAt,
		); err != nil {
			return nil, err
		}

		attachments = append(attachments, attachment)
	}

	return attachments, nil
}

// checkTicketAccess checks if a user has access to a ticket
func (h *Handler) checkTicketAccess(
	ctx context.Context,
	ticketID string,
	userID string,
	isAdmin bool,
) (models.Ticket, error) {
	var ticket models.Ticket

	// Get the ticket
	row := h.db.Pool.QueryRow(ctx, `
		SELECT t.id, t.end_user_email, t.issue_type, t.urgency, t.subject, t.body, 
			t.status, t.assigned_to_user_id, t.created_at, t.updated_at, t.closed_at, 
			t.resolution_notes, u.id, u.name, u.email, u.role, u.created_at, u.updated_at
		FROM tickets t
		LEFT JOIN users u ON t.assigned_to_user_id = u.id
		WHERE t.id = $1
	`, ticketID)

	ticket, err := scanTicketWithUser(row)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ticket, errors.New("ticket not found")
		}
		return ticket, err
	}

	// Check if user has access
	if !isAdmin && ticket.AssignedToUserID != nil && *ticket.AssignedToUserID != userID {
		return ticket, errors.New("not authorized to access this ticket")
	}

	return ticket, nil
}
