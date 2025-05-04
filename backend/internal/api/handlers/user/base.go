// backend/internal/api/handlers/user/base.go
// ==========================================================================
// Base setup for the user handler package. Defines the Handler struct
// and registers routes for user management and authentication endpoints.
// **REVISED**: Added registration and password reset routes (public).
//              Moved login to be registered here for consistency.
// ==========================================================================

package user

import (
	"log/slog" // Use structured logging

	"github.com/henrythedeveloper/it-ticket-system/internal/auth" // Corrected import path
	"github.com/henrythedeveloper/it-ticket-system/internal/config" // Import config
	"github.com/henrythedeveloper/it-ticket-system/internal/db"   // Corrected import path
	"github.com/henrythedeveloper/it-ticket-system/internal/email" // Import email service
	"github.com/labstack/echo/v4"
)

// --- Handler Struct ---

// Handler holds dependencies for user-related request handlers.
type Handler struct {
	db           *db.DB        // Database connection pool
	authService  auth.Service  // Service for authentication logic (hashing, tokens)
	emailService email.Service // Service for sending emails (needed for registration/reset)
	config       *config.Config // Access to config (e.g., for PortalBaseURL)
}

// --- Constructor ---

// NewHandler creates a new instance of the user Handler.
// It initializes the handler with necessary service dependencies.
//
// Parameters:
//   - db: The database connection pool (*db.DB).
//   - authService: The authentication service (auth.Service).
//   - emailService: The email service (email.Service).
//   - cfg: The application configuration (*config.Config).
//
// Returns:
//   - *Handler: A pointer to the newly created Handler.
func NewHandler(db *db.DB, authService auth.Service, emailService email.Service, cfg *config.Config) *Handler {
	return &Handler{
		db:           db,
		authService:  authService,
		emailService: emailService, // Add email service
		config:       cfg,          // Add config
	}
}

// --- Route Registration ---

// RegisterAuthRoutes registers public authentication-related routes.
// These routes should NOT have JWT middleware applied.
//
// Parameters:
//   - g: The echo group (e.g., /api/auth) to register routes onto (*echo.Group).
//   - h: The user Handler instance (*Handler).
func RegisterAuthRoutes(g *echo.Group, h *Handler) {
	slog.Debug("Registering public authentication routes")
	g.POST("/login", h.Login)                   // POST /api/auth/login
	g.POST("/register", h.RegisterUser)         // POST /api/auth/register
	g.POST("/forgot-password", h.RequestPasswordReset) // POST /api/auth/forgot-password
	g.POST("/reset-password", h.ResetPassword)   // POST /api/auth/reset-password
	slog.Debug("Finished registering public authentication routes")
}

// RegisterUserManagementRoutes registers routes for managing user resources.
// These routes typically require authentication and potentially admin privileges.
//
// Parameters:
//   - g: The echo group (e.g., /api/users) which should have JWT middleware applied.
//   - h: The user Handler instance (*Handler).
//   - adminMiddleware: Middleware to restrict access to Admins only.
func RegisterUserManagementRoutes(g *echo.Group, h *Handler, adminMiddleware echo.MiddlewareFunc) {
	slog.Debug("Registering user management routes")

	// Get current user's profile (already authenticated via group middleware)
	g.GET("/me", h.GetCurrentUser) // GET /api/users/me

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

	slog.Debug("Finished registering user management routes")
}

