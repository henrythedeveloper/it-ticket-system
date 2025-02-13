package auth

import (
"database/sql"
"net/http"
"os"
"time"

"github.com/gin-gonic/gin"
"github.com/golang-jwt/jwt/v5"
"golang.org/x/crypto/bcrypt"
)

type LoginRequest struct {
Email    string `json:"email" binding:"required"`
Password string `json:"password" binding:"required"`
}

type RegisterRequest struct {
Name     string `json:"name" binding:"required"`
Email    string `json:"email" binding:"required"`
Password string `json:"password" binding:"required"`
}

func LoginHandler(db *sql.DB) gin.HandlerFunc {
return func(c *gin.Context) {
var req LoginRequest
if err := c.ShouldBindJSON(&req); err != nil {
c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
return
}

var user struct {
ID       int
Password string
Role     string
}

err := db.QueryRow(`
SELECT id, password, role
FROM users
WHERE email = $1 AND deleted_at IS NULL
`, req.Email).Scan(&user.ID, &user.Password, &user.Role)

if err != nil {
c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
return
}

// Compare password with hash
if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)); err != nil {
c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
return
}

// Get JWT secret from environment
jwtSecret := os.Getenv("JWT_SECRET")
if jwtSecret == "" {
c.JSON(http.StatusInternalServerError, gin.H{"error": "JWT secret not configured"})
return
}

// Create token
token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
"user_id": user.ID,
"role":    user.Role,
"exp":     time.Now().Add(24 * time.Hour).Unix(),
})

// Sign and get the complete encoded token as a string
tokenString, err := token.SignedString([]byte(jwtSecret))
if err != nil {
c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create token"})
return
}

c.JSON(http.StatusOK, gin.H{
"token": tokenString,
"user": gin.H{
"id":   user.ID,
"role": user.Role,
},
})
}
}

func RegisterHandler(db *sql.DB) gin.HandlerFunc {
return func(c *gin.Context) {
var req RegisterRequest
if err := c.ShouldBindJSON(&req); err != nil {
c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
return
}

// Check if email already exists
var exists bool
err := db.QueryRow("SELECT EXISTS(SELECT 1 FROM users WHERE email = $1)", req.Email).Scan(&exists)
if err != nil {
c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
return
}
if exists {
c.JSON(http.StatusConflict, gin.H{"error": "Email already exists"})
return
}

// Hash password
hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
if err != nil {
c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
return
}

// Insert new user
var userID int
err = db.QueryRow(`
INSERT INTO users (name, email, password, role, created_at, updated_at)
VALUES ($1, $2, $3, 'user', NOW(), NOW())
RETURNING id
`, req.Name, req.Email, string(hashedPassword)).Scan(&userID)

if err != nil {
c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create user"})
return
}

c.JSON(http.StatusCreated, gin.H{
"message": "User registered successfully",
"id":      userID,
})
}
}
