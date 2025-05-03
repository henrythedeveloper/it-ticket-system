// backend/internal/api/handlers/ticket/ticket_query.go
// ==========================================================================
// Contains all ticket query operations: listing, searching, counts, details.
// Extracted from ticket_operations.go for better maintainability.
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

	// Parse query parameters for filtering and pagination
	status := c.QueryParam("status")
	assignedTo := c.QueryParam("assigned_to")
	submitterID := c.QueryParam("submitter_id")
	limitStr := c.QueryParam("limit")
	pageStr := c.QueryParam("page")

	// Default values
	limit := 15
	page := 1
	var err error
	if limitStr != "" {
		limit, err = strconv.Atoi(limitStr)
		if err != nil || limit < 1 {
			limit = 15
		}
	}
	if pageStr != "" {
		page, err = strconv.Atoi(pageStr)
		if err != nil || page < 1 {
			page = 1
		}
	}
	offset := (page - 1) * limit

	// Updated query to include assignee info and tags
	query := `SELECT t.id, t.ticket_number, t.subject, t.description, t.status, t.urgency, t.created_at, t.updated_at,
		COALESCE(json_build_object('id', u.id, 'name', u.name, 'email', u.email), NULL) as assigned_to,
		COALESCE(json_agg(json_build_object('id', tg.id, 'name', tg.name)) FILTER (WHERE tg.id IS NOT NULL), '[]') as tags
	FROM tickets t
	LEFT JOIN users u ON t.assigned_to_user_id = u.id
	LEFT JOIN ticket_tags tt ON t.id = tt.ticket_id
	LEFT JOIN tags tg ON tt.tag_id = tg.id`
	args := []interface{}{}
	whereClauses := []string{}
	argIdx := 1

	// Special handling for status=Unassigned
	if status == "Unassigned" {
		whereClauses = append(whereClauses, "assigned_to_user_id IS NULL")
	} else if status != "" {
		statuses := strings.Split(status, ",")
		for i := range statuses {
			statuses[i] = strings.TrimSpace(statuses[i])
		}
		if len(statuses) == 1 {
			whereClauses = append(whereClauses, "status = $"+strconv.Itoa(argIdx))
			args = append(args, statuses[0])
			argIdx++
		} else {
			placeholders := []string{}
			for range statuses {
				placeholders = append(placeholders, "$"+strconv.Itoa(argIdx))
				argIdx++
			}
			whereClauses = append(whereClauses, "status IN ("+strings.Join(placeholders, ",")+")")
			for _, s := range statuses {
				args = append(args, s)
			}
		}
	}

	// Filter by assigned_to (if provided)
	if assignedTo != "" {
		whereClauses = append(whereClauses, "assigned_to_user_id = $"+strconv.Itoa(argIdx))
		args = append(args, assignedTo)
		argIdx++
	}

	// Filter by submitter_id (if provided)
	if submitterID != "" {
		whereClauses = append(whereClauses, "submitter_id = $"+strconv.Itoa(argIdx))
		args = append(args, submitterID)
		argIdx++
	}

	if len(whereClauses) > 0 {
		query += " WHERE " + strings.Join(whereClauses, " AND ")
	}
	// Updated GROUP BY to include all non-aggregated columns required by PostgreSQL
	query += " GROUP BY t.id, t.ticket_number, t.subject, t.description, t.status, t.urgency, t.created_at, t.updated_at, u.id, u.name, u.email"
	query += " ORDER BY t.updated_at DESC LIMIT $" + strconv.Itoa(argIdx) + " OFFSET $" + strconv.Itoa(argIdx+1)
	args = append(args, limit, offset)

	// Get total count for pagination (do not include limit/offset in args)
	totalArgs := args[:len(args)-2]
	totalQuery := "SELECT COUNT(*) FROM tickets"
	if len(whereClauses) > 0 {
		totalQuery += " WHERE " + strings.Join(whereClauses, " AND ")
	}
	totalCount := 0
	err = h.db.Pool.QueryRow(ctx, totalQuery, totalArgs...).Scan(&totalCount)
	if err != nil {
		c.Logger().Errorf("Failed to fetch ticket count: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to fetch ticket count"})
	}

	rows, err := h.db.Pool.Query(ctx, query, args...)
	if err != nil {
		c.Logger().Errorf("Failed to fetch tickets: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to fetch tickets"})
	}
	defer rows.Close()

	var tickets []map[string]interface{}
	for rows.Next() {
		var id, subject, description, status, urgency string
		var ticketNumber int
		var createdAt, updatedAt time.Time
		var assignedTo json.RawMessage
		var tags json.RawMessage
		err := rows.Scan(&id, &ticketNumber, &subject, &description, &status, &urgency, &createdAt, &updatedAt, &assignedTo, &tags)
		if err != nil {
			c.Logger().Errorf("Failed to parse ticket data: %v", err)
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to parse ticket data"})
		}
		ticket := map[string]interface{}{
			"id":            id,
			"ticket_number": ticketNumber,
			"subject":       subject,
			"description":   description,
			"status":        status,
			"urgency":       urgency,
			"created_at":    createdAt.Format(time.RFC3339),
			"updated_at":    updatedAt.Format(time.RFC3339),
		}
		var assignedToObj interface{}
		json.Unmarshal(assignedTo, &assignedToObj)
		ticket["assigned_to"] = assignedToObj
		var tagsArr interface{}
		json.Unmarshal(tags, &tagsArr)
		ticket["tags"] = tagsArr
		tickets = append(tickets, ticket)
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

	query := `SELECT t.id, t.ticket_number, t.subject, t.description, t.status, t.urgency, t.created_at, t.updated_at,
		COALESCE(json_build_object('id', u.id, 'name', u.name, 'email', u.email), NULL) as assigned_to,
		COALESCE(json_agg(json_build_object('id', tg.id, 'name', tg.name)) FILTER (WHERE tg.id IS NOT NULL), '[]') as tags
	FROM tickets t
	LEFT JOIN users u ON t.assigned_to_user_id = u.id
	LEFT JOIN ticket_tags tt ON t.id = tt.ticket_id
	LEFT JOIN tags tg ON tt.tag_id = tg.id
	WHERE t.id = $1
	GROUP BY t.id, t.ticket_number, t.subject, t.description, t.status, t.urgency, t.created_at, t.updated_at, u.id, u.name, u.email`
	row := h.db.Pool.QueryRow(ctx, query, ticketID)

	var id, subject, description, status, urgency string
	var ticketNumber int
	var createdAt, updatedAt time.Time
	var assignedTo json.RawMessage
	var tags json.RawMessage
	err := row.Scan(&id, &ticketNumber, &subject, &description, &status, &urgency, &createdAt, &updatedAt, &assignedTo, &tags)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return c.JSON(http.StatusNotFound, map[string]string{"error": "Ticket not found"})
		}
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to fetch ticket details"})
	}

	ticket := map[string]interface{}{
		"id":            id,
		"ticket_number": ticketNumber,
		"subject":       subject,
		"description":   description,
		"status":        status,
		"urgency":       urgency,
		"created_at":    createdAt.Format(time.RFC3339),
		"updated_at":    updatedAt.Format(time.RFC3339),
	}
	var assignedToObj interface{}
	json.Unmarshal(assignedTo, &assignedToObj)
	ticket["assignedTo"] = assignedToObj
	var tagsArr interface{}
	json.Unmarshal(tags, &tagsArr)
	ticket["tags"] = tagsArr

	return c.JSON(http.StatusOK, ticket)
}

// GetTicketByIDOptimized retrieves ticket details with optimized queries that combine related data.
func (h *Handler) GetTicketByIDOptimized(c echo.Context) error {
	ctx := context.Background()
	ticketID := c.Param("id")

	query := `
		SELECT id, ticket_number, subject, description, status, assigned_to_user_id, created_at, updated_at,
		       COALESCE(tags_json, '[]') AS tags_json,
		       COALESCE(attachments_json, '[]') AS attachments_json
		FROM tickets
		LEFT JOIN (
		    SELECT ticket_id, json_agg(tag) AS tags_json
		    FROM ticket_tags
		    GROUP BY ticket_id
		) t ON tickets.id = t.ticket_id
		LEFT JOIN (
		    SELECT ticket_id, json_agg(attachment) AS attachments_json
		    FROM ticket_attachments
		    GROUP BY ticket_id
		) a ON tickets.id = a.ticket_id
		WHERE id = $1
	`
	row := h.db.Pool.QueryRow(ctx, query, ticketID)

	ticket, tagsJSON, attachmentsJSON, err := scanTicketWithRelatedData(row)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return c.JSON(http.StatusNotFound, map[string]string{"error": "Ticket not found"})
		}
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to fetch ticket details"})
	}

	var tags []models.Tag
	var attachments []models.Attachment
	_ = json.Unmarshal(tagsJSON, &tags)
	_ = json.Unmarshal(attachmentsJSON, &attachments)

	response := map[string]interface{}{
		"ticket":      ticket,
		"tags":        tags,
		"attachments": attachments,
	}

	return c.JSON(http.StatusOK, response)
}

// scanTicketWithRelatedData scans a ticket with core data and JSON aggregates for related data
func scanTicketWithRelatedData(row pgx.Row) (ticket models.Ticket, tagsJSON, attachmentsJSON []byte, err error) {
	err = row.Scan(&ticket.ID, &ticket.TicketNumber, &ticket.Subject, &ticket.Description, &ticket.Status, &ticket.AssignedToUserID, &ticket.CreatedAt, &ticket.UpdatedAt, &tagsJSON, &attachmentsJSON)
	return
}

// GetTicketCounts retrieves counts of tickets grouped by status.
func (h *Handler) GetTicketCounts(c echo.Context) error {
	ctx := context.Background()

	query := `SELECT status, COUNT(*) FROM tickets GROUP BY status`
	rows, err := h.db.Pool.Query(ctx, query)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to fetch ticket counts"})
	}
	defer rows.Close()

	counts := make(map[string]int)
	for rows.Next() {
		var status string
		var count int
		err := rows.Scan(&status, &count)
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to parse ticket counts"})
		}
		counts[status] = count
	}

	return c.JSON(http.StatusOK, counts)
}

// SearchTickets performs a basic search across multiple ticket fields.
func (h *Handler) SearchTickets(c echo.Context) error {
	ctx := context.Background()
	queryParam := c.QueryParam("query")

	// Updated query to include ticket_number and assigned_to_user_id
	query := `
		SELECT id, ticket_number, subject, description, status, assigned_to_user_id, created_at, updated_at
		FROM tickets
		WHERE subject ILIKE '%' || $1 || '%'
		   OR description ILIKE '%' || $1 || '%'
	`
	rows, err := h.db.Pool.Query(ctx, query, queryParam)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to search tickets"})
	}
	defer rows.Close()

	var tickets []models.Ticket
	for rows.Next() {
		var ticket models.Ticket
		// Updated scan to include ticket_number and assigned_to_user_id
		err := rows.Scan(&ticket.ID, &ticket.TicketNumber, &ticket.Subject, &ticket.Description, &ticket.Status, &ticket.AssignedToUserID, &ticket.CreatedAt, &ticket.UpdatedAt)
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to parse ticket data"})
		}
		tickets = append(tickets, ticket)
	}

	return c.JSON(http.StatusOK, tickets)
}

// (Add all query-related helpers here as well, with full implementations)
