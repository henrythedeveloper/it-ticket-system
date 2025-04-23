// backend/internal/api/handlers/ticket/query.go
// ==========================================================================
// Handler functions for querying ticket data (listing, searching, counts, details).
// Includes permission checks and data aggregation (e.g., fetching related users, tags).
// ==========================================================================

package ticket

import (
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
//   - page: Page number for pagination (default: 1).
//   - limit: Number of tickets per page (default: 15).
//   - sort_by: Field to sort by (e.g., "created_at", "updated_at").
//   - sort_order: Sort direction ("asc" or "desc").
//   - tags: Comma-separated list of tag names to filter by.
//
// Returns:
//   - JSON response with paginated ticket data or an error response.
func (h *Handler) GetAllTickets(c echo.Context) error {
	ctx := c.Request().Context()
	logger := slog.With("handler", "GetAllTickets")

	// --- 1. Get User Context and Pagination/Filter Params ---
	userRole, err := auth.GetUserRoleFromContext(c)
	if err != nil {
		return err // Error already logged in middleware helper
	}
	userID, err := auth.GetUserIDFromContext(c)
	if err != nil {
		return err
	}

	// Extract filter parameters from query string
	filters := models.TicketFilter{
		Status:       parseTicketStatus(c.QueryParam("status")), // Use helper to parse/validate
		Urgency:      parseTicketUrgency(c.QueryParam("urgency")),
		AssignedTo:   parseAssigneeFilter(c.QueryParam("assigned_to"), userID), // Handle "me", "unassigned"
		EndUserEmail: parseStringPtr(c.QueryParam("end_user_email")),
		Tags:         parseTags(c.QueryParam("tags")),
		Search:       c.QueryParam("search"), // Search handled separately if complex
		Page:         parseInt(c.QueryParam("page"), 1),
		Limit:        parseInt(c.QueryParam("limit"), 15), // Default limit
	}
	// TODO: Add FromDate, ToDate parsing
	// TODO: Add SortBy, SortOrder parsing and validation

	logger.DebugContext(ctx, "Fetching tickets with filters", "filters", filters, "userRole", userRole)

	// --- 2. Build SQL Query ---
	queryBuilder := strings.Builder{}
	queryBuilder.WriteString(`
        SELECT
            t.id, t.ticket_number, t.end_user_email, t.issue_type, t.urgency, t.subject,
            t.body, t.status, t.assigned_to_user_id, t.created_at, t.updated_at,
            t.closed_at, t.resolution_notes,
            -- Assigned user details (nullable)
            a.id as assigned_user_id, a.name as assigned_user_name, a.email as assigned_user_email,
            a.role as assigned_user_role, a.created_at as assigned_user_created_at, a.updated_at as assigned_user_updated_at,
            -- Count total rows for pagination
            COUNT(*) OVER() AS total_count
        FROM tickets t
        LEFT JOIN users a ON t.assigned_to_user_id = a.id
    `)
	args := []interface{}{}
	paramCount := 0

	// --- Apply WHERE clauses based on filters ---
	whereClauses := []string{"1=1"} // Start with a dummy clause

	if filters.Status != nil {
		paramCount++
		whereClauses = append(whereClauses, fmt.Sprintf("t.status = $%d", paramCount))
		args = append(args, *filters.Status)
	}
	if filters.Urgency != nil {
		paramCount++
		whereClauses = append(whereClauses, fmt.Sprintf("t.urgency = $%d", paramCount))
		args = append(args, *filters.Urgency)
	}
	if filters.AssignedTo != nil {
		if *filters.AssignedTo == "unassigned" {
			whereClauses = append(whereClauses, "t.assigned_to_user_id IS NULL")
		} else { // Assumes "me" was converted to actual userID in parseAssigneeFilter
			paramCount++
			whereClauses = append(whereClauses, fmt.Sprintf("t.assigned_to_user_id = $%d", paramCount))
			args = append(args, *filters.AssignedTo)
		}
	}
	if filters.EndUserEmail != nil {
		paramCount++
		whereClauses = append(whereClauses, fmt.Sprintf("t.end_user_email ILIKE $%d", paramCount))
		args = append(args, "%"+*filters.EndUserEmail+"%")
	}

	// --- RBAC Filter ---
	// Staff users can only see tickets assigned to them or unassigned tickets
	if userRole != models.RoleAdmin {
		paramCount++
		// Staff can see tickets assigned to them OR unassigned tickets
		whereClauses = append(whereClauses, fmt.Sprintf("(t.assigned_to_user_id = $%d OR t.assigned_to_user_id IS NULL)", paramCount))
		args = append(args, userID)
	}

	// --- Tag Filtering (using JOIN) ---
	if len(filters.Tags) > 0 {
		queryBuilder.WriteString(` JOIN ticket_tags tt ON t.id = tt.ticket_id JOIN tags tg ON tt.tag_id = tg.id `)
		paramCount++
		// Filter by tags using tag names (adjust if filtering by tag IDs)
		whereClauses = append(whereClauses, fmt.Sprintf("tg.name = ANY($%d)", paramCount))
		args = append(args, filters.Tags) // Pass the slice of tag names
	}

	// --- Search Filtering (Simple ILIKE across multiple fields) ---
	if filters.Search != "" {
		paramCount++
		searchPattern := "%" + filters.Search + "%"
		whereClauses = append(whereClauses, fmt.Sprintf(`
            (t.subject ILIKE $%d OR t.body ILIKE $%d OR t.end_user_email ILIKE $%d OR CAST(t.ticket_number AS TEXT) ILIKE $%d)
        `, paramCount, paramCount, paramCount, paramCount)) // Search subject, body, email, or ticket number
		args = append(args, searchPattern)
	}

	// Append WHERE clauses
	if len(whereClauses) > 1 {
		queryBuilder.WriteString(" WHERE " + strings.Join(whereClauses, " AND "))
	}

	// --- Apply ORDER BY and Pagination ---
	// TODO: Make sorting dynamic based on params
	queryBuilder.WriteString(" ORDER BY t.updated_at DESC")
	paramCount++
	queryBuilder.WriteString(fmt.Sprintf(" LIMIT $%d", paramCount))
	args = append(args, filters.Limit)
	paramCount++
	queryBuilder.WriteString(fmt.Sprintf(" OFFSET $%d", paramCount))
	args = append(args, (filters.Page-1)*filters.Limit)

	// --- 3. Execute Query ---
	finalQuery := queryBuilder.String()
	logger.DebugContext(ctx, "Executing GetAllTickets query", "query", finalQuery, "args", args)

	rows, err := h.db.Pool.Query(ctx, finalQuery, args...)
	if err != nil {
		logger.ErrorContext(ctx, "Database query failed", "error", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to retrieve tickets.")
	}
	defer rows.Close()

	// --- 4. Scan Results ---
	tickets := make([]models.Ticket, 0)
	var totalCount int = 0 // Initialize total count

	for rows.Next() {
		var ticket models.Ticket
		var assignedUser models.User
		// Nullable fields for assigned user
		var assignedUserID, assignedUserName, assignedUserEmail, assignedUserRole *string
		var assignedUserCreatedAt, assignedUserUpdatedAt *time.Time

		// Scan ticket and potentially assigned user details
		scanErr := rows.Scan(
			&ticket.ID, &ticket.TicketNumber, &ticket.EndUserEmail, &ticket.IssueType, &ticket.Urgency,
			&ticket.Subject, &ticket.Body, &ticket.Status, &ticket.AssignedToUserID,
			&ticket.CreatedAt, &ticket.UpdatedAt, &ticket.ClosedAt, &ticket.ResolutionNotes,
			// Assigned user fields (scan into nullable pointers)
			&assignedUserID, &assignedUserName, &assignedUserEmail, &assignedUserRole,
			&assignedUserCreatedAt, &assignedUserUpdatedAt,
			// Total count from COUNT(*) OVER()
			&totalCount,
		)
		if scanErr != nil {
			logger.ErrorContext(ctx, "Failed to scan ticket row", "error", scanErr)
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to process ticket data.")
		}

		// Populate assigned user struct if data exists
		if ticket.AssignedToUserID != nil && assignedUserID != nil {
			assignedUser = models.User{
				ID:        *assignedUserID,
				Name:      *assignedUserName,
				Email:     *assignedUserEmail,
				Role:      models.UserRole(*assignedUserRole), // Assuming role is stored as string
				CreatedAt: *assignedUserCreatedAt,
				UpdatedAt: *assignedUserUpdatedAt,
			}
			ticket.AssignedToUser = &assignedUser
		}

		tickets = append(tickets, ticket)
	}

	if err = rows.Err(); err != nil {
		logger.ErrorContext(ctx, "Error iterating ticket rows", "error", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to process ticket results.")
	}

	// --- 5. Return Paginated Response ---
	totalPages := 0
	if totalCount > 0 {
		totalPages = (totalCount + filters.Limit - 1) / filters.Limit // Calculate total pages
	}

	return c.JSON(http.StatusOK, models.PaginatedResponse{
		Success:    true,
		Message:    "Tickets retrieved successfully.",
		Data:       tickets,
		Total:      totalCount,
		Page:       filters.Page,
		Limit:      filters.Limit,
		TotalPages: totalPages,
		HasMore:    filters.Page < totalPages,
	})
}

// GetTicketByID retrieves details for a single ticket, including related data.
// Performs RBAC checks.
//
// Path Parameters:
//   - id: The UUID of the ticket to retrieve.
//
// Returns:
//   - JSON response with the full ticket details or an error response.
func (h *Handler) GetTicketByID(c echo.Context) error {
	ctx := c.Request().Context()
	ticketID := c.Param("id")
	logger := slog.With("handler", "GetTicketByID", "ticketUUID", ticketID)

	if ticketID == "" {
		logger.WarnContext(ctx, "Missing ticket ID in request")
		return echo.NewHTTPError(http.StatusBadRequest, "Missing ticket ID.")
	}

	// --- 1. Get User Context ---
	userRole, err := auth.GetUserRoleFromContext(c)
	if err != nil {
		return err
	}
	userID, err := auth.GetUserIDFromContext(c)
	if err != nil {
		return err
	}

	// --- 2. Fetch Core Ticket Data ---
	var ticket models.Ticket
	var assignedUser models.User
	var assignedUserID, assignedUserName, assignedUserEmail, assignedUserRole *string
	var assignedUserCreatedAt, assignedUserUpdatedAt *time.Time

	err = h.db.Pool.QueryRow(ctx, `
        SELECT
            t.id, t.ticket_number, t.end_user_email, t.issue_type, t.urgency, t.subject,
            t.body, t.status, t.assigned_to_user_id, t.created_at, t.updated_at,
            t.closed_at, t.resolution_notes,
            -- Assigned user details
            a.id, a.name, a.email, a.role, a.created_at, a.updated_at
        FROM tickets t
        LEFT JOIN users a ON t.assigned_to_user_id = a.id
        WHERE t.id = $1
    `, ticketID).Scan(
		&ticket.ID, &ticket.TicketNumber, &ticket.EndUserEmail, &ticket.IssueType, &ticket.Urgency,
		&ticket.Subject, &ticket.Body, &ticket.Status, &ticket.AssignedToUserID,
		&ticket.CreatedAt, &ticket.UpdatedAt, &ticket.ClosedAt, &ticket.ResolutionNotes,
		// Assigned user fields
		&assignedUserID, &assignedUserName, &assignedUserEmail, &assignedUserRole,
		&assignedUserCreatedAt, &assignedUserUpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			logger.WarnContext(ctx, "Ticket not found")
			return echo.NewHTTPError(http.StatusNotFound, "Ticket not found.")
		}
		logger.ErrorContext(ctx, "Failed to query ticket by ID", "error", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to retrieve ticket details.")
	}

	// --- 3. RBAC Check ---
	// Staff can only view tickets assigned to them or unassigned ones (unless admin)
	if userRole != models.RoleAdmin && ticket.AssignedToUserID != nil && *ticket.AssignedToUserID != userID {
		logger.WarnContext(ctx, "Unauthorized attempt to view ticket", "requestingUserID", userID, "assignedUserID", *ticket.AssignedToUserID)
		return echo.NewHTTPError(http.StatusForbidden, "Not authorized to view this ticket.")
	}

	// Populate assigned user struct
	if ticket.AssignedToUserID != nil && assignedUserID != nil {
		assignedUser = models.User{
			ID: *assignedUserID, Name: *assignedUserName, Email: *assignedUserEmail,
			Role: models.UserRole(*assignedUserRole), CreatedAt: *assignedUserCreatedAt, UpdatedAt: *assignedUserUpdatedAt,
		}
		ticket.AssignedToUser = &assignedUser
	}

	// --- 4. Fetch Related Data (Tags, Updates, Attachments) Concurrently ---
	// Use context for cancellation propagation
	errChan := make(chan error, 3) // Channel to collect errors from goroutines
	tagsChan := make(chan []models.Tag, 1)
	updatesChan := make(chan []models.TicketUpdate, 1)
	attachmentsChan := make(chan []models.Attachment, 1)

	go func() {
		tags, err := h.getTicketTags(ctx, ticketID)
		if err != nil {
			errChan <- fmt.Errorf("failed to get ticket tags: %w", err)
			return
		}
		tagsChan <- tags
	}()

	go func() {
		// Pass necessary user info for filtering internal notes
		updates, err := h.getTicketUpdates(ctx, ticketID, userID, userRole, ticket.AssignedToUserID)
		if err != nil {
			errChan <- fmt.Errorf("failed to get ticket updates: %w", err)
			return
		}
		updatesChan <- updates
	}()

	go func() {
		attachments, err := h.getTicketAttachments(ctx, ticketID)
		if err != nil {
			errChan <- fmt.Errorf("failed to get ticket attachments: %w", err)
			return
		}
		attachmentsChan <- attachments
	}()

	// Wait for all goroutines to finish and collect results/errors
	var fetchError error
	for i := 0; i < 3; i++ {
		select {
		case tags := <-tagsChan:
			ticket.Tags = tags
		case updates := <-updatesChan:
			ticket.Updates = updates
		case attachments := <-attachmentsChan:
			// Add download URL to attachments (assuming fileService provides it or can construct it)
			for j := range attachments {
				// Example: Construct URL if not directly stored
				// attachments[j].URL = h.fileService.GetObjectURL(ctx, attachments[j].StoragePath)
				// Or if download is via a dedicated endpoint:
				attachments[j].URL = fmt.Sprintf("/api/attachments/download/%s", attachments[j].ID) // Adjust path as needed
			}
			ticket.Attachments = attachments
		case err := <-errChan:
			if fetchError == nil { // Store the first error encountered
				fetchError = err
			} else {
				logger.ErrorContext(ctx, "Multiple errors fetching related ticket data", "additionalError", err)
			}
		case <-ctx.Done(): // Handle context cancellation (e.g., request timeout)
			logger.WarnContext(ctx, "Context cancelled while fetching related ticket data", "error", ctx.Err())
			return echo.NewHTTPError(http.StatusInternalServerError, "Request timed out while fetching ticket details.")
		}
	}

	if fetchError != nil {
		logger.ErrorContext(ctx, "Error fetching related ticket data", "error", fetchError)
		// Decide whether to return partial data or a full error
		// Returning error for simplicity here
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to retrieve all ticket details.")
	}

	// --- 5. Return Success Response ---
	logger.DebugContext(ctx, "Successfully retrieved ticket details")
	return c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    ticket,
	})
}

// GetTicketCounts retrieves counts of tickets grouped by status.
// Applies RBAC to filter counts for non-admin users.
//
// Returns:
//   - JSON response with ticket counts or an error response.
func (h *Handler) GetTicketCounts(c echo.Context) error {
	ctx := c.Request().Context()
	logger := slog.With("handler", "GetTicketCounts")

	// --- 1. Get User Context ---
	userRole, err := auth.GetUserRoleFromContext(c)
	if err != nil {
		return err
	}
	userID, err := auth.GetUserIDFromContext(c)
	if err != nil {
		return err
	}

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

	// Apply RBAC filter for non-admins
	if userRole != models.RoleAdmin {
		query += ` WHERE assigned_to_user_id = $1 OR assigned_to_user_id IS NULL`
		args = append(args, userID)
	}

	// --- 3. Execute Query ---
	logger.DebugContext(ctx, "Executing GetTicketCounts query", "query", query, "args", args)
	var counts struct {
		Unassigned int `json:"unassigned"`
		Assigned   int `json:"assigned"`
		InProgress int `json:"in_progress"`
		Closed     int `json:"closed"`
		Total      int `json:"total"`
	}

	err = h.db.Pool.QueryRow(ctx, query, args...).Scan(
		&counts.Unassigned, &counts.Assigned, &counts.InProgress, &counts.Closed, &counts.Total,
	)
	if err != nil {
		logger.ErrorContext(ctx, "Failed to execute GetTicketCounts query", "error", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to retrieve ticket counts.")
	}

	// --- 4. Return Response ---
	logger.DebugContext(ctx, "Ticket counts retrieved successfully", "counts", counts)
	return c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    counts,
	})
}

// SearchTickets performs a basic search across multiple ticket fields.
// Applies RBAC checks.
//
// Query Parameters:
//   - q: The search query string.
//   - limit: Maximum number of results (default: 50).
//
// Returns:
//   - JSON response with matching tickets or an error response.
func (h *Handler) SearchTickets(c echo.Context) error {
	ctx := c.Request().Context()
	query := c.QueryParam("q")
	limit := parseInt(c.QueryParam("limit"), 50) // Default limit 50
	logger := slog.With("handler", "SearchTickets", "query", query)

	if query == "" {
		logger.WarnContext(ctx, "Missing search query parameter 'q'")
		return echo.NewHTTPError(http.StatusBadRequest, "Search query 'q' is required.")
	}

	// --- 1. Get User Context ---
	userRole, err := auth.GetUserRoleFromContext(c)
	if err != nil {
		return err
	}
	userID, err := auth.GetUserIDFromContext(c)
	if err != nil {
		return err
	}

	// --- 2. Build Search Query ---
	searchQuery := `
        SELECT
            t.id, t.ticket_number, t.end_user_email, t.issue_type, t.urgency, t.subject,
            t.body, t.status, t.assigned_to_user_id, t.created_at, t.updated_at,
            t.closed_at, t.resolution_notes,
            -- Assigned user details (nullable)
            a.id as assigned_user_id, a.name as assigned_user_name, a.email as assigned_user_email,
            a.role as assigned_user_role, a.created_at as assigned_user_created_at, a.updated_at as assigned_user_updated_at
        FROM tickets t
        LEFT JOIN users a ON t.assigned_to_user_id = a.id
        WHERE (
            t.subject ILIKE $1 OR
            t.body ILIKE $1 OR
            t.end_user_email ILIKE $1 OR
            CAST(t.ticket_number AS TEXT) ILIKE $1
            -- Add other searchable fields if needed (e.g., issue_type)
            -- OR t.issue_type ILIKE $1
        )
    `
	searchPattern := "%" + query + "%"
	args := []interface{}{searchPattern}
	paramCount := 1

	// Apply RBAC filter for non-admins
	if userRole != models.RoleAdmin {
		paramCount++
		searchQuery += fmt.Sprintf(" AND (t.assigned_to_user_id = $%d OR t.assigned_to_user_id IS NULL)", paramCount)
		args = append(args, userID)
	}

	// Add ordering and limit
	searchQuery += " ORDER BY t.updated_at DESC" // Or relevance score if using full-text search
	paramCount++
	searchQuery += fmt.Sprintf(" LIMIT $%d", paramCount)
	args = append(args, limit)

	// --- 3. Execute Query ---
	logger.DebugContext(ctx, "Executing SearchTickets query", "query", searchQuery, "args", args)
	rows, err := h.db.Pool.Query(ctx, searchQuery, args...)
	if err != nil {
		logger.ErrorContext(ctx, "Database search query failed", "error", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to search tickets.")
	}
	defer rows.Close()

	// --- 4. Scan Results ---
	tickets := make([]models.Ticket, 0)
	for rows.Next() {
		var ticket models.Ticket
		var assignedUser models.User
		var assignedUserID, assignedUserName, assignedUserEmail, assignedUserRole *string
		var assignedUserCreatedAt, assignedUserUpdatedAt *time.Time

		scanErr := rows.Scan(
			&ticket.ID, &ticket.TicketNumber, &ticket.EndUserEmail, &ticket.IssueType, &ticket.Urgency,
			&ticket.Subject, &ticket.Body, &ticket.Status, &ticket.AssignedToUserID,
			&ticket.CreatedAt, &ticket.UpdatedAt, &ticket.ClosedAt, &ticket.ResolutionNotes,
			&assignedUserID, &assignedUserName, &assignedUserEmail, &assignedUserRole,
			&assignedUserCreatedAt, &assignedUserUpdatedAt,
		)
		if scanErr != nil {
			logger.ErrorContext(ctx, "Failed to scan search result row", "error", scanErr)
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to process search results.")
		}

		// Populate assigned user struct if data exists
		if ticket.AssignedToUserID != nil && assignedUserID != nil {
			assignedUser = models.User{
				ID: *assignedUserID, Name: *assignedUserName, Email: *assignedUserEmail,
				Role: models.UserRole(*assignedUserRole), CreatedAt: *assignedUserCreatedAt, UpdatedAt: *assignedUserUpdatedAt,
			}
			ticket.AssignedToUser = &assignedUser
		}
		tickets = append(tickets, ticket)
	}

	if err = rows.Err(); err != nil {
		logger.ErrorContext(ctx, "Error iterating search results", "error", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to process search results.")
	}

	// --- 5. Return Response ---
	logger.DebugContext(ctx, "Ticket search completed", "resultCount", len(tickets))
	return c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    tickets,
	})
}

// --- Helper Functions (Parsing Query Params) ---
// These helpers centralize the parsing and validation logic for query parameters.

func parseTicketStatus(statusStr string) *models.TicketStatus {
	s := models.TicketStatus(statusStr)
	switch s {
	case models.StatusUnassigned, models.StatusAssigned, models.StatusInProgress, models.StatusClosed:
		return &s
	default:
		return nil // Invalid or empty status
	}
}

func parseTicketUrgency(urgencyStr string) *models.TicketUrgency {
	u := models.TicketUrgency(urgencyStr)
	switch u {
	case models.UrgencyLow, models.UrgencyMedium, models.UrgencyHigh, models.UrgencyCritical:
		return &u
	default:
		return nil // Invalid or empty urgency
	}
}

func parseAssigneeFilter(assigneeStr, currentUserID string) *string {
	if assigneeStr == "me" {
		if currentUserID != "" {
			return &currentUserID // Replace "me" with actual user ID
		}
		return nil // Cannot filter by "me" if user ID is unknown
	}
	if assigneeStr == "unassigned" || assigneeStr != "" {
		// Return "unassigned" or the actual UUID string
		return &assigneeStr
	}
	return nil // Empty or invalid assignee filter
}

func parseTags(tagsStr string) []string {
	if tagsStr == "" {
		return nil
	}
	// Split by comma and trim whitespace
	tags := strings.Split(tagsStr, ",")
	cleanedTags := make([]string, 0, len(tags))
	for _, t := range tags {
		trimmed := strings.TrimSpace(t)
		if trimmed != "" {
			cleanedTags = append(cleanedTags, trimmed)
		}
	}
	if len(cleanedTags) == 0 {
		return nil
	}
	return cleanedTags
}

// parseInt parses an integer from a string, returning a default value on error or empty string.
func parseInt(valueStr string, defaultValue int) int {
	if valueStr == "" {
		return defaultValue
	}
	var value int
	_, err := fmt.Sscan(valueStr, &value) // Simple parsing, consider strconv for more control
	if err != nil || value <= 0 {         // Basic validation (e.g., page/limit > 0)
		return defaultValue
	}
	return value
}

// parseStringPtr returns a pointer to the string if it's not empty, otherwise nil.
func parseStringPtr(value string) *string {
	if value == "" {
		return nil
	}
	return &value
}
