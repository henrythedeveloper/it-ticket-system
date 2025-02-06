package handlers

import (
    "net/http"
    "time"

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
    Category       string `json:"category" binding:"required"`
    Description    string `json:"description" binding:"required"`
    SubmitterEmail string `json:"submitterEmail" binding:"required,email"`
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

    ticket := &models.Ticket{
        TicketNumber:   ticketNumber,
        Category:       req.Category,
        Description:    req.Description,
        SubmitterEmail: req.SubmitterEmail,
        Status:         models.TicketStatusOpen,
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

    if err := tx.Commit().Error; err != nil {
        tx.Rollback()
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to commit transaction"})
        return
    }

    c.JSON(http.StatusCreated, gin.H{
        "message": "Ticket created successfully",
        "ticket":  ticket,
    })
}

// UpdateTicket handles ticket updates
func (h *TicketHandler) UpdateTicket(c *gin.Context) {
    var req struct {
        Status     string `json:"status"`
        AssignedTo *uint  `json:"assignedTo"`
        Solution   *string `json:"solution"`
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

    if err := h.db.First(&ticket, ticketID).Error; err != nil {
        c.JSON(http.StatusNotFound, gin.H{"error": "Ticket not found"})
        return
    }

    c.JSON(http.StatusOK, gin.H{"data": ticket})
}

// ListTickets returns all tickets
func (h *TicketHandler) ListTickets(c *gin.Context) {
    var tickets []models.Ticket
    if err := h.db.Find(&tickets).Error; err != nil {
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
        Total     int64 `json:"total"`
        Open      int64 `json:"open"`
        InProgress int64 `json:"in_progress"`
        Resolved  int64 `json:"resolved"`
    }

    h.db.Model(&models.Ticket{}).Count(&stats.Total)
    h.db.Model(&models.Ticket{}).Where("status = ?", "open").Count(&stats.Open)
    h.db.Model(&models.Ticket{}).Where("status = ?", "in_progress").Count(&stats.InProgress)
    h.db.Model(&models.Ticket{}).Where("status = ?", "resolved").Count(&stats.Resolved)

    c.JSON(http.StatusOK, gin.H{"data": stats})
}

// ListSolutions returns all ticket solutions
func (h *TicketHandler) ListSolutions(c *gin.Context) {
    var solutions []models.TicketSolution
    if err := h.db.Find(&solutions).Error; err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch solutions"})
        return
    }

    c.JSON(http.StatusOK, gin.H{"data": solutions})
}