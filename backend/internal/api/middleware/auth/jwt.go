// backend/internal/api/middleware/auth/jwt.go
// ==========================================================================
// Echo middleware functions for handling JWT authentication and authorization.
// Includes middleware for validating tokens and checking for Admin role.
// Also provides helper functions to extract user information from the context.
// ==========================================================================

package auth

import (
	"fmt"
	"log/slog"
	"net/http"
	"strings"

	"github.com/henrythedeveloper/it-ticket-system/internal/auth"   // Authentication service (for validation)
	"github.com/henrythedeveloper/it-ticket-system/internal/models" // Data models (for UserRole)
	"github.com/labstack/echo/v4"
)

const (
	// contextKeyUserID is the key used to store the user ID in the Echo context.
	contextKeyUserID = "user_id"
	// contextKeyEmail is the key used to store the user email in the Echo context.
	contextKeyEmail = "email"
	// contextKeyRole is the key used to store the user role in the Echo context.
	contextKeyRole = "role"
)

// --- Middleware ---

// JWTMiddleware creates an Echo middleware function that validates incoming JWT tokens.
// It extracts the token from the "Authorization: Bearer <token>" header, validates it
// using the provided auth.Service, and stores the user's claims (ID, email, role)
// in the Echo context for subsequent handlers to use.
//
// Parameters:
//   - authService: An implementation of the auth.Service interface used for token validation.
//
// Returns:
//   - echo.MiddlewareFunc: The middleware function.
func JWTMiddleware(authService auth.Service) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			ctx := c.Request().Context()
			// Use a logger specific to this middleware instance
			logger := slog.With("middleware", "JWTMiddleware")

			// 1. Get Authorization Header
			authHeader := c.Request().Header.Get(echo.HeaderAuthorization)
			if authHeader == "" {
				logger.WarnContext(ctx, "Missing Authorization header")
				return echo.NewHTTPError(http.StatusUnauthorized, "Missing or empty Authorization header.")
			}

			// 2. Validate Format (Bearer <token>)
			parts := strings.Split(authHeader, " ")
			if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") { // Case-insensitive check for "Bearer"
				logger.WarnContext(ctx, "Invalid Authorization header format")
				return echo.NewHTTPError(http.StatusUnauthorized, "Invalid Authorization header format. Expected 'Bearer <token>'.")
			}
			tokenString := parts[1]

			// 3. Validate Token using AuthService
			claims, err := authService.ValidateToken(tokenString)
			if err != nil {
				logger.WarnContext(ctx, "Token validation failed", "error", err)
				// Provide a slightly more specific error message based on common JWT errors
				errMsg := "Invalid or expired token."
				if strings.Contains(err.Error(), "expired") {
					errMsg = "Token has expired."
				} else if strings.Contains(err.Error(), "invalid") {
					errMsg = "Invalid token signature or format."
				}
				return echo.NewHTTPError(http.StatusUnauthorized, errMsg)
			}

			// 4. Store Claims in Context
			// Use constants for context keys for consistency
			c.Set(contextKeyUserID, claims.UserID)
			c.Set(contextKeyEmail, claims.Email)
			c.Set(contextKeyRole, claims.Role)

			logger.DebugContext(ctx, "JWT validated successfully", "userID", claims.UserID, "role", claims.Role)

			// 5. Proceed to the next handler
			return next(c)
		}
	}
}

// AdminMiddleware creates an Echo middleware function that checks if the user
// authenticated by the preceding JWTMiddleware has the 'Admin' role.
// It should be placed *after* JWTMiddleware in the middleware chain.
//
// Returns:
//   - echo.MiddlewareFunc: The middleware function.
func AdminMiddleware() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			ctx := c.Request().Context()
			logger := slog.With("middleware", "AdminMiddleware")

			// 1. Get Role from Context (set by JWTMiddleware)
			roleValue := c.Get(contextKeyRole)
			if roleValue == nil {
				// This indicates JWTMiddleware might not have run or failed to set the role
				logger.ErrorContext(ctx, "Role not found in context. Ensure JWTMiddleware runs first.")
				return echo.NewHTTPError(http.StatusInternalServerError, "Authentication context missing.")
			}

			// 2. Assert Role Type
			role, ok := roleValue.(models.UserRole)
			if !ok {
				// This indicates an unexpected type was stored in the context
				logger.ErrorContext(ctx, "Invalid role type found in context", "type", fmt.Sprintf("%T", roleValue))
				return echo.NewHTTPError(http.StatusInternalServerError, "Invalid authentication context.")
			}

			// 3. Check if Role is Admin
			if role != models.RoleAdmin {
				userID := c.Get(contextKeyUserID) // Get user ID for logging context
				logger.WarnContext(ctx, "Admin access denied", "userID", userID, "userRole", role)
				return echo.NewHTTPError(http.StatusForbidden, "Access denied: Administrator role required.")
			}

			// 4. Proceed if Admin
			logger.DebugContext(ctx, "Admin access granted", "userID", c.Get(contextKeyUserID))
			return next(c)
		}
	}
}

// --- Context Helper Functions ---

// GetUserIDFromContext safely extracts the user ID (string) stored in the Echo context
// by the JWTMiddleware.
//
// Parameters:
//   - c: The echo context.
//
// Returns:
//   - string: The user ID if found and valid.
//   - error: An HTTP error (typically 401 Unauthorized) if the ID is missing or invalid.
func GetUserIDFromContext(c echo.Context) (string, error) {
	userIDValue := c.Get(contextKeyUserID)
	if userIDValue == nil {
		slog.Warn("User ID not found in context during GetUserIDFromContext call")
		return "", echo.NewHTTPError(http.StatusUnauthorized, "Authentication context error: User ID missing.")
	}

	userID, ok := userIDValue.(string)
	if !ok || userID == "" {
		slog.Error("Invalid user ID type or empty value in context", "type", fmt.Sprintf("%T", userIDValue))
		return "", echo.NewHTTPError(http.StatusUnauthorized, "Authentication context error: Invalid User ID.")
	}

	return userID, nil
}

// GetUserRoleFromContext safely extracts the user role (models.UserRole) stored in the Echo context
// by the JWTMiddleware.
//
// Parameters:
//   - c: The echo context.
//
// Returns:
//   - models.UserRole: The user role if found and valid.
//   - error: An HTTP error (typically 401 Unauthorized) if the role is missing or invalid.
func GetUserRoleFromContext(c echo.Context) (models.UserRole, error) {
	roleValue := c.Get(contextKeyRole)
	if roleValue == nil {
		slog.Warn("User role not found in context during GetUserRoleFromContext call")
		return "", echo.NewHTTPError(http.StatusUnauthorized, "Authentication context error: User role missing.")
	}

	role, ok := roleValue.(models.UserRole)
	if !ok {
		slog.Error("Invalid user role type in context", "type", fmt.Sprintf("%T", roleValue))
		return "", echo.NewHTTPError(http.StatusUnauthorized, "Authentication context error: Invalid User Role.")
	}

	// Optional: Validate if the role is one of the expected values (Admin, Staff, etc.)
	// switch role {
	// case models.RoleAdmin, models.RoleStaff, models.RoleUser:
	//     return role, nil
	// default:
	//     slog.Error("Unknown user role value found in context", "role", role)
	//     return "", echo.NewHTTPError(http.StatusUnauthorized, "Authentication context error: Unknown User Role.")
	// }

	return role, nil
}

// LogoutUser is a placeholder/example helper to potentially clear auth context if needed,
// although usually logout is handled by clearing client-side tokens and maybe backend session state.
func LogoutUser(c echo.Context) {
	// In a stateless JWT setup, there's usually nothing server-side to clear in the context itself.
	// The client is responsible for discarding the token.
	// If using server-side sessions alongside JWT, you'd clear the session here.
	slog.Debug("LogoutUser helper called (typically no server-side context action for stateless JWT)")
	// Example: c.Set(contextKeyUserID, nil), etc. - but usually not necessary.
}
