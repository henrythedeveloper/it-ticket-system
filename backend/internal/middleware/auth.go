package middleware

import (
"net/http"
"strings"

"github.com/gin-gonic/gin"
"github.com/golang-jwt/jwt/v5"
)

type AuthMiddleware struct {
jwtSecret string
}

func NewAuthMiddleware(jwtSecret string) *AuthMiddleware {
if jwtSecret == "" {
panic("JWT secret is required")
}
return &AuthMiddleware{jwtSecret: jwtSecret}
}

// AuthRequired is a middleware that validates JWT tokens
func (m *AuthMiddleware) AuthRequired() gin.HandlerFunc {
return func(c *gin.Context) {
authHeader := c.GetHeader("Authorization")
if authHeader == "" {
c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization header required"})
c.Abort()
return
}

// Check Bearer token format
bearerToken := strings.Split(authHeader, " ")
if len(bearerToken) != 2 || bearerToken[0] != "Bearer" {
c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid authorization format"})
c.Abort()
return
}

tokenString := bearerToken[1]
claims := jwt.MapClaims{}

// Parse and validate token
token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
return nil, jwt.ErrSignatureInvalid
}
return []byte(m.jwtSecret), nil
})

if err != nil {
c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
c.Abort()
return
}

if !token.Valid {
c.JSON(http.StatusUnauthorized, gin.H{"error": "Token is not valid"})
c.Abort()
return
}

// Get user info from claims
userID, ok := claims["user_id"].(float64)
if !ok {
c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID in token"})
c.Abort()
return
}

userRole, ok := claims["role"].(string)
if !ok {
c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user role in token"})
c.Abort()
return
}

// Set user info in context
c.Set("userID", int(userID))
c.Set("userRole", userRole)

c.Next()
}
}

// Optional returns a middleware that attempts to validate JWT but doesn't require it
func (m *AuthMiddleware) Optional() gin.HandlerFunc {
return func(c *gin.Context) {
authHeader := c.GetHeader("Authorization")
if authHeader == "" {
c.Next()
return
}

bearerToken := strings.Split(authHeader, " ")
if len(bearerToken) != 2 || bearerToken[0] != "Bearer" {
c.Next()
return
}

tokenString := bearerToken[1]
claims := jwt.MapClaims{}

token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
return nil, jwt.ErrSignatureInvalid
}
return []byte(m.jwtSecret), nil
})

if err != nil || !token.Valid {
c.Next()
return
}

if userID, ok := claims["user_id"].(float64); ok {
c.Set("userID", int(userID))
}
if userRole, ok := claims["role"].(string); ok {
c.Set("userRole", userRole)
}

c.Next()
}
}

// RequireRole returns a middleware that requires a specific role
func (m *AuthMiddleware) RequireRole(role string) gin.HandlerFunc {
return func(c *gin.Context) {
userRole, exists := c.Get("userRole")
if !exists {
c.JSON(http.StatusUnauthorized, gin.H{"error": "User role not found"})
c.Abort()
return
}

if userRole != role {
c.JSON(http.StatusForbidden, gin.H{"error": "Insufficient permissions"})
c.Abort()
return
}

c.Next()
}
}