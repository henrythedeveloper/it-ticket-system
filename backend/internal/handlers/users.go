package handlers

import (
"net/http"
"strconv"

"github.com/gin-gonic/gin"
"gorm.io/gorm"
"helpdesk/internal/auth"
"helpdesk/internal/middleware"
"helpdesk/internal/models"
)

type UserHandler struct {
db          *gorm.DB
authService *auth.Service
}

func NewUserHandler(db *gorm.DB, authService *auth.Service) *UserHandler {
return &UserHandler{
db:          db,
authService: authService,
}
}

// ListUsers returns all users (admin only)
func (h *UserHandler) ListUsers(c *gin.Context) {
var users []models.User
if err := h.db.Order("created_at DESC").Find(&users).Error; err != nil {
c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch users"})
return
}

c.JSON(http.StatusOK, users)
}

type UpdateUserRequest struct {
Name string `json:"name,omitempty"`
Role string `json:"role,omitempty" binding:"omitempty,oneof=admin staff"`
}

// UpdateUser handles user updates (admin only)
func (h *UserHandler) UpdateUser(c *gin.Context) {
id, err := strconv.ParseUint(c.Param("id"), 10, 32)
if err != nil {
c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
return
}

// Prevent self-modification through this endpoint
currentUserID := middleware.GetUserID(c)
if uint(id) == currentUserID {
c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot modify own user through this endpoint"})
return
}

var user models.User
if err := h.db.First(&user, id).Error; err != nil {
if err == gorm.ErrRecordNotFound {
c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
return
}
c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch user"})
return
}

var req UpdateUserRequest
if err := c.ShouldBindJSON(&req); err != nil {
c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
return
}

// Update fields if provided
if req.Name != "" {
user.Name = req.Name
}
if req.Role != "" {
user.Role = req.Role
}

if err := h.db.Save(&user).Error; err != nil {
c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update user"})
return
}

c.JSON(http.StatusOK, user)
}

// DeleteUser handles user deletion (admin only)
func (h *UserHandler) DeleteUser(c *gin.Context) {
id, err := strconv.ParseUint(c.Param("id"), 10, 32)
if err != nil {
c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
return
}

// Prevent self-deletion
currentUserID := middleware.GetUserID(c)
if uint(id) == currentUserID {
c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot delete own user"})
return
}

// First check if user exists
var user models.User
if err := h.db.First(&user, id).Error; err != nil {
if err == gorm.ErrRecordNotFound {
c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
return
}
c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch user"})
return
}

// Check if user has any assigned tickets
var ticketCount int64
if err := h.db.Model(&models.Ticket{}).Where("assigned_to = ?", id).Count(&ticketCount).Error; err != nil {
c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to check user's tickets"})
return
}

if ticketCount > 0 {
c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot delete user with assigned tickets"})
return
}

// Check if user has any assigned tasks
var taskCount int64
if err := h.db.Model(&models.Task{}).Where("assigned_to = ?", id).Count(&taskCount).Error; err != nil {
c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to check user's tasks"})
return
}

if taskCount > 0 {
c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot delete user with assigned tasks"})
return
}

// Perform the deletion
if err := h.db.Delete(&user).Error; err != nil {
c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete user"})
return
}

c.JSON(http.StatusOK, gin.H{"message": "User deleted successfully"})
}

// GetUserProfile returns the current user's profile
func (h *UserHandler) GetUserProfile(c *gin.Context) {
userID := middleware.GetUserID(c)

var user models.User
if err := h.db.First(&user, userID).Error; err != nil {
c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch user profile"})
return
}

// Get user's assigned tickets count
var openTicketsCount int64
h.db.Model(&models.Ticket{}).
Where("assigned_to = ? AND status != ?", userID, models.TicketStatusResolved).
Count(&openTicketsCount)

// Get user's assigned tasks count
var pendingTasksCount int64
h.db.Model(&models.Task{}).
Where("assigned_to = ? AND status != ?", userID, models.TaskStatusDone).
Count(&pendingTasksCount)

response := gin.H{
"user":            user,
"openTickets":     openTicketsCount,
"pendingTasks":    pendingTasksCount,
}

c.JSON(http.StatusOK, response)
}

// GetUserStats returns statistics about users (admin only)
func (h *UserHandler) GetUserStats(c *gin.Context) {
var stats struct {
Total     int64 `json:"total"`
Admins    int64 `json:"admins"`
Staff     int64 `json:"staff"`
ActiveNow int64 `json:"activeNow"` // Users with assigned open tickets or tasks
}

h.db.Model(&models.User{}).Count(&stats.Total)
h.db.Model(&models.User{}).Where("role = ?", models.UserRoleAdmin).Count(&stats.Admins)
h.db.Model(&models.User{}).Where("role = ?", models.UserRoleStaff).Count(&stats.Staff)

// Count users with active tickets or tasks
h.db.Model(&models.User{}).
Where("id IN (SELECT DISTINCT assigned_to FROM tickets WHERE status != ?) OR "+
"id IN (SELECT DISTINCT assigned_to FROM tasks WHERE status != ?)",
models.TicketStatusResolved, models.TaskStatusDone).
Count(&stats.ActiveNow)

c.JSON(http.StatusOK, stats)
}