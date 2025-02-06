package handlers

import (
	"net/http"
	"strconv"
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

	ticket := &models.Ticket{
		Category:       req.Category,
		Description:    req.Description,
		SubmitterEmail: req.SubmitterEmail,
		Status:         models.TicketStatusOpen,
	}

	tx := h.db.Begin()
	if tx.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to start transaction"})
		return
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
		Notes:    "Ticket created",
	}

	if err := tx.Create(&history).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create history entry"})
		return
	}

	if err := tx.Commit().Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to commit transaction"})
		return
	}

	c.JSON(http.StatusCreated, ticket)
}

// ListTickets returns all tickets with optional filtering
func (h *TicketHandler) ListTickets(c *gin.Context) {
	var tickets []models.Ticket
	query := h.db.Order("created_at DESC")

	// Apply filters
	if status := c.Query("status"); status != "" {
		query = query.Where("status = ?", status)
	}

	if err := query.Find(&tickets).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch tickets"})
		return
	}

	// Ensure empty array if no tickets found
	if len(tickets) == 0 {
		c.JSON(http.StatusOK, gin.H{"data": []models.Ticket{}})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": tickets})
}

// GetTicket retrieves a specific ticket
func (h *TicketHandler) GetTicket(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ticket ID"})
		return
	}

	var ticket models.Ticket
	if err := h.db.First(&ticket, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Ticket not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch ticket"})
		return
	}

	c.JSON(http.StatusOK, ticket)
}

type UpdateTicketRequest struct {
	Status     *string `json:"status,omitempty"`
	AssignedTo *uint   `json:"assignedTo,omitempty"`
	Solution   *string `json:"solution,omitempty"`
}

// UpdateTicket handles ticket status updates and assignments
func (h *TicketHandler) UpdateTicket(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ticket ID"})
		return
	}

	var req UpdateTicketRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Start a transaction
	tx := h.db.Begin()
	if tx.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to start transaction"})
		return
	}

	var ticket models.Ticket
	if err := tx.First(&ticket, id).Error; err != nil {
		tx.Rollback()
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Ticket not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch ticket"})
		return
	}

	// Get user ID from context
	userID := c.GetUint("userID")

	// Update fields if provided
	if req.Status != nil {
		oldStatus := ticket.Status
		ticket.Status = *req.Status

		// Add history entry for status change
		history := models.TicketHistory{
			TicketID: uint(id),
			Action:   "status_change",
			UserID:   &userID,
			Notes:    "Status changed from " + oldStatus + " to " + *req.Status,
		}
		if err := tx.Create(&history).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create history entry"})
			return
		}

		// If status is resolved, update resolved fields
		if *req.Status == models.TicketStatusResolved {
			now := time.Now()
			ticket.ResolvedAt = &now
			ticket.ResolvedBy = &userID
		}
	}

	if req.AssignedTo != nil {
		// Verify user exists if assigning
		if *req.AssignedTo != 0 {
			var user models.User
			if err := tx.First(&user, req.AssignedTo).Error; err != nil {
				tx.Rollback()
				c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user assignment"})
				return
			}

			// Add history entry for assignment
			history := models.TicketHistory{
				TicketID: uint(id),
				Action:   "assigned",
				UserID:   &userID,
				Notes:    "Ticket assigned to " + user.Name,
			}
			if err := tx.Create(&history).Error; err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create history entry"})
				return
			}
		}
		ticket.AssignedTo = req.AssignedTo
	}

	if req.Solution != nil && ticket.Status == models.TicketStatusResolved {
		ticket.Solution = req.Solution
		// Add history entry for solution
		history := models.TicketHistory{
			TicketID: uint(id),
			Action:   "resolved",
			UserID:   &userID,
			Notes:    *req.Solution,
		}
		if err := tx.Create(&history).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create history entry"})
			return
		}
	}

	if err := tx.Save(&ticket).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update ticket"})
		return
	}

	if err := tx.Commit().Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to commit transaction"})
		return
	}

	c.JSON(http.StatusOK, ticket)
}

// GetTicketHistory returns the history for a specific ticket
func (h *TicketHandler) GetTicketHistory(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ticket ID"})
		return
	}

	var history []models.TicketHistory
	if err := h.db.Where("ticket_id = ?", id).Order("created_at DESC").Find(&history).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch ticket history"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": history})
}

// ListSolutions returns all solutions for a given category
func (h *TicketHandler) ListSolutions(c *gin.Context) {
	category := c.Query("category")

	var solutions []models.TicketSolution
	query := h.db.Order("created_at DESC")

	if category != "" {
		query = query.Where("category = ?", category)
	}

	if err := query.Find(&solutions).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch solutions"})
		return
	}

	// Ensure empty array if no solutions found
	if len(solutions) == 0 {
		c.JSON(http.StatusOK, gin.H{"data": []models.TicketSolution{}})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": solutions})
}

// DeleteTicket handles ticket deletion (soft delete)
func (h *TicketHandler) DeleteTicket(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ticket ID"})
		return
	}

	result := h.db.Delete(&models.Ticket{}, id)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete ticket"})
		return
	}

	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Ticket not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Ticket deleted successfully"})
}

// GetTicketStats returns ticket statistics
func (h *TicketHandler) GetTicketStats(c *gin.Context) {
	var stats struct {
		Total      int64 `json:"total"`
		Open       int64 `json:"open"`
		InProgress int64 `json:"inProgress"`
		Resolved   int64 `json:"resolved"`
	}

	h.db.Model(&models.Ticket{}).Count(&stats.Total)
	h.db.Model(&models.Ticket{}).Where("status = ?", models.TicketStatusOpen).Count(&stats.Open)
	h.db.Model(&models.Ticket{}).Where("status = ?", models.TicketStatusInProgress).Count(&stats.InProgress)
	h.db.Model(&models.Ticket{}).Where("status = ?", models.TicketStatusResolved).Count(&stats.Resolved)

	c.JSON(http.StatusOK, stats)
}