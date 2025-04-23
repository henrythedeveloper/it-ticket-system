// backend/internal/api/handlers/user/base.go
// ==========================================================================
// Base setup for the user handler package. Defines the Handler struct
// and registers routes for user management and authentication endpoints.
// ==========================================================================

package user

import (
	"log/slog" // Use structured logging

	"github.com/henrythedeveloper/it-ticket-system/internal/auth" // Corrected import path
	"github.com/henrythedeveloper/it-ticket-system/internal/db"   // Corrected import path
	"github.com/labstack/echo/v4"
)

// --- Handler Struct ---

// Handler holds dependencies for user-related request handlers.
type Handler struct {
	db          *db.DB       // Database connection pool
	authService auth.Service // Service for authentication logic (hashing, tokens)
}

// --- Constructor ---

// NewHandler creates a new instance of the user Handler.
// It initializes the handler with necessary service dependencies.
//
// Parameters:
//   - db: The database connection pool (*db.DB).
//   - authService: The authentication service (auth.Service).
//
// Returns:
//   - *Handler: A pointer to the newly created Handler.
func NewHandler(db *db.DB, authService auth.Service) *Handler {
	return &Handler{
		db:          db,
		authService: authService,
	}
}

// --- Route Registration ---

// RegisterRoutes defines and registers all API routes managed by this user handler.
// It maps HTTP methods and paths to specific handler functions and applies necessary middleware.
//
// Parameters:
//   - g: The echo group to register routes onto (*echo.Group). This group might already
//     have authentication middleware applied (e.g., for /api/users).
//   - h: The user Handler instance containing the handler functions (*Handler).
//   - adminMiddleware: The middleware function to restrict access to Admins only.
//   - authMiddleware: The middleware function to ensure user is authenticated (applied by caller).
func RegisterRoutes(g *echo.Group, h *Handler, adminMiddleware echo.MiddlewareFunc) {
	// Log route registration at Debug level for clarity
	slog.Debug("Registering user routes")

	// --- Public Auth Routes (Typically registered outside the main '/users' group) ---
	// Example: If login is under /api/auth/login, it's registered in server.go
	// g.POST("/auth/login", h.Login) // This line assumes login is NOT under /api/users

	// --- Authenticated User Routes (Assume 'g' is already protected by JWT middleware) ---

	// Get current user's profile
	g.GET("/me", h.GetCurrentUser) // GET /api/users/me (or /api/auth/profile)

	// Get all users (Admin only)
	g.GET("", h.GetAllUsers, adminMiddleware) // GET /api/users

	// Get specific user by ID (Admin or self - handled within handler)
	g.GET("/:id", h.GetUserByID) // GET /api/users/{id}

	// Create a new user (Admin only)
	g.POST("", h.CreateUser, adminMiddleware) // POST /api/users

	// Update a user (Admin or self - handled within handler)
	g.PUT("/:id", h.UpdateUser) // PUT /api/users/{id}

	// Delete a user (Admin only)
	g.DELETE("/:id", h.DeleteUser, adminMiddleware) // DELETE /api/users/{id}

	// --- Log Registered Routes within this Group ---
	// Note: Logging individual routes as they are registered above is usually sufficient.
	// The block below attempting to log all routes from the group is removed
	// as g.Echo() and g.Prefix are not accessible.
	/*
		routes := g.Echo().Routes() // This line causes: g.Echo undefined
		for _, r := range routes {
			// Only log routes that start with the current group's prefix to avoid duplication
			if strings.HasPrefix(r.Path, g.Prefix) { // This line causes: g.Prefix undefined
				slog.Debug("Registered user route", "method", r.Method, "path", r.Path)
			}
		}
	*/

	slog.Debug("Finished registering user routes")
}
