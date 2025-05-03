// backend/internal/api/handlers/ticket/utils.go
// ==========================================================================
// Utility functions specific to the ticket handler package.
// Includes helpers for scanning rows, fetching related data, and checking access.
// **REVISED**: Renamed scanTicketWithUser to scanTicketWithUsersAndSubmitter
//              and ensured all necessary fields are scanned correctly.
// **REVISED AGAIN**: Simplified scanner to remove conditional total_count logic.
// **REVISED AGAIN**: Refined population logic for AssignedToUser and Submitter.
// **REVISED AGAIN**: Added detailed logging for scanned user pointers.
// **REVISED AGAIN**: Simplified AssignedToUser population based solely on scanned ID pointer.
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

// scanTicketWithUsersAndSubmitter scans a ticket row along with potentially joined assigned user and submitter data.
// It handles nullable user fields gracefully. It does NOT scan total_count.
//
// Parameters:
//   - rowScanner: An interface (like pgx.Row or pgx.Rows) that has a Scan method.
//
// Returns:
//   - models.Ticket: The scanned ticket object, potentially with AssignedToUser and Submitter populated.
//   - error: An error if scanning fails (e.g., pgx.ErrNoRows or type mismatch).
func scanTicketWithUsersAndSubmitter(rowScanner interface { Scan(...interface{}) error }) (models.Ticket, error) {
	var ticket models.Ticket
	var assignedUser models.User
	var submitterUser models.User

	// Use pointers for nullable fields from the LEFT JOINs
	var assignedUserID, assignedUserName, assignedUserEmail, assignedUserRole *string
	var assignedUserCreatedAt, assignedUserUpdatedAt *time.Time
	var submitterUserID, submitterUserName, submitterUserEmail, submitterUserRole *string
	var submitterUserCreatedAt, submitterUserUpdatedAt *time.Time

	// Define scan targets *without* total_count
	scanTargets := []interface{}{
		&ticket.ID, &ticket.TicketNumber, &ticket.SubmitterName, &ticket.EndUserEmail, &ticket.IssueType, &ticket.Urgency,
		&ticket.Subject, &ticket.Description, &ticket.Status, &ticket.AssignedToUserID, // Scan the FK ID directly into the ticket struct field
		&ticket.CreatedAt, &ticket.UpdatedAt, &ticket.ClosedAt, &ticket.ResolutionNotes,
		// Assigned user fields (scan into temporary pointers)
		&assignedUserID, &assignedUserName, &assignedUserEmail, &assignedUserRole,
		&assignedUserCreatedAt, &assignedUserUpdatedAt,
		// Submitter user fields (scan into temporary pointers)
		&submitterUserID, &submitterUserName, &submitterUserEmail, &submitterUserRole,
		&submitterUserCreatedAt, &submitterUserUpdatedAt,
	}

	err := rowScanner.Scan(scanTargets...)
	if err != nil {
		// Let the caller handle ErrNoRows specifically if needed
		return ticket, err
	}

	// Log scanned pointer values
	slog.Debug("Scanned Pointer Values",
		"ticketID", ticket.ID,
		"ticket.AssignedToUserID", ticket.AssignedToUserID, // Log the FK value
		"scannedAssignedUserID", assignedUserID,
		"scannedAssignedUserName", assignedUserName,
		"scannedSubmitterUserID", submitterUserID,
		"scannedSubmitterUserName", submitterUserName,
	)


	// --- Populate AssignedToUser ---
	// *** SIMPLIFIED LOGIC: Populate only if the joined user ID was successfully scanned ***
	if assignedUserID != nil {
		// User found via JOIN, populate fully
		assignedUser = models.User{
			ID:        *assignedUserID,
			Name:      *assignedUserName, // Assume other fields are also non-nil if ID is non-nil
			Email:     *assignedUserEmail,
			Role:      models.UserRole(*assignedUserRole),
			CreatedAt: *assignedUserCreatedAt,
			UpdatedAt: *assignedUserUpdatedAt,
		}
		ticket.AssignedToUser = &assignedUser
		slog.Debug("Populating AssignedToUser (Full - based on scanned ID)", "userID", assignedUser.ID, "userName", assignedUser.Name)
	} else {
		// Either ticket.AssignedToUserID was NULL, or the JOIN failed (user deleted?)
		// In either case, AssignedToUser should be nil.
		ticket.AssignedToUser = nil
		slog.Debug("Populating AssignedToUser (Nil - scanned ID was nil)", "ticket.AssignedToUserID", ticket.AssignedToUserID)
	}


	// --- Populate Submitter ---
	// Check if the LEFT JOIN found a corresponding user based on email
	if submitterUserID != nil {
		submitterUser = models.User{
			ID:        *submitterUserID,
			Name:      *submitterUserName,
			Email:     *submitterUserEmail,
			Role:      models.UserRole(*submitterUserRole),
			CreatedAt: *submitterUserCreatedAt,
			UpdatedAt: *submitterUserUpdatedAt,
		}
		ticket.Submitter = &submitterUser
		slog.Debug("Populating Submitter (Full)", "userID", submitterUser.ID, "userName", submitterUser.Name)
	} else {
		// No matching user found for the end_user_email
		ticket.Submitter = nil
		slog.Debug("Populating Submitter (Nil)")
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

	// Fetch the ticket along with assignee ID for the check
	// Use the same query as GetTicketByID to ensure consistency
	row := h.db.Pool.QueryRow(ctx, `
        SELECT
            t.id, t.ticket_number, t.submitter_name, t.end_user_email, t.issue_type, t.urgency, t.subject,
            t.description, t.status, t.assigned_to_user_id, t.created_at, t.updated_at,
            t.closed_at, t.resolution_notes,
            -- Assigned user details (nullable)
            a.id as assigned_user_id, a.name as assigned_user_name, a.email as assigned_user_email,
            a.role as assigned_user_role, a.created_at as assigned_user_created_at, a.updated_at as assigned_user_updated_at,
            -- Submitter details (nullable)
            s.id as submitter_user_id, s.name as submitter_user_name, s.email as submitter_user_email,
            s.role as submitter_user_role, s.created_at as submitter_user_created_at, s.updated_at as submitter_user_updated_at
        FROM tickets t
        LEFT JOIN users a ON t.assigned_to_user_id = a.id
        LEFT JOIN users s ON t.end_user_email = s.email
        WHERE t.id = $1
    `, ticketID)

	// Use the simplified scanning helper
	ticket, err := scanTicketWithUsersAndSubmitter(row)
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
