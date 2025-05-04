// backend/internal/api/handlers/ticket/ticket_query.go
// ==========================================================================
// Contains all ticket query operations: listing, searching, counts, details.
// Extracted from ticket_operations.go for better maintainability.
// REVISED: Simplified submitter_name handling assuming it's NOT NULL in DB.
// ==========================================================================

package ticket

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/henrythedeveloper/it-ticket-system/internal/models"
	"github.com/jackc/pgx/v5"
	"github.com/labstack/echo/v4"
)

// --- QUERY OPERATIONS ---

// GetAllTickets retrieves a list of tickets based on query parameters for filtering and pagination.
func (h *Handler) GetAllTickets(c echo.Context) error {
	ctx := context.Background()

	// ... (Parameter parsing and defaults remain the same) ...
	status := c.QueryParam("status")
	assignedTo := c.QueryParam("assigned_to")
	submitterID := c.QueryParam("submitter_id")
	limitStr := c.QueryParam("limit")
	pageStr := c.QueryParam("page")
	limit := 15
	page := 1
	var err error
	if limitStr != "" {
		limit, err = strconv.Atoi(limitStr)
		if err != nil || limit < 1 { limit = 15 }
	}
	if pageStr != "" {
		page, err = strconv.Atoi(pageStr)
		if err != nil || page < 1 { page = 1 }
	}
	offset := (page - 1) * limit
	// ... (End parameter parsing) ...

	// Query remains the same as it already selected the necessary columns
	query := `SELECT
		t.id, t.ticket_number, t.subject, t.description, t.status, t.urgency, t.created_at, t.updated_at,
		t.submitter_name, -- Selecting NOT NULL field
		t.end_user_email,
		COALESCE(json_build_object('id', u.id, 'name', u.name, 'email', u.email), NULL) as assigned_to,
		COALESCE(json_agg(json_build_object('id', tg.id, 'name', tg.name)) FILTER (WHERE tg.id IS NOT NULL), '[]') as tags
	FROM tickets t
	LEFT JOIN users u ON t.assigned_to_user_id = u.id
	LEFT JOIN ticket_tags tt ON t.id = tt.ticket_id
	LEFT JOIN tags tg ON tt.tag_id = tg.id`

	args := []interface{}{}
	whereClauses := []string{}
	argIdx := 1

	// ... (Filtering logic remains the same) ...
	if status == "Unassigned" { whereClauses = append(whereClauses, "t.assigned_to_user_id IS NULL")
	} else if status != "" {
		// ... status handling ...
		statuses := strings.Split(status, ",")
		for i := range statuses { statuses[i] = strings.TrimSpace(statuses[i]) }
		if len(statuses) == 1 {
			whereClauses = append(whereClauses, "t.status = $"+strconv.Itoa(argIdx))
			args = append(args, statuses[0])
			argIdx++
		} else {
			placeholders := []string{}
			for range statuses { placeholders = append(placeholders, "$"+strconv.Itoa(argIdx)); argIdx++ }
			whereClauses = append(whereClauses, "t.status IN ("+strings.Join(placeholders, ",")+")")
			for _, s := range statuses { args = append(args, s) }
		}
	}
	if assignedTo != "" { whereClauses = append(whereClauses, "t.assigned_to_user_id = $"+strconv.Itoa(argIdx)); args = append(args, assignedTo); argIdx++ }
	if submitterID != "" { whereClauses = append(whereClauses, "t.submitter_id = $"+strconv.Itoa(argIdx)); args = append(args, submitterID); argIdx++ }
	// ... (End filtering logic) ...

	if len(whereClauses) > 0 {
		query += " WHERE " + strings.Join(whereClauses, " AND ")
	}
	// GROUP BY remains the same (includes submitter_name, end_user_email)
	query += " GROUP BY t.id, t.ticket_number, t.subject, t.description, t.status, t.urgency, t.created_at, t.updated_at, t.submitter_name, t.end_user_email, u.id"
	query += " ORDER BY t.updated_at DESC LIMIT $" + strconv.Itoa(argIdx) + " OFFSET $" + strconv.Itoa(argIdx+1)
	args = append(args, limit, offset)

	// ... (Total count query remains the same) ...
	totalArgs := args[:len(args)-2]
	totalQuery := "SELECT COUNT(*) FROM tickets t"
	if len(whereClauses) > 0 { totalQuery += " WHERE " + strings.Join(whereClauses, " AND ") }
	totalCount := 0
	err = h.db.Pool.QueryRow(ctx, totalQuery, totalArgs...).Scan(&totalCount)
	if err != nil { /* ... error handling ... */
		c.Logger().Errorf("Failed to fetch ticket count: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to fetch ticket count"})
	}

	rows, err := h.db.Pool.Query(ctx, query, args...)
	if err != nil { /* ... error handling ... */
		c.Logger().Errorf("Failed to fetch tickets: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to fetch tickets"})
	}
	defer rows.Close()

	var tickets []map[string]interface{}
	for rows.Next() {
		// *** MODIFIED VARIABLES ***: Use simple string for submitterName
		var id, subject, description, status, urgency, submitterName, endUserEmail string
		var ticketNumber int
		var createdAt, updatedAt time.Time
		var assignedTo json.RawMessage
		var tags json.RawMessage
		// *** MODIFIED SCAN ***: Scan directly into string variable
		err := rows.Scan(&id, &ticketNumber, &subject, &description, &status, &urgency, &createdAt, &updatedAt, &submitterName, &endUserEmail, &assignedTo, &tags)
		if err != nil { /* ... error handling ... */
			c.Logger().Errorf("Failed to parse ticket data: %v", err)
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to parse ticket data"})
		}

		// *** MODIFIED MAP POPULATION ***: Assign submitterName directly
		ticket := map[string]interface{}{
			"id":             id,
			"ticket_number":  ticketNumber,
			"subject":        subject,
			"description":    description,
			"status":         status,
			"urgency":        urgency,
			"created_at":     createdAt.Format(time.RFC3339),
			"updated_at":     updatedAt.Format(time.RFC3339),
			"end_user_email": endUserEmail,
			"submitter_name": submitterName, // Assign directly
		}

		// Process assigned_to and tags as before
		var assignedToObj interface{}
		json.Unmarshal(assignedTo, &assignedToObj)
		ticket["assigned_to"] = assignedToObj

		var tagsArr interface{}
		json.Unmarshal(tags, &tagsArr)
		ticket["tags"] = tagsArr

		tickets = append(tickets, ticket)
	}
	if err := rows.Err(); err != nil { /* ... error handling ... */
		c.Logger().Errorf("Error iterating ticket rows: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Error processing ticket results"})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"data":  tickets,
		"total": totalCount,
	})
}

// GetTicketByID retrieves details for a single ticket, including related data.
func (h *Handler) GetTicketByID(c echo.Context) error {
	ctx := context.Background()
	ticketID := c.Param("id")

	// Query remains the same
	query := `SELECT
		t.id, t.ticket_number, t.subject, t.description, t.status, t.urgency, t.created_at, t.updated_at,
		t.submitter_name, -- Selecting NOT NULL field
		t.end_user_email,
		COALESCE(json_build_object('id', u.id, 'name', u.name, 'email', u.email), NULL) as assigned_to,
		COALESCE(json_agg(json_build_object('id', tg.id, 'name', tg.name)) FILTER (WHERE tg.id IS NOT NULL), '[]') as tags
	FROM tickets t
	LEFT JOIN users u ON t.assigned_to_user_id = u.id
	LEFT JOIN ticket_tags tt ON t.id = tt.ticket_id
	LEFT JOIN tags tg ON tt.tag_id = tg.id
	WHERE t.id = $1
	-- GROUP BY remains the same
	GROUP BY t.id, t.ticket_number, t.subject, t.description, t.status, t.urgency, t.created_at, t.updated_at, t.submitter_name, t.end_user_email, u.id`
	row := h.db.Pool.QueryRow(ctx, query, ticketID)

	// *** MODIFIED VARIABLES ***: Use simple string for submitterName
	var id, subject, description, status, urgency, submitterName, endUserEmail string
	var ticketNumber int
	var createdAt, updatedAt time.Time
	var assignedTo json.RawMessage
	var tags json.RawMessage
	// *** MODIFIED SCAN ***: Scan directly into string variable
	err := row.Scan(&id, &ticketNumber, &subject, &description, &status, &urgency, &createdAt, &updatedAt, &submitterName, &endUserEmail, &assignedTo, &tags)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) { /* ... error handling ... */
			c.Logger().Warnf("Ticket not found for ID %s: %v", ticketID, err)
			return c.JSON(http.StatusNotFound, map[string]string{"error": "Ticket not found"})
		} /* ... error handling ... */
		c.Logger().Errorf("Failed to scan ticket details for ID %s: %v", ticketID, err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to fetch ticket details"})
	}

	// *** MODIFIED MAP POPULATION ***: Assign submitterName directly
	ticket := map[string]interface{}{
		"id":             id,
		"ticket_number":  ticketNumber,
		"subject":        subject,
		"description":    description,
		"status":         status,
		"urgency":        urgency,
		"created_at":     createdAt.Format(time.RFC3339),
		"updated_at":     updatedAt.Format(time.RFC3339),
		"end_user_email": endUserEmail,
		"submitter_name": submitterName, // Assign directly
	}

	// Process assigned_to and tags as before
	var assignedToObj interface{}
	json.Unmarshal(assignedTo, &assignedToObj)
	ticket["assigned_to"] = assignedToObj

	var tagsArr interface{}
	json.Unmarshal(tags, &tagsArr)
	ticket["tags"] = tagsArr

	// --- Fetch ticket updates/comments and add to ticket map ---
	updatesQuery := `
		SELECT
			tu.id, tu.ticket_id, tu.user_id, tu.comment, tu.is_internal_note, tu.created_at,
			u.id, u.name, u.email, u.role, u.created_at, u.updated_at
		FROM ticket_updates tu
		LEFT JOIN users u ON tu.user_id = u.id
		WHERE tu.ticket_id = $1
		ORDER BY tu.created_at DESC
	`
	rows, err := h.db.Pool.Query(ctx, updatesQuery, id)
	if err != nil {
		c.Logger().Errorf("Failed to fetch ticket updates: %v", err)
		// Still return ticket, but with empty updates
		ticket["updates"] = []interface{}{}
	} else {
		defer rows.Close()
		var updates []map[string]interface{}
		for rows.Next() {
			var updateID, updateTicketID, updateComment string
			var updateUserID *string
			var isInternalNote bool
			var createdAt time.Time
			var userID, userName, userEmail, userRole *string
			var userCreatedAt, userUpdatedAt *time.Time

			err := rows.Scan(
				&updateID, &updateTicketID, &updateUserID, &updateComment, &isInternalNote, &createdAt,
				&userID, &userName, &userEmail, &userRole, &userCreatedAt, &userUpdatedAt,
			)
			if err != nil {
				continue // skip this update if error
			}
			update := map[string]interface{}{
				"id":              updateID,
				"ticket_id":       updateTicketID,
				"user_id":         updateUserID,
				"comment":         updateComment,
				"is_internal_note": isInternalNote,
				"created_at":      createdAt.Format(time.RFC3339),
			}
			// Populate user object if present
			if userID != nil && userName != nil {
				update["user"] = map[string]interface{}{
					"id":         *userID,
					"name":       *userName,
					"email":      userEmail,
					"role":       userRole,
					"created_at": userCreatedAt,
					"updated_at": userUpdatedAt,
				}
			} else if updateUserID != nil {
				update["user"] = map[string]interface{}{
					"id":   *updateUserID,
					"name": "Unknown User",
				}
			} else {
				update["user"] = map[string]interface{}{
					"name": "System",
				}
			}
			updates = append(updates, update)
		}
		ticket["updates"] = updates
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    ticket,
	})
}

// GetTicketByIDOptimized retrieves ticket details with optimized queries that combine related data.
func (h *Handler) GetTicketByIDOptimized(c echo.Context) error {
	ctx := context.Background()
	ticketID := c.Param("id")

	// Query remains the same
	query := `
		SELECT
			t.id, t.ticket_number, t.subject, t.description, t.status, t.assigned_to_user_id, t.created_at, t.updated_at,
			t.submitter_name, t.end_user_email, -- Selecting NOT NULL fields
			COALESCE(tags_agg.tags_json, '[]') AS tags_json,
			COALESCE(attachments_agg.attachments_json, '[]') AS attachments_json
		FROM tickets t
		LEFT JOIN (
			SELECT tt.ticket_id, json_agg(json_build_object('id', tg.id, 'name', tg.name, 'created_at', tg.created_at)) AS tags_json
			FROM ticket_tags tt
			JOIN tags tg ON tt.tag_id = tg.id
			GROUP BY tt.ticket_id
		) tags_agg ON t.id = tags_agg.ticket_id
		LEFT JOIN (
			SELECT at.ticket_id, json_agg(json_build_object('id', at.id, 'filename', at.filename, 'mime_type', at.mime_type, 'size', at.size, 'uploaded_at', at.uploaded_at, 'url', at.url)) AS attachments_json
			FROM attachments at
			GROUP BY at.ticket_id
		) attachments_agg ON t.id = attachments_agg.ticket_id
		WHERE t.id = $1
	`
	row := h.db.Pool.QueryRow(ctx, query, ticketID)

	// *** Use the MODIFIED scanner function call ***
	ticket, tagsJSON, attachmentsJSON, err := scanTicketWithRelatedDataOptimized(row)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) { /* ... error handling ... */
			c.Logger().Warnf("Ticket not found (optimized) for ID %s: %v", ticketID, err)
			return c.JSON(http.StatusNotFound, map[string]string{"error": "Ticket not found"})
		} /* ... error handling ... */
		c.Logger().Errorf("Failed to fetch optimized ticket details for ID %s: %v", ticketID, err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to fetch ticket details"})
	}

	// ... (Unmarshalling and populating tags/attachments remains the same) ...
	var tags []models.Tag
	var attachments []models.Attachment
	_ = json.Unmarshal(tagsJSON, &tags)
	_ = json.Unmarshal(attachmentsJSON, &attachments)
	ticket.Tags = tags
	ticket.Attachments = attachments
	// ... (End unmarshalling) ...

	return c.JSON(http.StatusOK, ticket) // Return the populated struct
}

// *** MODIFIED SCANNER FUNCTION for GetTicketByIDOptimized ***
// scanTicketWithRelatedDataOptimized scans core ticket data including submitter/email and JSON aggregates.
// Assumes submitter_name is NOT NULL.
func scanTicketWithRelatedDataOptimized(row pgx.Row) (ticket models.Ticket, tagsJSON, attachmentsJSON []byte, err error) {
	// *** Use simple string for submitterName ***
	var submitterName string
	err = row.Scan(
		&ticket.ID, &ticket.TicketNumber, &ticket.Subject, &ticket.Description, &ticket.Status,
		&ticket.AssignedToUserID, &ticket.CreatedAt, &ticket.UpdatedAt,
		&submitterName, &ticket.EndUserEmail, // Scan into simple string
		&tagsJSON, &attachmentsJSON,
	)
	if err != nil {
		return // Return scanned data and error
	}
	// *** Assign directly to pointer field ***
	// Since models.Ticket.SubmitterName is *string, assign the address
	ticket.SubmitterName = &submitterName
	return // Return scanned data and nil error
}

// GetTicketCounts retrieves counts of tickets grouped by status.
func (h *Handler) GetTicketCounts(c echo.Context) error {
	ctx := context.Background()
	// ... (No changes needed in this function) ...
	query := `SELECT status, COUNT(*) FROM tickets GROUP BY status`
	rows, err := h.db.Pool.Query(ctx, query)
	if err != nil { c.Logger().Errorf("Failed to fetch ticket counts: %v", err); return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to fetch ticket counts"}) }
	defer rows.Close()
	counts := make(map[string]int)
	for rows.Next() {
		var status string
		var count int
		err := rows.Scan(&status, &count)
		if err != nil { c.Logger().Errorf("Failed to parse ticket counts: %v", err); return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to parse ticket counts"}) }
		counts[status] = count
	}
	if err := rows.Err(); err != nil { c.Logger().Errorf("Error iterating ticket count rows: %v", err); return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Error processing ticket count results"}) }
	return c.JSON(http.StatusOK, counts)
}

// SearchTickets performs a basic search across multiple ticket fields.
func (h *Handler) SearchTickets(c echo.Context) error {
	ctx := context.Background()
	queryParam := c.QueryParam("query")
	if queryParam == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Missing search query parameter."})
	}

	// Query remains the same as it already included submitter_name/email
	query := `
		SELECT id, ticket_number, subject, description, status, assigned_to_user_id, created_at, updated_at, submitter_name, end_user_email, urgency
		FROM tickets
		WHERE subject ILIKE '%' || $1 || '%'
		   OR description ILIKE '%' || $1 || '%'
		   OR submitter_name ILIKE '%' || $1 || '%' -- Search submitter name
		   OR end_user_email ILIKE '%' || $1 || '%' -- Search email
		   OR CAST(ticket_number AS TEXT) ILIKE '%' || $1 || '%' -- Search ticket number
		ORDER BY updated_at DESC
		LIMIT 50
	`
	rows, err := h.db.Pool.Query(ctx, query, queryParam)
	if err != nil { /* ... error handling ... */
		c.Logger().Errorf("Failed to search tickets: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to search tickets"})
	}
	defer rows.Close()

	var tickets []models.Ticket
	for rows.Next() {
		var ticket models.Ticket
		// *** Use simple string for submitterName ***
		var submitterName string
		err := rows.Scan(
			&ticket.ID, &ticket.TicketNumber, &ticket.Subject, &ticket.Description, &ticket.Status,
			&ticket.AssignedToUserID, &ticket.CreatedAt, &ticket.UpdatedAt,
			&submitterName, &ticket.EndUserEmail, &ticket.Urgency, // Scan into simple string
		)
		if err != nil { /* ... error handling ... */
			c.Logger().Errorf("Failed to parse searched ticket data: %v", err)
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to parse ticket data"})
		}
		// *** Assign directly to pointer field ***
		ticket.SubmitterName = &submitterName
		tickets = append(tickets, ticket)
	}
	if err := rows.Err(); err != nil { /* ... error handling ... */
		c.Logger().Errorf("Error iterating search ticket rows: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Error processing search ticket results"})
	}

	return c.JSON(http.StatusOK, tickets)
}