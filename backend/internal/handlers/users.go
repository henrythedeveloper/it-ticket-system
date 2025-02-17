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
authService *auth.AuthService
}

func NewUserHandler(db *gorm.DB, authService *auth.AuthService) *UserHandler {
return &UserHandler{
db:          db,
authService: authService,
}
}

func (h *UserHandler) ListUsers(c *gin.Context) {
var users []models.User
if err := h.db.Find(&users).Error; err != nil {
c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch users"})
return
}

// Remove passwords from response
for i := range users {
users[i].Password = ""
}

c.JSON(http.StatusOK, gin.H{"data": users})
}

func (h *UserHandler) GetUser(c *gin.Context) {
id, err := strconv.ParseUint(c.Param("id"), 10, 32)
if err != nil {
c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
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

// Remove password from response
user.Password = ""
c.JSON(http.StatusOK, user)
}

type UpdateUserInput struct {
Name     *string `json:"name,omitempty"`
Email    *string `json:"email,omitempty"`
Password *string `json:"password,omitempty"`
Role     *string `json:"role,omitempty" binding:"omitempty,oneof=admin staff"`
}

func (h *UserHandler) UpdateUser(c *gin.Context) {
id, err := strconv.ParseUint(c.Param("id"), 10, 32)
if err != nil {
c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
return
}

// Only admins can update other users
currentUserID := middleware.GetUserID(c)
if uint(id) != currentUserID {
role, exists := c.Get("userRole")
if !exists || role != "admin" {
c.JSON(http.StatusForbidden, gin.H{"error": "Permission denied"})
return
}
}

var input UpdateUserInput
if err := c.ShouldBindJSON(&input); err != nil {
c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
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

// Update fields if provided
if input.Name != nil {
user.Name = *input.Name
}
if input.Email != nil {
user.Email = *input.Email
}
if input.Password != nil {
hashedPassword, err := auth.HashPassword(*input.Password)
if err != nil {
c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
return
}
user.Password = hashedPassword
}
if input.Role != nil {
// Only admins can change roles
role, exists := c.Get("userRole")
if !exists || role != "admin" {
c.JSON(http.StatusForbidden, gin.H{"error": "Only admins can change roles"})
return
}
user.Role = *input.Role
}

if err := h.db.Save(&user).Error; err != nil {
c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update user"})
return
}

// Remove password from response
user.Password = ""
c.JSON(http.StatusOK, user)
}

func (h *UserHandler) DeleteUser(c *gin.Context) {
id, err := strconv.ParseUint(c.Param("id"), 10, 32)
if err != nil {
c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
return
}

// Only admins can delete users
role, exists := c.Get("userRole")
if !exists || role != "admin" {
c.JSON(http.StatusForbidden, gin.H{"error": "Only admins can delete users"})
return
}

if err := h.db.Delete(&models.User{}, id).Error; err != nil {
c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete user"})
return
}

c.JSON(http.StatusOK, gin.H{"message": "User deleted successfully"})
}