package task

import (
	"github.com/henrythedeveloper/bus-it-ticket/internal/db"
	"github.com/henrythedeveloper/bus-it-ticket/internal/email"
	"github.com/labstack/echo/v4"
)

// Handler handles task-related requests
type Handler struct {
	db           *db.DB
	emailService email.Service
}

// NewHandler creates a new task handler
func NewHandler(db *db.DB, emailService email.Service) *Handler {
	return &Handler{
		db:           db,
		emailService: emailService,
	}
}

// RegisterRoutes registers the task handler routes
func RegisterRoutes(g *echo.Group, h *Handler) {
	g.GET("", h.GetAllTasks)
	g.POST("", h.CreateTask)
	g.GET("/:id", h.GetTaskByID)
	g.PUT("/:id", h.UpdateTask)
	g.DELETE("/:id", h.DeleteTask)
	g.PUT("/:id/status", h.UpdateTaskStatus)
	g.GET("/count", h.GetTaskCounts)
}
