package handlers

import (
"net/http"

"github.com/gin-gonic/gin"
"helpdesk/internal/auth"
)

type AuthHandler struct {
authService *auth.AuthService
}

func NewAuthHandler(authService *auth.AuthService) *AuthHandler {
return &AuthHandler{
authService: authService,
}
}

// LoginHandler handles user login
func (h *AuthHandler) Login(c *gin.Context) {
var input auth.LoginInput
if err := c.ShouldBindJSON(&input); err != nil {
c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
return
}

resp, err := h.authService.Login(input)
if err != nil {
if err == auth.ErrInvalidCredentials {
c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid email or password"})
return
}
c.JSON(http.StatusInternalServerError, gin.H{"error": "Login failed"})
return
}

c.JSON(http.StatusOK, resp)
}

// RegisterHandler handles user registration
func (h *AuthHandler) Register(c *gin.Context) {
var input auth.RegisterInput
if err := c.ShouldBindJSON(&input); err != nil {
c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
return
}

resp, err := h.authService.Register(input)
if err != nil {
if err == auth.ErrUserExists {
c.JSON(http.StatusConflict, gin.H{"error": "User already exists"})
return
}
c.JSON(http.StatusInternalServerError, gin.H{"error": "Registration failed"})
return
}

c.JSON(http.StatusCreated, resp)
}
