package ticket

import (
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/henrythedeveloper/bus-it-ticket/internal/api/middleware/auth"
	"github.com/henrythedeveloper/bus-it-ticket/internal/models"
	"github.com/jackc/pgx/v5"
	"github.com/labstack/echo/v4"
)

// GetAllTickets returns all tickets with filtering
func (h *Handler) GetAllTickets(c echo.Context) error {
	ctx := c.Request().Context()

	// Get user role and ID from context
	userRole, err := auth.GetUserRoleFromContext(c)
	if err != nil {
		return err
	}
	userID, err := auth.GetUserIDFromContext(c)
	if err != nil {
		return err
	}

	// Build query based on filters
	query := `
		SELECT t.id, t.ticket_number, t.end_user_email, t.issue_type, t.urgency, t.subject, t.body, 
			t.status, t.assigned_to_user_id, t.created_at, t.updated_at, t.closed_at, 
			t.resolution_notes, u.id, u.name, u.email, u.role, u.created_at, u.updated_at
		FROM tickets t
		LEFT JOIN users u ON t.assigned_to_user_id = u.id
		WHERE 1=1
	`
	args := []interface{}{}
	paramCount := 0

	// Apply filters
	status := c.QueryParam("status")
	if status != "" {
		paramCount++
		query += fmt.Sprintf(" AND t.status = $%d", paramCount)
		args = append(args, status)
	}

	urgency := c.QueryParam("urgency")
	if urgency != "" {
		paramCount++
		query += fmt.Sprintf(" AND t.urgency = $%d", paramCount)
		args = append(args, urgency)
	}

	assignedTo := c.QueryParam("assigned_to")
	if assignedTo != "" {
		if assignedTo == "me" {
			paramCount++
			query += fmt.Sprintf(" AND t.assigned_to_user_id = $%d", paramCount)
			args = append(args, userID)
		} else if assignedTo == "unassigned" {
			query += " AND t.assigned_to_user_id IS NULL"
		} else {
			paramCount++
			query += fmt.Sprintf(" AND t.assigned_to_user_id = $%d", paramCount)
			args = append(args, assignedTo)
		}
	}

	// Staff members can only see tickets assigned to them unless they're admins
	if userRole != models.RoleAdmin {
		paramCount++
		query += fmt.Sprintf(" AND (t.assigned_to_user_id = $%d OR t.assigned_to_user_id IS NULL)", paramCount)
		args = append(args, userID)
	}

	query += " ORDER BY t.created_at DESC"

	// Get tickets from database
	rows, err := h.db.Pool.Query(ctx, query, args...)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to get tickets")
	}
	defer rows.Close()

	var tickets []models.Ticket
	for rows.Next() {
		var ticket models.Ticket
		var assignedToUser models.User
		var userID, userName, userEmail, userRole *string
		var userCreatedAt, userUpdatedAt *time.Time

		if err := rows.Scan(
			&ticket.ID,
			&ticket.TicketNumber,
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
		); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "failed to scan ticket")
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

		tickets = append(tickets, ticket)
	}

	return c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    tickets,
	})
}

// GetTicketByID returns a ticket by ID
func (h *Handler) GetTicketByID(c echo.Context) error {
	ticketID := c.Param("id")
	if ticketID == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "missing ticket ID")
	}

	ctx := c.Request().Context()

	// Get user role and ID from context
	userRole, err := auth.GetUserRoleFromContext(c)
	if err != nil {
		return err
	}
	userID, err := auth.GetUserIDFromContext(c)
	if err != nil {
		return err
	}

	// Get ticket from database
	var ticket models.Ticket
	var assignedToUser models.User
	var userID_db, userName, userEmail, userRole_db *string
	var userCreatedAt, userUpdatedAt *time.Time

	err = h.db.Pool.QueryRow(ctx, `
		SELECT t.id, t.ticket_number, t.end_user_email, t.issue_type, t.urgency, t.subject, t.body, 
			t.status, t.assigned_to_user_id, t.created_at, t.updated_at, t.closed_at, 
			t.resolution_notes, u.id, u.name, u.email, u.role, u.created_at, u.updated_at
		FROM tickets t
		LEFT JOIN users u ON t.assigned_to_user_id = u.id
		WHERE t.id = $1
	`, ticketID).Scan(
		&ticket.ID,
		&ticket.TicketNumber,
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
		&userID_db,
		&userName,
		&userEmail,
		&userRole_db,
		&userCreatedAt,
		&userUpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return echo.NewHTTPError(http.StatusNotFound, "ticket not found")
		}
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to get ticket")
	}

	// Check if user has permission to view this ticket
	if userRole != models.RoleAdmin && ticket.AssignedToUserID != nil && *ticket.AssignedToUserID != userID {
		return echo.NewHTTPError(http.StatusForbidden, "not authorized to view this ticket")
	}

	// Include assigned user if present
	if ticket.AssignedToUserID != nil && userID_db != nil {
		assignedToUser = models.User{
			ID:        *userID_db,
			Name:      *userName,
			Email:     *userEmail,
			Role:      models.UserRole(*userRole_db),
			CreatedAt: *userCreatedAt,
			UpdatedAt: *userUpdatedAt,
		}
		ticket.AssignedToUser = &assignedToUser
	}

	// Get ticket tags
	rows, err := h.db.Pool.Query(ctx, `
		SELECT t.id, t.name, t.created_at
		FROM tags t
		JOIN ticket_tags tt ON t.id = tt.tag_id
		WHERE tt.ticket_id = $1
	`, ticketID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to get ticket tags")
	}
	defer rows.Close()

	var tags []models.Tag
	for rows.Next() {
		var tag models.Tag
		if err := rows.Scan(&tag.ID, &tag.Name, &tag.CreatedAt); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "failed to scan tag")
		}
		tags = append(tags, tag)
	}
	ticket.Tags = tags

	// Get ticket updates/comments
	rows, err = h.db.Pool.Query(ctx, `
		SELECT tu.id, tu.ticket_id, tu.user_id, tu.comment, tu.is_internal_note, tu.created_at,
			u.id, u.name, u.email, u.role, u.created_at, u.updated_at
		FROM ticket_updates tu
		LEFT JOIN users u ON tu.user_id = u.id
		WHERE tu.ticket_id = $1
		ORDER BY tu.created_at
	`, ticketID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to get ticket updates")
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
			return echo.NewHTTPError(http.StatusInternalServerError, "failed to scan ticket update")
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
			(ticket.AssignedToUserID != nil && *ticket.AssignedToUserID == userID) {
			updates = append(updates, update)
		}
	}
	ticket.Updates = updates

	// Get ticket attachments
	rows, err = h.db.Pool.Query(ctx, `
		SELECT id, ticket_id, filename, storage_path, mime_type, size, uploaded_at
		FROM attachments
		WHERE ticket_id = $1
	`, ticketID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to get ticket attachments")
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
			return echo.NewHTTPError(http.StatusInternalServerError, "failed to scan attachment")
		}

		attachments = append(attachments, attachment)
	}
	ticket.Attachments = attachments

	return c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    ticket,
	})
}

// GetTicketCounts returns counts of tickets by status
func (h *Handler) GetTicketCounts(c echo.Context) error {
	ctx := c.Request().Context()

	// Get user ID and role from context
	userID, err := auth.GetUserIDFromContext(c)
	if err != nil {
		return err
	}
	userRole, err := auth.GetUserRoleFromContext(c)
	if err != nil {
		return err
	}

	// Build the query based on the user's role
	query := `
		SELECT
			COUNT(*) FILTER (WHERE status = 'Unassigned') AS unassigned,
			COUNT(*) FILTER (WHERE status = 'Assigned') AS assigned,
			COUNT(*) FILTER (WHERE status = 'In Progress') AS in_progress,
			COUNT(*) FILTER (WHERE status = 'Closed') AS closed,
			COUNT(*) AS total
		FROM tickets
	`

	// If not admin, only count tickets assigned to the user or unassigned
	if userRole != models.RoleAdmin {
		query += ` WHERE assigned_to_user_id = $1 OR assigned_to_user_id IS NULL`
	}

	// Execute the query
	var counts struct {
		Unassigned int `json:"unassigned"`
		Assigned   int `json:"assigned"`
		InProgress int `json:"in_progress"`
		Closed     int `json:"closed"`
		Total      int `json:"total"`
	}

	if userRole == models.RoleAdmin {
		err = h.db.Pool.QueryRow(ctx, query).Scan(
			&counts.Unassigned,
			&counts.Assigned,
			&counts.InProgress,
			&counts.Closed,
			&counts.Total,
		)
	} else {
		err = h.db.Pool.QueryRow(ctx, query, userID).Scan(
			&counts.Unassigned,
			&counts.Assigned,
			&counts.InProgress,
			&counts.Closed,
			&counts.Total,
		)
	}

	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to get ticket counts")
	}

	return c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    counts,
	})
}

// SearchTickets searches for tickets based on the query
func (h *Handler) SearchTickets(c echo.Context) error {
	query := c.QueryParam("q")
	if query == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "search query is required")
	}

	ctx := c.Request().Context()

	// Get user ID and role from context
	userID, err := auth.GetUserIDFromContext(c)
	if err != nil {
		return err
	}
	userRole, err := auth.GetUserRoleFromContext(c)
	if err != nil {
		return err
	}

	// Build the search query
	searchQuery := `
		SELECT t.id, t.end_user_email, t.issue_type, t.urgency, t.subject, t.body, 
			t.status, t.assigned_to_user_id, t.created_at, t.updated_at, t.closed_at, 
			t.resolution_notes, u.id, u.name, u.email, u.role, u.created_at, u.updated_at
		FROM tickets t
		LEFT JOIN users u ON t.assigned_to_user_id = u.id
		WHERE (
			t.subject ILIKE $1 OR
			t.body ILIKE $1 OR
			t.end_user_email ILIKE $1 OR
			t.issue_type ILIKE $1
		)
	`

	args := []interface{}{
		"%" + query + "%", // Add wildcards for LIKE query
	}
	paramCount := 1

	// Staff members can only see tickets assigned to them unless they're admins
	if userRole != models.RoleAdmin {
		paramCount++
		searchQuery += fmt.Sprintf(" AND (t.assigned_to_user_id = $%d OR t.assigned_to_user_id IS NULL)", paramCount)
		args = append(args, userID)
	}

	searchQuery += " ORDER BY t.created_at DESC LIMIT 50"

	// Execute the search
	rows, err := h.db.Pool.Query(ctx, searchQuery, args...)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to search tickets")
	}
	defer rows.Close()

	var tickets []models.Ticket
	for rows.Next() {
		var ticket models.Ticket
		var assignedToUser models.User
		var userID, userName, userEmail, userRole *string
		var userCreatedAt, userUpdatedAt *time.Time

		if err := rows.Scan(
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
		); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "failed to scan ticket")
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

		tickets = append(tickets, ticket)
	}

	return c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    tickets,
	})
}
