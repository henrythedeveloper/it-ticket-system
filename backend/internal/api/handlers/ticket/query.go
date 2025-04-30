// backend/internal/api/handlers/ticket/query.go
// ==========================================================================
// Handler functions for querying ticket data (listing, searching, counts, details).
// **REVISED**: Added sorting and date range filtering to GetAllTickets.
// ==========================================================================

package ticket

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/henrythedeveloper/it-ticket-system/internal/api/middleware/auth" // Auth middleware helpers
	"github.com/henrythedeveloper/it-ticket-system/internal/models"              // Data models
	"github.com/jackc/pgx/v5"
	"github.com/labstack/echo/v4"
)

// --- Handler Functions ---

// GetAllTickets retrieves a list of tickets based on query parameters for filtering and pagination.
// Applies role-based access control (RBAC) to filter results appropriately.
//
// Query Parameters:
//   - status: Filter by ticket status (e.g., "Assigned", "Closed").
//   - urgency: Filter by ticket urgency (e.g., "High", "Low").
//   - assigned_to: Filter by assignee ID, "me", or "unassigned".
//   - submitter_id: Filter by submitter's user ID.
//   - page: Page number for pagination (default: 1).
//   - limit: Number of tickets per page (default: 15).
//   - sort_by: Field to sort by (e.g., "created_at", "updated_at", "ticket_number", "status", "urgency"). Default: "updated_at".
//   - sort_order: Sort direction ("asc" or "desc"). Default: "desc".
//   - tags: Comma-separated list of tag names to filter by.
//   - from_date: Filter tickets created/updated on or after this date (YYYY-MM-DD).
//   - to_date: Filter tickets created/updated on or before this date (YYYY-MM-DD).
//
// Returns:
//   - JSON response with paginated ticket data or an error response.
func (h *Handler) GetAllTickets(c echo.Context) error {
	ctx := c.Request().Context()
	logger := slog.With("handler", "GetAllTickets")

	// --- 1. Get User Context and Pagination/Filter Params ---
	userRole, err := auth.GetUserRoleFromContext(c)
	if err != nil { return err }
	userID, err := auth.GetUserIDFromContext(c)
	if err != nil { return err }

	// Extract filter parameters from query string
	filters := models.TicketFilter{
		Status:       parseTicketStatus(c.QueryParam("status")),
		Urgency:      parseTicketUrgency(c.QueryParam("urgency")),
		AssignedTo:   parseAssigneeFilter(c.QueryParam("assigned_to"), userID),
		SubmitterID:  parseStringPtr(c.QueryParam("submitter_id")),
		Tags:         parseTags(c.QueryParam("tags")),
		Search:       c.QueryParam("search"),
		Page:         parseInt(c.QueryParam("page"), 1),
		Limit:        parseInt(c.QueryParam("limit"), 15),
		SortBy:       parseSortBy(c.QueryParam("sort_by"), "updated_at", []string{"created_at", "updated_at", "ticket_number", "status", "urgency"}), // Validate sort field
		SortOrder:    parseSortOrder(c.QueryParam("sort_order"), "desc"),                                                                        // Validate sort order
		FromDate:     parseDate(c.QueryParam("from_date")),                                                                                     // Parse start date
		ToDate:       parseDate(c.QueryParam("to_date")),                                                                                       // Parse end date
	}

	logger.DebugContext(ctx, "Fetching tickets with filters", "filters", filters, "userRole", userRole)

	// --- 2. Build SQL Query ---
	queryBuilder := strings.Builder{}
	queryBuilder.WriteString(`
        SELECT
            t.id, t.ticket_number, t.submitter_email, t.issue_type, t.urgency, t.subject,
            t.description, t.status, t.assigned_to_user_id, t.created_at, t.updated_at,
            t.closed_at, t.resolution_notes,
            -- Assigned user details (nullable)
            a.id as assigned_user_id, a.name as assigned_user_name, a.email as assigned_user_email,
            a.role as assigned_user_role, a.created_at as assigned_user_created_at, a.updated_at as assigned_user_updated_at,
            -- Submitter details (nullable) - Assuming submitter_id links to users table
            s.id as submitter_user_id, s.name as submitter_user_name, s.email as submitter_user_email,
            s.role as submitter_user_role, s.created_at as submitter_user_created_at, s.updated_at as submitter_user_updated_at,
            -- Count total rows for pagination
            COUNT(*) OVER() AS total_count
        FROM tickets t
        LEFT JOIN users a ON t.assigned_to_user_id = a.id
        LEFT JOIN users s ON t.submitter_email = s.email -- Join based on email to get submitter details
    `) // Changed t.submitter_id to t.submitter_email for join
	args := []interface{}{}
	paramCount := 0

	// --- Apply WHERE clauses based on filters ---
	whereClauses := []string{"1=1"} // Start with a dummy clause

	if filters.Status != nil { paramCount++; whereClauses = append(whereClauses, fmt.Sprintf("t.status = $%d", paramCount)); args = append(args, *filters.Status) }
	if filters.Urgency != nil { paramCount++; whereClauses = append(whereClauses, fmt.Sprintf("t.urgency = $%d", paramCount)); args = append(args, *filters.Urgency) }
	if filters.AssignedTo != nil {
		if *filters.AssignedTo == "unassigned" { whereClauses = append(whereClauses, "t.assigned_to_user_id IS NULL")
		} else { paramCount++; whereClauses = append(whereClauses, fmt.Sprintf("t.assigned_to_user_id = $%d", paramCount)); args = append(args, *filters.AssignedTo) }
	}
	if filters.SubmitterID != nil { paramCount++; whereClauses = append(whereClauses, fmt.Sprintf("t.submitter_email ILIKE $%d", paramCount)); args = append(args, "%"+*filters.SubmitterID+"%") } // Filter by submitter email

	// --- RBAC Filter ---
	if userRole != models.RoleAdmin { paramCount++; whereClauses = append(whereClauses, fmt.Sprintf("(t.assigned_to_user_id = $%d OR t.assigned_to_user_id IS NULL)", paramCount)); args = append(args, userID) }

	// --- Tag Filtering ---
	if len(filters.Tags) > 0 { queryBuilder.WriteString(` JOIN ticket_tags tt ON t.id = tt.ticket_id JOIN tags tg ON tt.tag_id = tg.id `); paramCount++; whereClauses = append(whereClauses, fmt.Sprintf("tg.name = ANY($%d)", paramCount)); args = append(args, filters.Tags) }

	// --- Date Range Filtering ---
	if filters.FromDate != nil { paramCount++; whereClauses = append(whereClauses, fmt.Sprintf("t.updated_at >= $%d", paramCount)); args = append(args, *filters.FromDate) } // Filter by updated_at >= from_date
	if filters.ToDate != nil { paramCount++; whereClauses = append(whereClauses, fmt.Sprintf("t.updated_at <= $%d", paramCount)); args = append(args, (*filters.ToDate).Add(24*time.Hour-time.Nanosecond)) } // Filter by updated_at <= to_date (end of day)

	// --- Search Filtering ---
	if filters.Search != "" {
		paramCount++
		searchPattern := "%" + filters.Search + "%"
		whereClauses = append(whereClauses, fmt.Sprintf(`
            (t.subject ILIKE $%d OR t.description ILIKE $%d OR t.submitter_email ILIKE $%d OR CAST(t.ticket_number AS TEXT) ILIKE $%d)
        `, paramCount, paramCount, paramCount, paramCount))
		args = append(args, searchPattern)
	}

	// Append WHERE clauses
	if len(whereClauses) > 1 { queryBuilder.WriteString(" WHERE " + strings.Join(whereClauses, " AND ")) }

	// --- Apply ORDER BY and Pagination ---
	// Use validated sort field and order
	orderByClause := fmt.Sprintf(" ORDER BY t.%s %s, t.id %s", filters.SortBy, filters.SortOrder, filters.SortOrder) // Add secondary sort by ID
	queryBuilder.WriteString(orderByClause)
	paramCount++; queryBuilder.WriteString(fmt.Sprintf(" LIMIT $%d", paramCount)); args = append(args, filters.Limit)
	paramCount++; queryBuilder.WriteString(fmt.Sprintf(" OFFSET $%d", paramCount)); args = append(args, (filters.Page-1)*filters.Limit)

	// --- 3. Execute Query ---
	finalQuery := queryBuilder.String()
	logger.DebugContext(ctx, "Executing GetAllTickets query", "query", finalQuery, "args", args)

	rows, err := h.db.Pool.Query(ctx, finalQuery, args...)
	if err != nil { logger.ErrorContext(ctx, "Database query failed", "error", err); return echo.NewHTTPError(http.StatusInternalServerError, "Failed to retrieve tickets.") }
	defer rows.Close()

	// --- 4. Scan Results ---
	tickets := make([]models.Ticket, 0)
	var totalCount int = 0

	for rows.Next() {
		var ticket models.Ticket
		var assignedUser models.User
		var submitterUser models.User
		// Nullable fields for assigned user
		var assignedUserID, assignedUserName, assignedUserEmail, assignedUserRole *string
		var assignedUserCreatedAt, assignedUserUpdatedAt *time.Time
		// Nullable fields for submitter user
		var submitterUserID, submitterUserName, submitterUserEmail, submitterUserRole *string
		var submitterUserCreatedAt, submitterUserUpdatedAt *time.Time

		scanErr := rows.Scan(
			&ticket.ID, &ticket.TicketNumber, &ticket.SubmitterEmail, &ticket.IssueType, &ticket.Urgency,
			&ticket.Subject, &ticket.Description, &ticket.Status, &ticket.AssignedToUserID,
			&ticket.CreatedAt, &ticket.UpdatedAt, &ticket.ClosedAt, &ticket.ResolutionNotes,
			// Assigned user fields
			&assignedUserID, &assignedUserName, &assignedUserEmail, &assignedUserRole,
			&assignedUserCreatedAt, &assignedUserUpdatedAt,
			// Submitter user fields
			&submitterUserID, &submitterUserName, &submitterUserEmail, &submitterUserRole,
			&submitterUserCreatedAt, &submitterUserUpdatedAt,
			// Total count
			&totalCount,
		)
		if scanErr != nil { logger.ErrorContext(ctx, "Failed to scan ticket row", "error", scanErr); return echo.NewHTTPError(http.StatusInternalServerError, "Failed to process ticket data.") }

		// Populate assigned user struct if data exists
		if ticket.AssignedToUserID != nil && assignedUserID != nil {
			assignedUser = models.User{ ID: *assignedUserID, Name: *assignedUserName, Email: *assignedUserEmail, Role: models.UserRole(*assignedUserRole), CreatedAt: *assignedUserCreatedAt, UpdatedAt: *assignedUserUpdatedAt, }
			ticket.AssignedToUser = &assignedUser
		}
		// Populate submitter user struct if data exists
		if submitterUserID != nil {
			submitterUser = models.User{ ID: *submitterUserID, Name: *submitterUserName, Email: *submitterUserEmail, Role: models.UserRole(*submitterUserRole), CreatedAt: *submitterUserCreatedAt, UpdatedAt: *submitterUserUpdatedAt, }
			ticket.Submitter = &submitterUser
		}

		tickets = append(tickets, ticket)
	}

	if err = rows.Err(); err != nil { logger.ErrorContext(ctx, "Error iterating ticket rows", "error", err); return echo.NewHTTPError(http.StatusInternalServerError, "Failed to process ticket results.") }

	// --- 5. Return Paginated Response ---
	totalPages := 0
	if totalCount > 0 { totalPages = (totalCount + filters.Limit - 1) / filters.Limit }

	return c.JSON(http.StatusOK, models.PaginatedResponse{ Success: true, Message: "Tickets retrieved successfully.", Data: tickets, Total: totalCount, Page: filters.Page, Limit: filters.Limit, TotalPages: totalPages, HasMore: filters.Page < totalPages, })
}


// GetTicketByID retrieves details for a single ticket, including related data.
// (Function body remains the same as previous version, including the added logging)
func (h *Handler) GetTicketByID(c echo.Context) error {
	ctx := c.Request().Context()
	ticketID := c.Param("id")
	logger := slog.With("handler", "GetTicketByID", "ticketUUID", ticketID)

	if ticketID == "" { logger.WarnContext(ctx, "Missing ticket ID in request"); return echo.NewHTTPError(http.StatusBadRequest, "Missing ticket ID.") }

	// --- 1. Get User Context ---
	userRole, err := auth.GetUserRoleFromContext(c)
	if err != nil { return err }
	userID, err := auth.GetUserIDFromContext(c)
	if err != nil { return err }

	// --- 2. Fetch Core Ticket Data ---
	var ticket models.Ticket
	var assignedUser models.User
	var submitterUser models.User // Added to hold submitter data
	var assignedUserID, assignedUserName, assignedUserEmail, assignedUserRole *string
	var assignedUserCreatedAt, assignedUserUpdatedAt *time.Time
	var submitterUserID, submitterUserName, submitterUserEmail, submitterUserRole *string // Nullable pointers for submitter
	var submitterUserCreatedAt, submitterUserUpdatedAt *time.Time

	err = h.db.Pool.QueryRow(ctx, `
        SELECT
            t.id, t.ticket_number, t.submitter_email, t.issue_type, t.urgency, t.subject,
            t.description, t.status, t.assigned_to_user_id, t.created_at, t.updated_at,
            t.closed_at, t.resolution_notes,
            -- Assigned user details
            a.id, a.name, a.email, a.role, a.created_at, a.updated_at,
            -- Submitter user details
            s.id, s.name, s.email, s.role, s.created_at, s.updated_at
        FROM tickets t
        LEFT JOIN users a ON t.assigned_to_user_id = a.id
        LEFT JOIN users s ON t.submitter_email = s.email -- Join based on email
        WHERE t.id = $1
    `, ticketID).Scan(
		&ticket.ID, &ticket.TicketNumber, &ticket.SubmitterEmail, &ticket.IssueType, &ticket.Urgency,
		&ticket.Subject, &ticket.Description, &ticket.Status, &ticket.AssignedToUserID,
		&ticket.CreatedAt, &ticket.UpdatedAt, &ticket.ClosedAt, &ticket.ResolutionNotes,
		// Assigned user fields
		&assignedUserID, &assignedUserName, &assignedUserEmail, &assignedUserRole,
		&assignedUserCreatedAt, &assignedUserUpdatedAt,
		// Submitter user fields
		&submitterUserID, &submitterUserName, &submitterUserEmail, &submitterUserRole,
		&submitterUserCreatedAt, &submitterUserUpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) { logger.WarnContext(ctx, "Ticket not found"); return echo.NewHTTPError(http.StatusNotFound, "Ticket not found.") }
		logger.ErrorContext(ctx, "Failed to query ticket by ID", "error", err); return echo.NewHTTPError(http.StatusInternalServerError, "Failed to retrieve ticket details.")
	}

	// --- 3. RBAC Check ---
	if userRole != models.RoleAdmin && ticket.AssignedToUserID != nil && *ticket.AssignedToUserID != userID {
		logger.WarnContext(ctx, "Unauthorized attempt to view ticket", "requestingUserID", userID, "assignedUserID", *ticket.AssignedToUserID)
		return echo.NewHTTPError(http.StatusForbidden, "Not authorized to view this ticket.")
	}

	// Populate assigned user struct
	if ticket.AssignedToUserID != nil && assignedUserID != nil {
		assignedUser = models.User{ ID: *assignedUserID, Name: *assignedUserName, Email: *assignedUserEmail, Role: models.UserRole(*assignedUserRole), CreatedAt: *assignedUserCreatedAt, UpdatedAt: *assignedUserUpdatedAt, }
		ticket.AssignedToUser = &assignedUser
	}
	// Populate submitter user struct
	if submitterUserID != nil {
		submitterUser = models.User{ ID: *submitterUserID, Name: *submitterUserName, Email: *submitterUserEmail, Role: models.UserRole(*submitterUserRole), CreatedAt: *submitterUserCreatedAt, UpdatedAt: *submitterUserUpdatedAt, }
		ticket.Submitter = &submitterUser
	}


	// --- 4. Fetch Related Data Concurrently ---
	errChan := make(chan error, 3)
	tagsChan := make(chan []models.Tag, 1)
	updatesChan := make(chan []models.TicketUpdate, 1)
	attachmentsChan := make(chan []models.Attachment, 1)

	go func() { tags, err := h.getTicketTags(ctx, ticketID); if err != nil { errChan <- fmt.Errorf("failed to get ticket tags: %w", err); return }; tagsChan <- tags }()
	go func() { updates, err := h.getTicketUpdates(ctx, ticketID, userID, userRole, ticket.AssignedToUserID); if err != nil { errChan <- fmt.Errorf("failed to get ticket updates: %w", err); return }; updatesChan <- updates }()
	go func() { attachments, err := h.getTicketAttachments(ctx, ticketID); if err != nil { errChan <- fmt.Errorf("failed to get ticket attachments: %w", err); return }; attachmentsChan <- attachments }()

	var fetchError error
	for i := 0; i < 3; i++ {
		select {
		case tags := <-tagsChan: ticket.Tags = tags
		case updates := <-updatesChan: ticket.Updates = updates
		case attachments := <-attachmentsChan:
			for j := range attachments { attachments[j].URL = fmt.Sprintf("/api/attachments/download/%s", attachments[j].ID) }
			ticket.Attachments = attachments
		case err := <-errChan: if fetchError == nil { fetchError = err } else { logger.ErrorContext(ctx, "Multiple errors fetching related ticket data", "additionalError", err) }
		case <-ctx.Done(): logger.WarnContext(ctx, "Context cancelled while fetching related ticket data", "error", ctx.Err()); return echo.NewHTTPError(http.StatusInternalServerError, "Request timed out while fetching ticket details.")
		}
	}

	if fetchError != nil { logger.ErrorContext(ctx, "Error fetching related ticket data", "error", fetchError); return echo.NewHTTPError(http.StatusInternalServerError, "Failed to retrieve all ticket details.") }

	// --- 5. Log Final Data ---
	jsonData, jsonErr := json.MarshalIndent(ticket, "", "  ")
	if jsonErr != nil { logger.ErrorContext(ctx, "Failed to marshal final ticket data for logging", "error", jsonErr)
	} else { logger.DebugContext(ctx, "Final ticket data being sent in response", "ticketData", string(jsonData)) }

	// --- 6. Return Success Response ---
	logger.DebugContext(ctx, "Successfully retrieved ticket details")
	return c.JSON(http.StatusOK, models.APIResponse{ Success: true, Data:    ticket, })
}


// GetTicketCounts retrieves counts of tickets grouped by status.
// (Function body remains the same)
func (h *Handler) GetTicketCounts(c echo.Context) error {
	ctx := c.Request().Context()
	logger := slog.With("handler", "GetTicketCounts")

	// --- 1. Get User Context ---
	userRole, err := auth.GetUserRoleFromContext(c)
	if err != nil { return err }
	userID, err := auth.GetUserIDFromContext(c)
	if err != nil { return err }

	// --- 2. Build Query ---
	query := `
        SELECT
            COUNT(*) FILTER (WHERE status = 'Unassigned') AS unassigned,
            COUNT(*) FILTER (WHERE status = 'Assigned') AS assigned,
            COUNT(*) FILTER (WHERE status = 'In Progress') AS in_progress,
            COUNT(*) FILTER (WHERE status = 'Closed') AS closed,
            COUNT(*) AS total
        FROM tickets
    `
	args := []interface{}{}
	if userRole != models.RoleAdmin { query += ` WHERE assigned_to_user_id = $1 OR assigned_to_user_id IS NULL`; args = append(args, userID) }

	// --- 3. Execute Query ---
	logger.DebugContext(ctx, "Executing GetTicketCounts query", "query", query, "args", args)
	var counts struct { Unassigned int `json:"unassigned"`; Assigned int `json:"assigned"`; InProgress int `json:"in_progress"`; Closed int `json:"closed"`; Total int `json:"total"` }
	err = h.db.Pool.QueryRow(ctx, query, args...).Scan( &counts.Unassigned, &counts.Assigned, &counts.InProgress, &counts.Closed, &counts.Total, )
	if err != nil { logger.ErrorContext(ctx, "Failed to execute GetTicketCounts query", "error", err); return echo.NewHTTPError(http.StatusInternalServerError, "Failed to retrieve ticket counts.") }

	// --- 4. Return Response ---
	logger.DebugContext(ctx, "Ticket counts retrieved successfully", "counts", counts)
	return c.JSON(http.StatusOK, models.APIResponse{ Success: true, Data: counts, })
}


// SearchTickets performs a basic search across multiple ticket fields.
// (Function body remains the same)
func (h *Handler) SearchTickets(c echo.Context) error {
	ctx := c.Request().Context()
	query := c.QueryParam("q")
	limit := parseInt(c.QueryParam("limit"), 50)
	logger := slog.With("handler", "SearchTickets", "query", query)

	if query == "" { logger.WarnContext(ctx, "Missing search query parameter 'q'"); return echo.NewHTTPError(http.StatusBadRequest, "Search query 'q' is required.") }

	// --- 1. Get User Context ---
	userRole, err := auth.GetUserRoleFromContext(c)
	if err != nil { return err }
	userID, err := auth.GetUserIDFromContext(c)
	if err != nil { return err }

	// --- 2. Build Search Query ---
	searchQuery := `
        SELECT
            t.id, t.ticket_number, t.submitter_email, t.issue_type, t.urgency, t.subject,
            t.description, t.status, t.assigned_to_user_id, t.created_at, t.updated_at,
            t.closed_at, t.resolution_notes,
            a.id as assigned_user_id, a.name as assigned_user_name, a.email as assigned_user_email,
            a.role as assigned_user_role, a.created_at as assigned_user_created_at, a.updated_at as assigned_user_updated_at,
            s.id as submitter_user_id, s.name as submitter_user_name, s.email as submitter_user_email,
            s.role as submitter_user_role, s.created_at as submitter_user_created_at, s.updated_at as submitter_user_updated_at
        FROM tickets t
        LEFT JOIN users a ON t.assigned_to_user_id = a.id
        LEFT JOIN users s ON t.submitter_email = s.email
        WHERE ( t.subject ILIKE $1 OR t.description ILIKE $1 OR t.submitter_email ILIKE $1 OR CAST(t.ticket_number AS TEXT) ILIKE $1 )
    ` // Changed t.submitter_id to t.submitter_email
	searchPattern := "%" + query + "%"
	args := []interface{}{searchPattern}
	paramCount := 1
	if userRole != models.RoleAdmin { paramCount++; searchQuery += fmt.Sprintf(" AND (t.assigned_to_user_id = $%d OR t.assigned_to_user_id IS NULL)", paramCount); args = append(args, userID) }
	searchQuery += " ORDER BY t.updated_at DESC"
	paramCount++; searchQuery += fmt.Sprintf(" LIMIT $%d", paramCount); args = append(args, limit)

	// --- 3. Execute Query ---
	logger.DebugContext(ctx, "Executing SearchTickets query", "query", searchQuery, "argsCount", len(args))
	rows, err := h.db.Pool.Query(ctx, searchQuery, args...)
	if err != nil { logger.ErrorContext(ctx, "Database search query failed", "error", err); return echo.NewHTTPError(http.StatusInternalServerError, "Failed to search tickets.") }
	defer rows.Close()

	// --- 4. Scan Results ---
	tickets := make([]models.Ticket, 0)
	for rows.Next() {
		var ticket models.Ticket
		var assignedUser models.User
		var submitterUser models.User
		var assignedUserID, assignedUserName, assignedUserEmail, assignedUserRole *string
		var assignedUserCreatedAt, assignedUserUpdatedAt *time.Time
		var submitterUserID, submitterUserName, submitterUserEmail, submitterUserRole *string
		var submitterUserCreatedAt, submitterUserUpdatedAt *time.Time

		scanErr := rows.Scan(
			&ticket.ID, &ticket.TicketNumber, &ticket.SubmitterEmail, &ticket.IssueType, &ticket.Urgency,
			&ticket.Subject, &ticket.Description, &ticket.Status, &ticket.AssignedToUserID,
			&ticket.CreatedAt, &ticket.UpdatedAt, &ticket.ClosedAt, &ticket.ResolutionNotes,
			&assignedUserID, &assignedUserName, &assignedUserEmail, &assignedUserRole,
			&assignedUserCreatedAt, &assignedUserUpdatedAt,
			&submitterUserID, &submitterUserName, &submitterUserEmail, &submitterUserRole,
			&submitterUserCreatedAt, &submitterUserUpdatedAt,
		)
		if scanErr != nil { logger.ErrorContext(ctx, "Failed to scan search result row", "error", scanErr); return echo.NewHTTPError(http.StatusInternalServerError, "Failed to process search results.") }
		if ticket.AssignedToUserID != nil && assignedUserID != nil { assignedUser = models.User{ ID: *assignedUserID, Name: *assignedUserName, Email: *assignedUserEmail, Role: models.UserRole(*assignedUserRole), CreatedAt: *assignedUserCreatedAt, UpdatedAt: *assignedUserUpdatedAt, }; ticket.AssignedToUser = &assignedUser }
		if submitterUserID != nil { submitterUser = models.User{ ID: *submitterUserID, Name: *submitterUserName, Email: *submitterUserEmail, Role: models.UserRole(*submitterUserRole), CreatedAt: *submitterUserCreatedAt, UpdatedAt: *submitterUserUpdatedAt, }; ticket.Submitter = &submitterUser }
		tickets = append(tickets, ticket)
	}
	if err = rows.Err(); err != nil { logger.ErrorContext(ctx, "Error iterating search results", "error", err); return nil }

	// --- 5. Return Response ---
	logger.DebugContext(ctx, "Ticket search completed", "resultCount", len(tickets))
	return c.JSON(http.StatusOK, models.APIResponse{ Success: true, Data: tickets, })
}


// --- Helper Functions (Parsing Query Params) ---

func parseTicketStatus(statusStr string) *models.TicketStatus { /* ... same ... */ s := models.TicketStatus(statusStr); switch s { case models.StatusUnassigned, models.StatusAssigned, models.StatusInProgress, models.StatusClosed: return &s; default: return nil } }
func parseTicketUrgency(urgencyStr string) *models.TicketUrgency { /* ... same ... */ u := models.TicketUrgency(urgencyStr); switch u { case models.UrgencyLow, models.UrgencyMedium, models.UrgencyHigh, models.UrgencyCritical: return &u; default: return nil } }
func parseAssigneeFilter(assigneeStr, currentUserID string) *string { /* ... same ... */ if assigneeStr == "me" { if currentUserID != "" { return &currentUserID } else { return nil } }; if assigneeStr == "unassigned" || assigneeStr != "" { return &assigneeStr }; return nil }
func parseTags(tagsStr string) []string { /* ... same ... */ if tagsStr == "" { return nil }; tags := strings.Split(tagsStr, ","); cleanedTags := make([]string, 0, len(tags)); for _, t := range tags { trimmed := strings.TrimSpace(t); if trimmed != "" { cleanedTags = append(cleanedTags, trimmed) } }; if len(cleanedTags) == 0 { return nil }; return cleanedTags }
func parseInt(valueStr string, defaultValue int) int { /* ... same ... */ if valueStr == "" { return defaultValue }; var value int; _, err := fmt.Sscan(valueStr, &value); if err != nil || value <= 0 { return defaultValue }; return value }
func parseStringPtr(value string) *string { /* ... same ... */ if value == "" { return nil }; return &value }

// parseDate parses a YYYY-MM-DD string into a *time.Time pointer. Returns nil on error.
func parseDate(dateStr string) *time.Time {
	if dateStr == "" {
		return nil
	}
	// Use a specific layout matching the expected input format
	layout := "2006-01-02"
	t, err := time.Parse(layout, dateStr)
	if err != nil {
		slog.Warn("Failed to parse date query parameter", "input", dateStr, "error", err)
		return nil
	}
	return &t
}

// parseSortOrder validates the sort order, defaulting to the provided default.
func parseSortOrder(orderStr, defaultOrder string) string {
	order := strings.ToLower(orderStr)
	if order == "asc" || order == "desc" {
		return order
	}
	return defaultOrder // Return default if invalid or empty
}

// parseSortBy validates the sort field against allowed fields, defaulting if invalid.
func parseSortBy(fieldStr, defaultField string, allowedFields []string) string {
	field := strings.ToLower(fieldStr)
	for _, allowed := range allowedFields {
		if field == allowed {
			// Map frontend query param (e.g., "createdAt") to backend DB column if needed
			// For now, assume they match or use a simple mapping
			switch field {
			case "createdat": return "created_at" // Example mapping
			case "updatedat": return "updated_at" // Example mapping
			default: return field // Assume direct match otherwise
			}
		}
	}
	// Map default field if necessary
	switch defaultField {
	case "createdAt": return "created_at"
	case "updatedAt": return "updated_at"
	default: return defaultField
	}
}

// --- Helper Function (getTicketAttachments) ---
// (Function body remains the same)
func (h *Handler) getTicketAttachments(ctx context.Context, ticketID string) ([]models.Attachment, error) {
	logger := slog.With("helper", "getTicketAttachments", "ticketUUID", ticketID)
	query := ` SELECT id, ticket_id, filename, storage_path, mime_type, size, uploaded_at FROM attachments WHERE ticket_id = $1 ORDER BY uploaded_at ASC `
	rows, err := h.db.Pool.Query(ctx, query, ticketID)
	if err != nil { logger.ErrorContext(ctx, "Failed to query ticket attachments", "error", err); return nil, fmt.Errorf("database error fetching attachments: %w", err) }
	defer rows.Close()
	attachments := make([]models.Attachment, 0)
	for rows.Next() {
		var attachment models.Attachment
		if err := rows.Scan( &attachment.ID, &attachment.TicketID, &attachment.Filename, &attachment.StoragePath, &attachment.MimeType, &attachment.Size, &attachment.UploadedAt, ); err != nil { logger.ErrorContext(ctx, "Failed to scan attachment row", "error", err); return nil, fmt.Errorf("database error scanning attachment: %w", err) }
		attachments = append(attachments, attachment)
	}
	if err = rows.Err(); err != nil { logger.ErrorContext(ctx, "Error iterating attachment rows", "error", err); return nil, fmt.Errorf("database error processing attachments: %w", err) }
	logger.DebugContext(ctx, "Fetched attachments successfully", "count", len(attachments))
	return attachments, nil
}

// --- Helper Function (getTicketTags) ---
// (Function body remains the same)
func (h *Handler) getTicketTags(ctx context.Context, ticketID string) ([]models.Tag, error) {
	logger := slog.With("helper", "getTicketTags", "ticketUUID", ticketID)
	query := ` SELECT tg.id, tg.name, tg.created_at FROM tags tg JOIN ticket_tags tt ON tg.id = tt.tag_id WHERE tt.ticket_id = $1 ORDER BY tg.name ASC `
	rows, err := h.db.Pool.Query(ctx, query, ticketID)
	if err != nil { logger.ErrorContext(ctx, "Failed to query ticket tags", "error", err); return nil, fmt.Errorf("database error fetching tags: %w", err) }
	defer rows.Close()
	tags := make([]models.Tag, 0)
	for rows.Next() {
		var tag models.Tag
		if err := rows.Scan(&tag.ID, &tag.Name, &tag.CreatedAt); err != nil { logger.ErrorContext(ctx, "Failed to scan tag row", "error", err); return nil, fmt.Errorf("database error scanning tag: %w", err) }
		tags = append(tags, tag)
	}
	if err = rows.Err(); err != nil { logger.ErrorContext(ctx, "Error iterating tag rows", "error", err); return nil, fmt.Errorf("database error processing tags: %w", err) }
	logger.DebugContext(ctx, "Fetched tags successfully", "count", len(tags))
	return tags, nil
}

// --- Helper Function (getTicketUpdates) ---
// (Function body remains the same)
func (h *Handler) getTicketUpdates( ctx context.Context, ticketID string, requestingUserID string, requestingUserRole models.UserRole, ticketAssignedToUserID *string,) ([]models.TicketUpdate, error) {
	logger := slog.With("helper", "getTicketUpdates", "ticketUUID", ticketID)
	query := ` SELECT tu.id, tu.ticket_id, tu.user_id, tu.comment, tu.is_internal_note, tu.created_at, u.id as author_id, u.name as author_name, u.email as author_email, u.role as author_role, u.created_at as author_created_at, u.updated_at as author_updated_at FROM ticket_updates tu LEFT JOIN users u ON tu.user_id = u.id WHERE tu.ticket_id = $1 ORDER BY tu.created_at ASC `
	rows, err := h.db.Pool.Query(ctx, query, ticketID)
	if err != nil { logger.ErrorContext(ctx, "Failed to query ticket updates", "error", err); return nil, fmt.Errorf("database error fetching updates: %w", err) }
	defer rows.Close()
	updates := make([]models.TicketUpdate, 0)
	isAssignee := ticketAssignedToUserID != nil && *ticketAssignedToUserID == requestingUserID
	for rows.Next() {
		var update models.TicketUpdate
		var author models.User
		var authorID, authorName, authorEmail, authorRole *string
		var authorCreatedAt, authorUpdatedAt *time.Time
		if err := rows.Scan( &update.ID, &update.TicketID, &update.UserID, &update.Comment, &update.IsInternalNote, &update.CreatedAt, &authorID, &authorName, &authorEmail, &authorRole, &authorCreatedAt, &authorUpdatedAt, ); err != nil { logger.ErrorContext(ctx, "Failed to scan ticket update row", "error", err); return nil, fmt.Errorf("database error scanning update: %w", err) }
		if update.UserID != nil && authorID != nil { author = models.User{ ID: *authorID, Name: *authorName, Email: *authorEmail, Role: models.UserRole(*authorRole), CreatedAt: *authorCreatedAt, UpdatedAt: *authorUpdatedAt, }; update.User = &author
		} else if update.UserID == nil { update.User = &models.User{Name: "System"}
		} else { update.User = &models.User{ID: *update.UserID, Name: "Unknown User"}; logger.WarnContext(ctx, "Author details not found for update", "authorUserID", *update.UserID) }
		if !update.IsInternalNote || requestingUserRole == models.RoleAdmin || isAssignee { updates = append(updates, update) }
	}
	if err = rows.Err(); err != nil { logger.ErrorContext(ctx, "Error iterating update rows", "error", err); return nil, fmt.Errorf("database error processing updates: %w", err) }
	logger.DebugContext(ctx, "Fetched updates successfully", "count", len(updates))
	return updates, nil
}

