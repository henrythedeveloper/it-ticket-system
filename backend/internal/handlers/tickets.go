package handlers

import (
"net/http"
"strconv"

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

if err := h.db.Create(ticket).Error; err != nil {
c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create ticket"})
return
}

// TODO: Send email notification to submitter

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

c.JSON(http.StatusOK, tickets)
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

var ticket models.Ticket
if err := h.db.First(&ticket, id).Error; err != nil {
if err == gorm.ErrRecordNotFound {
c.JSON(http.StatusNotFound, gin.H{"error": "Ticket not found"})
return
}
c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch ticket"})
return
}

// Update fields if provided
if req.Status != nil {
ticket.Status = *req.Status
}

if req.AssignedTo != nil {
// Verify user exists if assigning
if *req.AssignedTo != 0 {
var user models.User
if err := h.db.First(&user, req.AssignedTo).Error; err != nil {
c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user assignment"})
return
}
}
ticket.AssignedTo = req.AssignedTo
}

if err := h.db.Save(&ticket).Error; err != nil {
c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update ticket"})
return
}

// TODO: Send email notification if status changed

c.JSON(http.StatusOK, ticket)
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
Total     int64 `json:"total"`
Open      int64 `json:"open"`
InProgress int64 `json:"inProgress"`
Resolved  int64 `json:"resolved"`
}

h.db.Model(&models.Ticket{}).Count(&stats.Total)
h.db.Model(&models.Ticket{}).Where("status = ?", models.TicketStatusOpen).Count(&stats.Open)
h.db.Model(&models.Ticket{}).Where("status = ?", models.TicketStatusInProgress).Count(&stats.InProgress)
h.db.Model(&models.Ticket{}).Where("status = ?", models.TicketStatusResolved).Count(&stats.Resolved)

c.JSON(http.StatusOK, stats)
}