package user

import (
	"github.com/henrythedeveloper/bus-it-ticket/internal/auth"
	"github.com/henrythedeveloper/bus-it-ticket/internal/db"
	"github.com/labstack/echo/v4"
)

// Handler handles user-related requests
type Handler struct {
	db          *db.DB
	authService auth.Service
}

// NewHandler creates a new user handler
func NewHandler(db *db.DB, authService auth.Service) *Handler {
	return &Handler{
		db:          db,
		authService: authService,
	}
}

// RegisterRoutes registers the user handler routes
func RegisterRoutes(g *echo.Group, h *Handler, adminMiddleware echo.MiddlewareFunc) {
	g.GET("", h.GetAllUsers)
	g.GET("/:id", h.GetUserByID)
	g.POST("", h.CreateUser, adminMiddleware) // Only admins can create users
	g.PUT("/:id", h.UpdateUser)
	g.DELETE("/:id", h.DeleteUser, adminMiddleware) // Only admins can delete users
	g.GET("/me", h.GetCurrentUser)
}

