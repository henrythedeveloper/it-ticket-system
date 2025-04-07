package auth

import (
	"net/http"
	"strings"

	"github.com/henrythedeveloper/bus-it-ticket/internal/auth"
	"github.com/henrythedeveloper/bus-it-ticket/internal/models"
	"github.com/labstack/echo/v4"
)

// JWTMiddleware creates a middleware that validates JWT tokens
func JWTMiddleware(authService auth.Service) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			// Get Authorization header
			authHeader := c.Request().Header.Get("Authorization")
			if authHeader == "" {
				return echo.NewHTTPError(http.StatusUnauthorized, "missing authorization header")
			}

			// Check if it's a bearer token
			parts := strings.Split(authHeader, " ")
			if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
				return echo.NewHTTPError(http.StatusUnauthorized, "invalid authorization header format")
			}

			// Extract token
			tokenString := parts[1]

			// Validate token
			claims, err := authService.ValidateToken(tokenString)
			if err != nil {
				return echo.NewHTTPError(http.StatusUnauthorized, "invalid or expired token")
			}

			// Set user claims in context
			c.Set("user_id", claims.UserID)
			c.Set("email", claims.Email)
			c.Set("role", claims.Role)

			return next(c)
		}
	}
}

// AdminMiddleware creates a middleware that ensures the user has admin role
func AdminMiddleware() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			// Get user role from context (set by JWTMiddleware)
			role, ok := c.Get("role").(models.UserRole)
			if !ok {
				return echo.NewHTTPError(http.StatusUnauthorized, "role not found in token")
			}

			// Check if user is an admin
			if role != models.RoleAdmin {
				return echo.NewHTTPError(http.StatusForbidden, "admin role required")
			}

			return next(c)
		}
	}
}

// GetUserIDFromContext extracts the user ID from the context
func GetUserIDFromContext(c echo.Context) (string, error) {
	userID, ok := c.Get("user_id").(string)
	if !ok || userID == "" {
		return "", echo.NewHTTPError(http.StatusUnauthorized, "user ID not found in token")
	}
	return userID, nil
}

// GetUserRoleFromContext extracts the user role from the context
func GetUserRoleFromContext(c echo.Context) (models.UserRole, error) {
	role, ok := c.Get("role").(models.UserRole)
	if !ok {
		return "", echo.NewHTTPError(http.StatusUnauthorized, "role not found in token")
	}
	return role, nil
}
