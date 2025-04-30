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
		&ticket.Subject, &ticket.Description, &ticket.Status, &ticket.AssignedToUserID,
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
