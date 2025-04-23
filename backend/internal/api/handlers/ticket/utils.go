// backend/internal/api/handlers/ticket/utils.go
// ==========================================================================
// Utility functions specific to the ticket handler package.
// Includes helpers for scanning rows, fetching related data, and checking access.
// ==========================================================================

package ticket

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/henrythedeveloper/it-ticket-system/internal/models" // Data models
	"github.com/jackc/pgx/v5"
)

// --- Row Scanning Helper ---

// scanTicketWithUser scans a ticket row along with potentially joined assigned user data.
// It handles nullable user fields gracefully.
//
// Parameters:
//   - row: A pgx.Row object obtained from QueryRow.
//
// Returns:
//   - models.Ticket: The scanned ticket object, potentially with AssignedToUser populated.
//   - error: An error if scanning fails (e.g., pgx.ErrNoRows or type mismatch).
func scanTicketWithUser(row pgx.Row) (models.Ticket, error) {
	var ticket models.Ticket
	var assignedUser models.User
	// Use pointers for nullable fields from the LEFT JOIN
	var assignedUserID, assignedUserName, assignedUserEmail, assignedUserRole *string
	var assignedUserCreatedAt, assignedUserUpdatedAt *time.Time

	err := row.Scan(
		&ticket.ID, &ticket.TicketNumber, &ticket.EndUserEmail, &ticket.IssueType, &ticket.Urgency,
		&ticket.Subject, &ticket.Body, &ticket.Status, &ticket.AssignedToUserID,
		&ticket.CreatedAt, &ticket.UpdatedAt, &ticket.ClosedAt, &ticket.ResolutionNotes,
		// Scan into nullable pointers for assigned user
		&assignedUserID, &assignedUserName, &assignedUserEmail, &assignedUserRole,
		&assignedUserCreatedAt, &assignedUserUpdatedAt,
	)
	if err != nil {
		// Let the caller handle ErrNoRows specifically if needed
		return ticket, err
	}

	// Populate assigned user struct only if the user ID from the JOIN is not NULL
	if ticket.AssignedToUserID != nil && assignedUserID != nil {
		assignedUser = models.User{
			ID:        *assignedUserID,
			Name:      *assignedUserName,
			Email:     *assignedUserEmail,
			Role:      models.UserRole(*assignedUserRole), // Cast role string
			CreatedAt: *assignedUserCreatedAt,
			UpdatedAt: *assignedUserUpdatedAt,
		}
		ticket.AssignedToUser = &assignedUser
	}

	return ticket, nil
}

// --- Related Data Fetching Helpers ---

// getTicketTags fetches all tags associated with a specific ticket ID.
//
// Parameters:
//   - ctx: The request context.
//   - ticketID: The UUID of the ticket.
//
// Returns:
//   - []models.Tag: A slice of tags associated with the ticket.
//   - error: An error if the database query fails.
func (h *Handler) getTicketTags(ctx context.Context, ticketID string) ([]models.Tag, error) {
	logger := slog.With("helper", "getTicketTags", "ticketUUID", ticketID)
	query := `
        SELECT tg.id, tg.name, tg.created_at
        FROM tags tg
        JOIN ticket_tags tt ON tg.id = tt.tag_id
        WHERE tt.ticket_id = $1
        ORDER BY tg.name ASC
    `
	rows, err := h.db.Pool.Query(ctx, query, ticketID)
	if err != nil {
		logger.ErrorContext(ctx, "Failed to query ticket tags", "error", err)
		return nil, fmt.Errorf("database error fetching tags: %w", err)
	}
	defer rows.Close()

	tags := make([]models.Tag, 0)
	for rows.Next() {
		var tag models.Tag
		if err := rows.Scan(&tag.ID, &tag.Name, &tag.CreatedAt); err != nil {
			logger.ErrorContext(ctx, "Failed to scan tag row", "error", err)
			// Continue scanning other rows? Or return immediately? Returning error for now.
			return nil, fmt.Errorf("database error scanning tag: %w", err)
		}
		tags = append(tags, tag)
	}

	if err = rows.Err(); err != nil {
		logger.ErrorContext(ctx, "Error iterating tag rows", "error", err)
		return nil, fmt.Errorf("database error processing tags: %w", err)
	}

	logger.DebugContext(ctx, "Fetched tags successfully", "count", len(tags))
	return tags, nil
}

// getTicketUpdates fetches all updates/comments for a specific ticket ID.
// It filters out internal notes for non-staff/admin users unless they are the assignee.
//
// Parameters:
//   - ctx: The request context.
//   - ticketID: The UUID of the ticket.
//   - requestingUserID: The ID of the user making the request (for permission checks).
//   - requestingUserRole: The role of the user making the request.
//   - ticketAssignedToUserID: Pointer to the ID of the user the ticket is assigned to (can be nil).
//
// Returns:
//   - []models.TicketUpdate: A slice of filtered updates/comments.
//   - error: An error if the database query fails.
func (h *Handler) getTicketUpdates(
	ctx context.Context,
	ticketID string,
	requestingUserID string,
	requestingUserRole models.UserRole,
	ticketAssignedToUserID *string,
) ([]models.TicketUpdate, error) {
	logger := slog.With("helper", "getTicketUpdates", "ticketUUID", ticketID)
	query := `
        SELECT
            tu.id, tu.ticket_id, tu.user_id, tu.comment, tu.is_internal_note, tu.created_at,
            -- User details (nullable)
            u.id as author_id, u.name as author_name, u.email as author_email,
            u.role as author_role, u.created_at as author_created_at, u.updated_at as author_updated_at
        FROM ticket_updates tu
        LEFT JOIN users u ON tu.user_id = u.id -- LEFT JOIN handles NULL user_id (system) or deleted users
        WHERE tu.ticket_id = $1
        ORDER BY tu.created_at ASC -- Show oldest first
    `
	rows, err := h.db.Pool.Query(ctx, query, ticketID)
	if err != nil {
		logger.ErrorContext(ctx, "Failed to query ticket updates", "error", err)
		return nil, fmt.Errorf("database error fetching updates: %w", err)
	}
	defer rows.Close()

	updates := make([]models.TicketUpdate, 0)
	isAssignee := ticketAssignedToUserID != nil && *ticketAssignedToUserID == requestingUserID

	for rows.Next() {
		var update models.TicketUpdate
		var author models.User
		var authorID, authorName, authorEmail, authorRole *string // Nullable pointers
		var authorCreatedAt, authorUpdatedAt *time.Time

		if err := rows.Scan(
			&update.ID, &update.TicketID, &update.UserID, // UserID from ticket_updates might be NULL
			&update.Comment, &update.IsInternalNote, &update.CreatedAt,
			// Scan author details into nullable pointers
			&authorID, &authorName, &authorEmail, &authorRole,
			&authorCreatedAt, &authorUpdatedAt,
		); err != nil {
			logger.ErrorContext(ctx, "Failed to scan ticket update row", "error", err)
			return nil, fmt.Errorf("database error scanning update: %w", err)
		}

		// Populate author details if available
		if update.UserID != nil && authorID != nil { // Check both user_id from update and joined id
			author = models.User{
				ID: *authorID, Name: *authorName, Email: *authorEmail,
				Role: models.UserRole(*authorRole), CreatedAt: *authorCreatedAt, UpdatedAt: *authorUpdatedAt,
			}
			update.User = &author
		} else if update.UserID == nil {
			// Indicate system update if user_id is NULL
			update.User = &models.User{Name: "System"}
		} else {
			// User ID exists in update, but user not found in users table (deleted?)
			update.User = &models.User{ID: *update.UserID, Name: "Unknown User"}
			logger.WarnContext(ctx, "Author details not found for update", "authorUserID", *update.UserID)
		}

		// --- Filter Internal Notes ---
		// Show the update if:
		// 1. It's NOT an internal note OR
		// 2. The requesting user is an Admin OR
		// 3. The requesting user is the ticket assignee
		if !update.IsInternalNote || requestingUserRole == models.RoleAdmin || isAssignee {
			updates = append(updates, update)
		}
	}

	if err = rows.Err(); err != nil {
		logger.ErrorContext(ctx, "Error iterating update rows", "error", err)
		return nil, fmt.Errorf("database error processing updates: %w", err)
	}

	logger.DebugContext(ctx, "Fetched updates successfully", "count", len(updates))
	return updates, nil
}

// getTicketAttachments fetches metadata for all attachments associated with a ticket ID.
//
// Parameters:
//   - ctx: The request context.
//   - ticketID: The UUID of the ticket.
//
// Returns:
//   - []models.Attachment: A slice of attachment metadata objects.
//   - error: An error if the database query fails.
func (h *Handler) getTicketAttachments(ctx context.Context, ticketID string) ([]models.Attachment, error) {
	logger := slog.With("helper", "getTicketAttachments", "ticketUUID", ticketID)
	query := `
        SELECT id, ticket_id, filename, storage_path, mime_type, size, uploaded_at
        FROM attachments
        WHERE ticket_id = $1
        ORDER BY uploaded_at ASC
    `
	rows, err := h.db.Pool.Query(ctx, query, ticketID)
	if err != nil {
		logger.ErrorContext(ctx, "Failed to query ticket attachments", "error", err)
		return nil, fmt.Errorf("database error fetching attachments: %w", err)
	}
	defer rows.Close()

	attachments := make([]models.Attachment, 0)
	for rows.Next() {
		var attachment models.Attachment
		if err := rows.Scan(
			&attachment.ID, &attachment.TicketID, &attachment.Filename,
			&attachment.StoragePath, &attachment.MimeType, &attachment.Size, &attachment.UploadedAt,
		); err != nil {
			logger.ErrorContext(ctx, "Failed to scan attachment row", "error", err)
			return nil, fmt.Errorf("database error scanning attachment: %w", err)
		}
		attachments = append(attachments, attachment)
	}

	if err = rows.Err(); err != nil {
		logger.ErrorContext(ctx, "Error iterating attachment rows", "error", err)
		return nil, fmt.Errorf("database error processing attachments: %w", err)
	}

	logger.DebugContext(ctx, "Fetched attachments successfully", "count", len(attachments))
	return attachments, nil
}

// --- Access Control Helper (Example - adjust as needed) ---

// checkTicketAccess verifies if a user has permission to view/modify a specific ticket.
// This is a simplified example; real-world scenarios might be more complex.
//
// Parameters:
//   - ctx: The request context.
//   - ticketID: The UUID of the ticket.
//   - userID: The ID of the user making the request.
//   - isAdmin: Boolean indicating if the requesting user is an admin.
//
// Returns:
//   - models.Ticket: The ticket data if access is granted.
//   - error: An error indicating "not found", "not authorized", or a database failure.
func (h *Handler) checkTicketAccess(
	ctx context.Context,
	ticketID string,
	userID string,
	isAdmin bool,
) (models.Ticket, error) {
	logger := slog.With("helper", "checkTicketAccess", "ticketUUID", ticketID, "userID", userID, "isAdmin", isAdmin)
	var ticket models.Ticket

	// Fetch the ticket along with assignee ID for the check
	row := h.db.Pool.QueryRow(ctx, `
        SELECT
            t.id, t.ticket_number, t.end_user_email, t.issue_type, t.urgency, t.subject,
            t.body, t.status, t.assigned_to_user_id, t.created_at, t.updated_at,
            t.closed_at, t.resolution_notes,
            -- Assigned user details (needed for scanTicketWithUser)
            a.id, a.name, a.email, a.role, a.created_at, a.updated_at
        FROM tickets t
        LEFT JOIN users a ON t.assigned_to_user_id = a.id
        WHERE t.id = $1
    `, ticketID)

	// Use the scanning helper
	ticket, err := scanTicketWithUser(row)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			logger.WarnContext(ctx, "Ticket not found during access check")
			return ticket, errors.New("ticket not found") // Specific error type might be better
		}
		logger.ErrorContext(ctx, "Database error during access check", "error", err)
		return ticket, fmt.Errorf("database error checking access: %w", err)
	}

	// --- Permission Logic ---
	// Admins have access to all tickets.
	if isAdmin {
		logger.DebugContext(ctx, "Access granted (Admin)")
		return ticket, nil
	}

	// Staff users can access tickets assigned to them or unassigned tickets.
	isAssignedToUser := ticket.AssignedToUserID != nil && *ticket.AssignedToUserID == userID
	isUnassigned := ticket.AssignedToUserID == nil

	if isAssignedToUser || isUnassigned {
		logger.DebugContext(ctx, "Access granted (Assigned or Unassigned)")
		return ticket, nil
	}

	// If none of the above conditions match, the user is not authorized.
	logger.WarnContext(ctx, "Access denied", "assignedUserID", ticket.AssignedToUserID)
	return ticket, errors.New("not authorized to access this ticket") // Specific error type might be better
}
