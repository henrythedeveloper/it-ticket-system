package handlers

import (
    "net/http"
    "time"
    "strings"

    "github.com/gin-gonic/gin"
    "gorm.io/gorm"
    "helpdesk/internal/models"
)

type TicketHandler struct {
    db *gorm.DB
}

func NewTicketHandler(db *gorm.DB) *TicketHandler {
    return &TicketHandler{db: db}
}

type CreateTicketRequest struct {
    Category       string     `json:"category" binding:"required"`
    Description    string     `json:"description" binding:"required"`
    SubmitterEmail string     `json:"submitterEmail" binding:"required,email"`
    Urgency        string     `json:"urgency" binding:"required,oneof=low normal high critical"`
    DueDate        *time.Time `json:"dueDate,omitempty"`
}

// CreateTicket handles public ticket submissions
func (h *TicketHandler) CreateTicket(c *gin.Context) {
    var req CreateTicketRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }

    tx := h.db.Begin()
    if tx.Error != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to start transaction"})
        return
    }

    // Get next ticket number from sequence
    var ticketNumber string
    err := tx.Raw("SELECT CONCAT('TICKET-', LPAD(nextval('ticket_number_seq')::text, 6, '0'))").Scan(&ticketNumber).Error
    if err != nil {
        tx.Rollback()
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate ticket number"})
        return
    }

    // Determine urgency based on due date if not explicitly set
    urgency := req.Urgency
    if urgency == "" && req.DueDate != nil {
        daysUntilDue := time.Until(*req.DueDate).Hours() / 24
        switch {
        case daysUntilDue <= 1:
            urgency = "critical"
        case daysUntilDue <= 3:
            urgency = "high"
        case daysUntilDue <= 7:
            urgency = "normal"
        default:
            urgency = "low"
        }
    }

    ticket := &models.Ticket{
        TicketNumber:   ticketNumber,
        Category:       req.Category,
        Description:    req.Description,
        SubmitterEmail: req.SubmitterEmail,
        Status:         models.TicketStatusOpen,
        Urgency:        urgency,
        DueDate:        req.DueDate,
    }

    if err := tx.Create(ticket).Error; err != nil {
        tx.Rollback()
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create ticket"})
        return
    }

    // Create initial history entry
    history := models.TicketHistory{
        TicketID: ticket.ID,
        Action:   "created",
        Notes:    "Ticket submitted",
    }

    if err := tx.Create(&history).Error; err != nil {
        tx.Rollback()
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create ticket history"})
        return
    }

    // Search for and associate relevant solutions
    var solutions []models.Solution
    tx.Where("category = ?", ticket.Category).
       Where("LOWER(description) LIKE ?", "%"+strings.ToLower(ticket.Description)+"%").
       Limit(5).
       Find(&solutions)

    // Create email solution history entries for suggested solutions
    for _, solution := range solutions {
        emailHistory := models.EmailSolutionHistory{
            Email:      ticket.SubmitterEmail,
            TicketID:   ticket.ID,
            SolutionID: solution.ID,
        }
        if err := tx.Create(&emailHistory).Error; err != nil {
            tx.Rollback()
            c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create email solution history"})
            return
        }
    }

    if err := tx.Commit().Error; err != nil {
        tx.Rollback()
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to commit transaction"})
        return
    }

    // Load related solutions for response
    tx.Model(&ticket).Association("Solutions").Find(&ticket.Solutions)

    c.JSON(http.StatusCreated, gin.H{
        "message": "Ticket created successfully",
        "ticket":  ticket,
    })
}

// SearchSolutions searches for solutions based on keywords and category
func (h *TicketHandler) SearchSolutions(c *gin.Context) {
    var req struct {
        Description string `json:"description" binding:"required"`
        Category    string `json:"category" binding:"required"`
        Email       string `json:"email,omitempty"`
    }

    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }

    // Split description into keywords
    keywords := strings.Fields(strings.ToLower(req.Description))
    if len(keywords) == 0 {
        c.JSON(http.StatusOK, gin.H{"data": []models.Solution{}})
        return
    }

    // Build the query
    query := h.db.Model(&models.Solution{}).Where("category = ?", req.Category)

    // Add keyword search conditions
    conditions := make([]string, len(keywords))
    values := make([]interface{}, len(keywords))
    for i, keyword := range keywords {
        conditions[i] = "LOWER(title) LIKE ? OR LOWER(description) LIKE ?"
        values[i] = "%" + keyword + "%"
        values = append(values, "%" + keyword + "%")
    }

    query = query.Where(strings.Join(conditions, " OR "), values...)

    // If email is provided, prioritize solutions that have worked for this email before
    if req.Email != "" {
        query = query.
            Joins("LEFT JOIN email_solutions_history esh ON solutions.id = esh.solution_id").
            Where("esh.email = ? OR esh.email IS NULL", req.Email).
            Order("CASE WHEN esh.email IS NOT NULL THEN 0 ELSE 1 END")
    }

    // Execute the query
    var solutions []models.Solution
    if err := query.Order("created_at DESC").Limit(5).Find(&solutions).Error; err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to search solutions"})
        return
    }

    c.JSON(http.StatusOK, gin.H{"data": solutions})
}

// UpdateTicket handles ticket updates
func (h *TicketHandler) UpdateTicket(c *gin.Context) {
    var req struct {
        Status     string     `json:"status"`
        AssignedTo *uint      `json:"assignedTo"`
        Solution   *string    `json:"solution"`
        Urgency    string     `json:"urgency" binding:"omitempty,oneof=low normal high critical"`
        DueDate    *time.Time `json:"dueDate,omitempty"`
    }

    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }

    ticketID := c.Param("id")
    userID, exists := c.Get("userID")
    if !exists {
        c.JSON(http.StatusUnauthorized, gin.H{"error": "User not found in context"})
        return
    }

    tx := h.db.Begin()
    if tx.Error != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to start transaction"})
        return
    }

    var ticket models.Ticket
    if err := tx.First(&ticket, ticketID).Error; err != nil {
        tx.Rollback()
        c.JSON(http.StatusNotFound, gin.H{"error": "Ticket not found"})
        return
    }

    // Record the changes in history
    changes := make(map[string]interface{})
    historyNotes := ""

    if req.Status != "" && req.Status != ticket.Status {
        changes["status"] = req.Status
        historyNotes += "Status changed to " + req.Status + ". "
        if req.Status == "resolved" {
            now := time.Now()
            changes["resolved_at"] = &now
            changes["resolved_by"] = userID
        }
    }

    if req.AssignedTo != nil && (ticket.AssignedTo == nil || *req.AssignedTo != *ticket.AssignedTo) {
        changes["assigned_to"] = req.AssignedTo
        historyNotes += "Reassigned ticket. "
    }

    if req.Solution != nil && (ticket.Solution == nil || *req.Solution != *ticket.Solution) {
        changes["solution"] = req.Solution
        historyNotes += "Added solution. "
    }

    if req.Urgency != "" && req.Urgency != ticket.Urgency {
        changes["urgency"] = req.Urgency
        historyNotes += "Urgency changed to " + req.Urgency + ". "
    }

    if req.DueDate != ticket.DueDate {
        changes["due_date"] = req.DueDate
        if req.DueDate != nil {
            historyNotes += "Due date set to " + req.DueDate.Format("2006-01-02 15:04") + ". "
        } else {
            historyNotes += "Due date removed. "
        }
    }

    if len(changes) > 0 {
        if err := tx.Model(&ticket).Updates(changes).Error; err != nil {
            tx.Rollback()
            c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update ticket"})
            return
        }

        // Create history entry
        uid := userID.(uint)
        history := models.TicketHistory{
            TicketID: ticket.ID,
            UserID:   &uid,
            Action:   "updated",
            Notes:    historyNotes,
        }

        if err := tx.Create(&history).Error; err != nil {
            tx.Rollback()
            c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create ticket history"})
            return
        }
    }

    if err := tx.Commit().Error; err != nil {
        tx.Rollback()
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to commit transaction"})
        return
    }

    c.JSON(http.StatusOK, gin.H{
        "message": "Ticket updated successfully",
        "ticket":  ticket,
    })
}

// GetTicket returns a specific ticket
func (h *TicketHandler) GetTicket(c *gin.Context) {
    ticketID := c.Param("id")
    var ticket models.Ticket

    if err := h.db.Preload("Solutions").First(&ticket, ticketID).Error; err != nil {
        c.JSON(http.StatusNotFound, gin.H{"error": "Ticket not found"})
        return
    }

    c.JSON(http.StatusOK, gin.H{"data": ticket})
}

// ListTickets returns all tickets with optional filtering
func (h *TicketHandler) ListTickets(c *gin.Context) {
    var tickets []models.Ticket
    query := h.db.Preload("Solutions")

    // Filter by due date
    dueDateFilter := c.Query("dueDate")
    if dueDateFilter != "" {
        switch dueDateFilter {
        case "today":
            query = query.Where("due_date >= ? AND due_date < ?",
                time.Now().Truncate(24*time.Hour),
                time.Now().Truncate(24*time.Hour).Add(24*time.Hour))
        case "week":
            query = query.Where("due_date >= ? AND due_date < ?",
                time.Now().Truncate(24*time.Hour),
                time.Now().Truncate(24*time.Hour).Add(7*24*time.Hour))
        case "overdue":
            query = query.Where("due_date < ? AND status != ?",
                time.Now(), models.TicketStatusResolved)
        case "no_due_date":
            query = query.Where("due_date IS NULL")
        }
    }

    // Order by due date if it's being filtered
    if dueDateFilter != "" && dueDateFilter != "no_due_date" {
        query = query.Order("due_date ASC")
    }

    if err := query.Find(&tickets).Error; err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch tickets"})
        return
    }

    c.JSON(http.StatusOK, gin.H{"data": tickets})
}

// GetTicketHistory returns the history of a specific ticket
func (h *TicketHandler) GetTicketHistory(c *gin.Context) {
    ticketID := c.Param("id")
    var history []models.TicketHistory

    if err := h.db.Where("ticket_id = ?", ticketID).Order("created_at desc").Find(&history).Error; err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch ticket history"})
        return
    }

    c.JSON(http.StatusOK, gin.H{"data": history})
}

// DeleteTicket soft deletes a ticket
func (h *TicketHandler) DeleteTicket(c *gin.Context) {
    ticketID := c.Param("id")
    var ticket models.Ticket

    if err := h.db.First(&ticket, ticketID).Error; err != nil {
        c.JSON(http.StatusNotFound, gin.H{"error": "Ticket not found"})
        return
    }

    if err := h.db.Delete(&ticket).Error; err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete ticket"})
        return
    }

    c.JSON(http.StatusOK, gin.H{"message": "Ticket deleted successfully"})
}

// GetTicketStats returns ticket statistics
func (h *TicketHandler) GetTicketStats(c *gin.Context) {
    var stats struct {
        Total      int64 `json:"total"`
        Open       int64 `json:"open"`
        InProgress int64 `json:"in_progress"`
        Resolved   int64 `json:"resolved"`
    }

    h.db.Model(&models.Ticket{}).Count(&stats.Total)
    h.db.Model(&models.Ticket{}).Where("status = ?", "open").Count(&stats.Open)
    h.db.Model(&models.Ticket{}).Where("status = ?", "in_progress").Count(&stats.InProgress)
    h.db.Model(&models.Ticket{}).Where("status = ?", "resolved").Count(&stats.Resolved)

    c.JSON(http.StatusOK, gin.H{"data": stats})
}

// ListSolutions returns all solutions
func (h *TicketHandler) ListSolutions(c *gin.Context) {
    var solutions []models.Solution
    category := c.Query("category")
    email := c.Query("email")

    query := h.db.Model(&models.Solution{})
    
    if category != "" {
        query = query.Where("category = ?", category)
    }

    // If email is provided, include information about solutions used by this email
    if email != "" {
        query = query.
            Select("solutions.*, CASE WHEN esh.email IS NOT NULL THEN true ELSE false END as previously_used").
            Joins("LEFT JOIN email_solutions_history esh ON solutions.id = esh.solution_id AND esh.email = ?", email)
    }

    if err := query.Find(&solutions).Error; err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch solutions"})
        return
    }

    c.JSON(http.StatusOK, gin.H{"data": solutions})
}