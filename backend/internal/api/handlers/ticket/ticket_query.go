// backend/internal/api/handlers/ticket/ticket_query.go
// ==========================================================================
// Contains all ticket query operations: listing, searching, counts, details.
// Extracted from ticket_operations.go for better maintainability.
// REVISED: GetTicketByIDOptimized refactored to use separate queries.
// ==========================================================================

package ticket

import (
	"context"
	"errors"
	"fmt"
	"log/slog" // Use slog
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/henrythedeveloper/it-ticket-system/internal/models" // Correct models import
	"github.com/jackc/pgx/v5"                                       // Correct pgx import
	"github.com/labstack/echo/v4"                                   // Correct echo import
    // Helper function import assumed from utils.go in the same package
)

// --- QUERY OPERATIONS ---

// GetAllTickets retrieves a list of tickets based on query parameters for filtering and pagination.
// *** SIMPLIFIED QUERY: Fetches only core ticket data for list view. ***
func (h *Handler) GetAllTickets(c echo.Context) error {
    ctx := context.Background()
    logger := slog.With("handler", "GetAllTickets")

    // --- Parameter Parsing (remains the same) ---
    status := c.QueryParam("status")
    assignedTo := c.QueryParam("assigned_to")
    submitterID := c.QueryParam("submitter_id")
    limitStr := c.QueryParam("limit")
    pageStr := c.QueryParam("page")
    tagParam := c.QueryParam("tags") // Keep tag filtering param
    sortBy := c.QueryParam("sortBy")
    sortOrder := c.QueryParam("sortOrder")

    limit := 15; if limitStr != "" { parsedLimit, err := strconv.Atoi(limitStr); if err == nil && parsedLimit > 0 && parsedLimit <= 100 { limit = parsedLimit } }
    page := 1; if pageStr != "" { parsedPage, err := strconv.Atoi(pageStr); if err == nil && parsedPage > 0 { page = parsedPage } }
    offset := (page - 1) * limit

    logger.DebugContext(ctx, "Pagination params", "limit", limit, "page", page, "offset", offset)

    // --- Build Query ---
    // Select ONLY core ticket fields needed for the list view
    selectClause := `
        SELECT
            t.id, t.ticket_number, t.subject, t.description, t.status, t.urgency, t.created_at, t.updated_at,
            t.submitter_name, t.end_user_email, t.assigned_to_user_id
    `
    fromClause := ` FROM tickets t `
    countFromClause := ` FROM tickets t `

    // --- Filtering Logic ---
    args := []interface{}{}
    whereClauses := []string{}
    joinClausesForFilter := "" // To add joins needed ONLY for filtering
    argIdx := 1

    // Status Filter
    if status != "" { if strings.ToLower(status) == "unassigned" { whereClauses = append(whereClauses, "t.assigned_to_user_id IS NULL") } else { statuses := strings.Split(status, ","); statusPlaceholders := []string{}; for _, s := range statuses { trimmedStatus := strings.TrimSpace(s); if trimmedStatus != "" { statusPlaceholders = append(statusPlaceholders, fmt.Sprintf("$%d", argIdx)); args = append(args, trimmedStatus); argIdx++ } }; if len(statusPlaceholders) > 0 { whereClauses = append(whereClauses, fmt.Sprintf("t.status IN (%s)", strings.Join(statusPlaceholders, ", "))) } } }
    // AssignedTo Filter
    if assignedTo != "" { if strings.ToLower(assignedTo) == "unassigned" { whereClauses = append(whereClauses, "t.assigned_to_user_id IS NULL") } else { whereClauses = append(whereClauses, fmt.Sprintf("t.assigned_to_user_id = $%d", argIdx)); args = append(args, assignedTo); argIdx++ } }
    // SubmitterID Filter
    if submitterID != "" { whereClauses = append(whereClauses, fmt.Sprintf("t.submitter_id = $%d", argIdx)); args = append(args, submitterID); argIdx++ }
    // Tag Filter (Add JOIN only if filtering by tags)
    if tagParam != "" { tags := strings.Split(tagParam, ","); tagPlaceholders := []string{}; validTags := []string{}; for _, tag := range tags { trimmedTag := strings.TrimSpace(tag); if trimmedTag != "" { tagPlaceholders = append(tagPlaceholders, fmt.Sprintf("$%d", argIdx)); args = append(args, trimmedTag); argIdx++; validTags = append(validTags, trimmedTag) } }; if len(tagPlaceholders) > 0 { joinClausesForFilter = ` JOIN ticket_tags tt_filter ON t.id = tt_filter.ticket_id JOIN tags tg_filter ON tt_filter.tag_id = tg_filter.id `; whereClauses = append(whereClauses, fmt.Sprintf("tg_filter.name IN (%s)", strings.Join(tagPlaceholders, ", "))); countFromClause += joinClausesForFilter } }

    // --- Construct Final Queries ---
    whereClause := ""; if len(whereClauses) > 0 { whereClause = " WHERE " + strings.Join(whereClauses, " AND ") }
    totalQuery := `SELECT COUNT(DISTINCT t.id)` + countFromClause + whereClause
    logger.DebugContext(ctx, "Executing count query", "query", totalQuery, "args", args)
    var totalCount int
    err := h.db.Pool.QueryRow(ctx, totalQuery, args...).Scan(&totalCount)
    if err != nil { /* handle count error */
         logger.ErrorContext(ctx, "Failed to fetch ticket count", "error", err)
         return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to fetch ticket count"})
    }
    logger.DebugContext(ctx, "Total tickets count", "count", totalCount)

    // Sorting Logic
    orderByClause := " ORDER BY t.updated_at DESC" // Default sort
    validSortColumns := map[string]string{"createdAt": "t.created_at", "updatedAt": "t.updated_at", "ticketNumber": "t.ticket_number", "status": "t.status", "urgency": "t.urgency"} // Map frontend name to DB column
    if col, ok := validSortColumns[sortBy]; ok {
        order := "DESC"; if strings.ToLower(sortOrder) == "asc" { order = "ASC" }
        orderByClause = fmt.Sprintf(" ORDER BY %s %s, t.id %s", col, order, order) // Add t.id for stable sort
    }

    // Data Query (No GROUP BY needed now)
    dataQuery := selectClause + fromClause + joinClausesForFilter + whereClause +
        orderByClause +
        fmt.Sprintf(" LIMIT $%d OFFSET $%d", argIdx, argIdx+1)
    dataArgs := append(args, limit, offset)

    logger.DebugContext(ctx, "Executing data query", "query", dataQuery, "args", dataArgs)
    rows, err := h.db.Pool.Query(ctx, dataQuery, dataArgs...)
    if err != nil { /* handle query error */
         logger.ErrorContext(ctx, "Failed to fetch tickets", "error", err)
         return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to fetch tickets"})
    }
    defer rows.Close()

    // --- Scan Results (Simpler Scan) ---
    tickets := make([]models.Ticket, 0, limit)
    for rows.Next() {
        var ticket models.Ticket
        var submitterNameStr string // Temporary variable for scanning nullable submitter name

        err := rows.Scan(
            &ticket.ID, &ticket.TicketNumber, &ticket.Subject, &ticket.Description, &ticket.Status,
            &ticket.Urgency, &ticket.CreatedAt, &ticket.UpdatedAt,
            &submitterNameStr, // Scan into string
            &ticket.EndUserEmail,
            &ticket.AssignedToUserID, // Scan only the ID
        )
        if err != nil { /* handle scan error */
             logger.ErrorContext(ctx, "Failed to scan ticket row", "error", err)
             return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to parse ticket data"})
        }

        // Populate submitter name pointer if it exists
        if submitterNameStr != "" { ticket.SubmitterName = &submitterNameStr }

        // NOTE: ticket.AssignedToUser and ticket.Tags will be nil/empty here,
        // as they are no longer fetched in this simplified query.
        // The frontend will need to handle this (it likely already does).

        tickets = append(tickets, ticket)
    }
    if err := rows.Err(); err != nil { /* handle rows error */
        logger.ErrorContext(ctx, "Error iterating ticket rows", "error", err)
        return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Error processing ticket results"})
    }

    // --- Return Response ---
    totalPages := 0; if limit > 0 { totalPages = (totalCount + limit - 1) / limit }; hasMore := page < totalPages
    response := models.PaginatedResponse{ Success: true, Data: tickets, Total: totalCount, Page: page, Limit: limit, TotalPages: totalPages, HasMore: hasMore }
    logger.InfoContext(ctx, "Fetched tickets successfully", "count", len(tickets), "total", totalCount, "page", page)
    return c.JSON(http.StatusOK, response)
}

// GetTicketByID retrieves details for a single ticket, including related data like updates.
// This is the *original* simpler version, kept for reference or specific use cases.
func (h *Handler) GetTicketByID(c echo.Context) error {
	ctx := context.Background()
	ticketID := c.Param("id")
    logger := slog.With("handler", "GetTicketByID", "ticketID", ticketID)


	// Use the helper to fetch core ticket + user data
	row := h.db.Pool.QueryRow(ctx, `
        SELECT
            t.id, t.ticket_number, t.submitter_name, t.end_user_email, t.issue_type, t.urgency, t.subject,
            t.description, t.status, t.assigned_to_user_id, t.created_at, t.updated_at,
            t.closed_at, t.resolution_notes,
            a.id, a.name, a.email, a.role, a.created_at, a.updated_at,
            s.id, s.name, s.email, s.role, s.created_at, s.updated_at
        FROM tickets t
        LEFT JOIN users a ON t.assigned_to_user_id = a.id
        LEFT JOIN users s ON t.end_user_email = s.email
        WHERE t.id = $1
    `, ticketID)

	ticket, err := scanTicketWithUsersAndSubmitter(row)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			logger.WarnContext(ctx, "Ticket not found")
			return c.JSON(http.StatusNotFound, map[string]string{"error": "Ticket not found"})
		}
		logger.ErrorContext(ctx, "Failed to fetch ticket details", "error", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to fetch ticket details"})
	}


	// --- Fetch Tags Separately ---
	tagsQuery := `SELECT tg.id, tg.name, tg.created_at FROM tags tg JOIN ticket_tags tt ON tg.id = tt.tag_id WHERE tt.ticket_id = $1 ORDER BY tg.name ASC`
	tagsRows, tagsErr := h.db.Pool.Query(ctx, tagsQuery, ticketID)
	// Handle tags error similarly to GetTicketByIDOptimized (log but continue)
    if tagsErr != nil {
        logger.ErrorContext(ctx, "Failed to query tags for ticket", "error", tagsErr)
        ticket.Tags = []models.Tag{}
    } else {
        defer tagsRows.Close()
        tags := make([]models.Tag, 0)
        for tagsRows.Next() { /* ... scan tags ... */
            var tag models.Tag
			if scanErr := tagsRows.Scan(&tag.ID, &tag.Name, &tag.CreatedAt); scanErr != nil {
				logger.ErrorContext(ctx, "Failed to scan tag row", "error", scanErr)
				continue
			}
			tags = append(tags, tag)
        }
        if rowsErr := tagsRows.Err(); rowsErr != nil {
            logger.ErrorContext(ctx, "Error iterating tag rows", "error", rowsErr)
        }
        ticket.Tags = tags
    }


	// --- Fetch Attachments Separately ---
	attachmentsQuery := `SELECT id, filename, storage_path, mime_type, size, uploaded_at, uploaded_by_user_id, uploaded_by_role, url FROM attachments WHERE ticket_id = $1 ORDER BY uploaded_at ASC`
	attachRows, attachErr := h.db.Pool.Query(ctx, attachmentsQuery, ticketID)
	// Handle attachments error similarly (log but continue)
    if attachErr != nil {
        logger.ErrorContext(ctx, "Failed to query attachments for ticket", "error", attachErr)
        ticket.Attachments = []models.Attachment{}
    } else {
        defer attachRows.Close()
        attachments := make([]models.Attachment, 0)
        for attachRows.Next() { /* ... scan attachments ... */
            var att models.Attachment
			if scanErr := attachRows.Scan(&att.ID, &att.Filename, &att.StoragePath, &att.MimeType, &att.Size, &att.UploadedAt, &att.UploadedByUserID, &att.UploadedByRole, &att.URL); scanErr != nil {
				logger.ErrorContext(ctx, "Failed to scan attachment row", "error", scanErr)
				continue
			}
            if att.URL == "" { att.URL = fmt.Sprintf("/api/attachments/download/%s", att.ID) }
			attachments = append(attachments, att)
        }
         if rowsErr := attachRows.Err(); rowsErr != nil {
            logger.ErrorContext(ctx, "Error iterating attachment rows", "error", rowsErr)
        }
        ticket.Attachments = attachments
    }

	// --- Fetch ticket updates/comments and add to ticket ---
	updatesQuery := `
		SELECT
			tu.id, tu.ticket_id, tu.user_id, tu.comment, tu.is_internal_note, tu.created_at, tu.is_system_update,
			u.id, u.name, u.email, u.role, u.created_at, u.updated_at
		FROM ticket_updates tu
		LEFT JOIN users u ON tu.user_id = u.id
		WHERE tu.ticket_id = $1
		ORDER BY tu.created_at DESC
	`
	updatesRows, updatesErr := h.db.Pool.Query(ctx, updatesQuery, ticketID)
	// Handle updates error similarly (log but continue)
    if updatesErr != nil {
        logger.ErrorContext(ctx, "Failed to query updates for ticket", "error", updatesErr)
        ticket.Updates = []models.TicketUpdate{}
    } else {
        defer updatesRows.Close()
        updates := make([]models.TicketUpdate, 0)
        for updatesRows.Next() {
            var update models.TicketUpdate
            var user models.User
            var updateUserID *string // User ID from ticket_updates table might be null
            var userName, userEmail, userRole *string
            var userCreatedAt, userUpdatedAt *time.Time

            err := updatesRows.Scan(
                &update.ID, &update.TicketID, &updateUserID, &update.Comment,
                &update.IsInternalNote, &update.CreatedAt, &update.IsSystemUpdate,
                // User details (scan into nullable pointers)
                &user.ID, // Scan directly into user.ID (string)
                &userName, &userEmail, &userRole,
                &userCreatedAt, &userUpdatedAt,
            )
            if err != nil {
                 logger.ErrorContext(ctx, "Failed to scan ticket update row", "error", err)
                 continue // skip this update if error
            }

            // Populate the nested User struct if the user exists and details were fetched
            if updateUserID != nil { // Check if the user_id from ticket_updates was not NULL
                update.UserID = updateUserID // Assign the user ID to the update struct
                // Check if user details were actually found (LEFT JOIN might return NULLs)
                if userName != nil {
                    user.Name = *userName
                    user.Email = *userEmail
                    user.Role = models.UserRole(*userRole)
                    user.CreatedAt = *userCreatedAt
                    user.UpdatedAt = *userUpdatedAt
                    update.User = &user // Assign the populated user struct
                } else {
                    update.User = &models.User{ID: *updateUserID, Name: "Unknown User"}
                    logger.WarnContext(ctx, "User details not found for update author", "authorUserID", *updateUserID)
                }
            } else {
                // Handle system comment where user_id might be NULL
                update.User = &models.User{Name: "System"}
            }
            updates = append(updates, update)
        }
        if rowsErr := updatesRows.Err(); rowsErr != nil {
            logger.ErrorContext(ctx, "Error iterating update rows", "error", rowsErr)
        }
        ticket.Updates = updates
    }

	logger.DebugContext(ctx, "Fetched ticket details successfully", "ticketID", ticket.ID)
	return c.JSON(http.StatusOK, ticket) // Return the fully populated ticket
}


// --- REFACTORED GetTicketByIDOptimized ---
// Fetches ticket, then related data in separate queries.
func (h *Handler) GetTicketByIDOptimized(c echo.Context) error {
	ctx := context.Background()
	ticketID := c.Param("id")
	logger := slog.With("handler", "GetTicketByIDOptimized", "ticketID", ticketID)

	// --- 1. Fetch Core Ticket Data ---
	ticketQuery := `
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
		LEFT JOIN users s ON t.end_user_email = s.email -- Join submitter based on email
		WHERE t.id = $1`
	row := h.db.Pool.QueryRow(ctx, ticketQuery, ticketID)

	// Use the scanner helper from utils.go
	ticket, err := scanTicketWithUsersAndSubmitter(row) // Ensure scanner in utils.go is correct
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			logger.WarnContext(ctx, "Ticket not found")
			return c.JSON(http.StatusNotFound, map[string]string{"error": "Ticket not found"})
		}
		logger.ErrorContext(ctx, "Failed to fetch core ticket details", "error", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to fetch ticket details"})
	}

	// --- 2. Fetch Tags ---
	tagsQuery := `
        SELECT tg.id, tg.name, tg.created_at
        FROM tags tg
        JOIN ticket_tags tt ON tg.id = tt.tag_id
        WHERE tt.ticket_id = $1
        ORDER BY tg.name ASC`
	tagsRows, tagsErr := h.db.Pool.Query(ctx, tagsQuery, ticketID)
	if tagsErr != nil {
		logger.ErrorContext(ctx, "Failed to query tags for ticket", "error", tagsErr)
		ticket.Tags = []models.Tag{}
	} else {
		defer tagsRows.Close()
		tags := make([]models.Tag, 0)
		for tagsRows.Next() {
			var tag models.Tag
			if scanErr := tagsRows.Scan(&tag.ID, &tag.Name, &tag.CreatedAt); scanErr != nil {
				logger.ErrorContext(ctx, "Failed to scan tag row", "error", scanErr)
				continue
			}
			tags = append(tags, tag)
		}
		if rowsErr := tagsRows.Err(); rowsErr != nil {
            logger.ErrorContext(ctx, "Error iterating tag rows", "error", rowsErr)
        }
		ticket.Tags = tags
		logger.DebugContext(ctx, "Fetched associated tags", "count", len(ticket.Tags))
	}


	// --- 3. Fetch Attachments ---
	attachmentsQuery := `
		SELECT id, filename, storage_path, mime_type, size, uploaded_at, uploaded_by_user_id, uploaded_by_role, url
		FROM attachments
		WHERE ticket_id = $1
		ORDER BY uploaded_at ASC`
	attachRows, attachErr := h.db.Pool.Query(ctx, attachmentsQuery, ticketID)
	if attachErr != nil {
		logger.ErrorContext(ctx, "Failed to query attachments for ticket", "error", attachErr)
		ticket.Attachments = []models.Attachment{}
	} else {
		defer attachRows.Close()
		attachments := make([]models.Attachment, 0)
		for attachRows.Next() {
			var att models.Attachment
			if scanErr := attachRows.Scan(
                &att.ID, &att.Filename, &att.StoragePath, &att.MimeType, &att.Size,
                &att.UploadedAt, &att.UploadedByUserID, &att.UploadedByRole, &att.URL,
            ); scanErr != nil {
				logger.ErrorContext(ctx, "Failed to scan attachment row", "error", scanErr)
				continue
			}
            if att.URL == "" {
                 att.URL = fmt.Sprintf("/api/attachments/download/%s", att.ID)
            }
			attachments = append(attachments, att)
		}
		if rowsErr := attachRows.Err(); rowsErr != nil {
            logger.ErrorContext(ctx, "Error iterating attachment rows", "error", rowsErr)
        }
		ticket.Attachments = attachments
		logger.DebugContext(ctx, "Fetched associated attachments", "count", len(ticket.Attachments))
	}

    // --- 4. Fetch Updates (Comments) ---
	// Similar logic to GetTicketByID
	updatesQuery := `
		SELECT
			tu.id, tu.ticket_id, tu.user_id, tu.comment, tu.is_internal_note, tu.created_at, tu.is_system_update,
			u.id, u.name, u.email, u.role, u.created_at, u.updated_at
		FROM ticket_updates tu
		LEFT JOIN users u ON tu.user_id = u.id
		WHERE tu.ticket_id = $1
		ORDER BY tu.created_at DESC
	`
	updatesRows, updatesErr := h.db.Pool.Query(ctx, updatesQuery, ticketID)
	if updatesErr != nil {
        logger.ErrorContext(ctx, "Failed to query updates for ticket", "error", updatesErr)
        ticket.Updates = []models.TicketUpdate{}
    } else {
        defer updatesRows.Close()
        updates := make([]models.TicketUpdate, 0)
        for updatesRows.Next() { // ... scan updates and users ...
             var update models.TicketUpdate
            var user models.User
            var updateUserID *string
            var userName, userEmail, userRole *string
            var userCreatedAt, userUpdatedAt *time.Time

            err := updatesRows.Scan(
                &update.ID, &update.TicketID, &updateUserID, &update.Comment,
                &update.IsInternalNote, &update.CreatedAt, &update.IsSystemUpdate,
                &user.ID, &userName, &userEmail, &userRole,
                &userCreatedAt, &userUpdatedAt,
            )
            if err != nil {
                 logger.ErrorContext(ctx, "Failed to scan ticket update row", "error", err)
                 continue
            }
            if updateUserID != nil {
                update.UserID = updateUserID
                if userName != nil {
                    user.Name = *userName; user.Email = *userEmail; user.Role = models.UserRole(*userRole);
                    user.CreatedAt = *userCreatedAt; user.UpdatedAt = *userUpdatedAt;
                    update.User = &user
                } else {
                    update.User = &models.User{ID: *updateUserID, Name: "Unknown User"}
                    logger.WarnContext(ctx, "User details not found for update author", "authorUserID", *updateUserID)
                }
            } else {
                update.User = &models.User{Name: "System"}
            }
            updates = append(updates, update)
        }
        if rowsErr := updatesRows.Err(); rowsErr != nil {
             logger.ErrorContext(ctx, "Error iterating update rows", "error", rowsErr)
        }
        ticket.Updates = updates
         logger.DebugContext(ctx, "Fetched associated updates", "count", len(ticket.Updates))
    }


	// --- 5. Return Combined Result ---
	return c.JSON(http.StatusOK, ticket)
}


// GetTicketCounts retrieves counts of tickets grouped by status.
func (h *Handler) GetTicketCounts(c echo.Context) error {
	ctx := context.Background()
	logger := slog.With("handler", "GetTicketCounts")
	query := `SELECT status, COUNT(*) FROM tickets GROUP BY status`
	rows, err := h.db.Pool.Query(ctx, query)
	if err != nil {
		logger.ErrorContext(ctx, "Failed to fetch ticket counts", "error", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to fetch ticket counts"})
	}
	defer rows.Close()

	counts := make(map[string]int)
	for rows.Next() {
		var status string
		var count int
		if err := rows.Scan(&status, &count); err != nil {
			logger.ErrorContext(ctx, "Failed to parse ticket counts", "error", err)
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to parse ticket counts"})
		}
		counts[status] = count
	}
	if err := rows.Err(); err != nil {
		logger.ErrorContext(ctx, "Error iterating ticket count rows", "error", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Error processing ticket count results"})
	}
	logger.InfoContext(ctx, "Retrieved ticket counts", "counts", counts)
	return c.JSON(http.StatusOK, counts)
}

// SearchTickets performs a basic search across multiple ticket fields.
func (h *Handler) SearchTickets(c echo.Context) error {
	ctx := context.Background()
	queryParam := c.QueryParam("query")
    logger := slog.With("handler", "SearchTickets", "query", queryParam)

	if queryParam == "" {
        logger.WarnContext(ctx, "Missing search query parameter")
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Missing search query parameter."})
	}

	// Include necessary fields for display, fetch tags/assignee separately if needed for search results page
	query := `
		SELECT id, ticket_number, subject, description, status, assigned_to_user_id, created_at, updated_at, submitter_name, end_user_email, urgency
		FROM tickets
		WHERE subject ILIKE '%' || $1 || '%'
		   OR description ILIKE '%' || $1 || '%'
		   OR submitter_name ILIKE '%' || $1 || '%'
		   OR end_user_email ILIKE '%' || $1 || '%'
		   OR CAST(ticket_number AS TEXT) ILIKE '%' || $1 || '%'
		ORDER BY updated_at DESC
		LIMIT 50
	`
	rows, err := h.db.Pool.Query(ctx, query, queryParam)
	if err != nil {
		logger.ErrorContext(ctx, "Failed to search tickets", "error", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to search tickets"})
	}
	defer rows.Close()

	var tickets []models.Ticket
	for rows.Next() {
		var ticket models.Ticket
		var submitterName string
		err := rows.Scan(
			&ticket.ID, &ticket.TicketNumber, &ticket.Subject, &ticket.Description, &ticket.Status,
			&ticket.AssignedToUserID, &ticket.CreatedAt, &ticket.UpdatedAt,
			&submitterName, &ticket.EndUserEmail, &ticket.Urgency,
		)
		if err != nil {
			logger.ErrorContext(ctx, "Failed to parse searched ticket data", "error", err)
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to parse ticket data"})
		}
        if submitterName != "" { ticket.SubmitterName = &submitterName }
		tickets = append(tickets, ticket)
	}
	if err := rows.Err(); err != nil {
		logger.ErrorContext(ctx, "Error iterating search ticket rows", "error", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Error processing search ticket results"})
	}

    logger.InfoContext(ctx, "Ticket search successful", "resultCount", len(tickets))
	return c.JSON(http.StatusOK, tickets)
}