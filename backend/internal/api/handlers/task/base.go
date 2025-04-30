// backend/internal/api/handlers/task/base.go
// ==========================================================================
// Base setup for the task handler package. Defines the Handler struct
// and registers routes for task-related API endpoints.
// **REVISED**: Fixed validator import/initialization and route path logging.
// **REVISED AGAIN**: Corrected route path logging to avoid using unexported g.prefix.
// ==========================================================================

package task

import (
	"log/slog" // Use structured logging
	// "strings" // No longer needed for path joining in log

	"github.com/go-playground/validator/v10" // Correct import path
	"github.com/henrythedeveloper/it-ticket-system/internal/db"
	"github.com/henrythedeveloper/it-ticket-system/internal/email"
	// "github.com/henrythedeveloper/it-ticket-system/internal/file"
	"github.com/labstack/echo/v4"
)

// --- Handler Struct ---

// Handler holds dependencies for task-related request handlers.
type Handler struct {
	db           *db.DB
	emailService email.Service
	// fileService  file.Service
	validate     *validator.Validate // Add validator instance
}

// --- Constructor ---

// NewHandler creates a new instance of the task Handler.
func NewHandler(db *db.DB, emailService email.Service /*, fileService file.Service */) *Handler {
	validate := validator.New(validator.WithRequiredStructEnabled()) // Initialize validator correctly
	return &Handler{
		db:           db,
		emailService: emailService,
		// fileService:  fileService,
		validate:     validate, // Assign the initialized validator
	}
}

// --- Route Registration ---

// RegisterRoutes defines and registers all API routes managed by this task handler.
// Assumes JWT middleware is applied to the group 'g' by the caller.
func RegisterRoutes(g *echo.Group, h *Handler) {
	slog.Debug("Registering task routes")

	// --- Route Definitions ---
	routes := []struct {
		Method string
		Path   string
		Func   echo.HandlerFunc
	}{
		{"GET", "", h.GetAllTasks},
		{"POST", "", h.CreateTask},
		{"GET", "/:id", h.GetTaskByID},
		{"PUT", "/:id", h.UpdateTask},
		// {"GET", "/counts", h.GetTaskCounts}, // TODO: Implement
		// {"DELETE", "/:id", h.DeleteTask}, // TODO: Implement
		// {"PUT", "/:id/status", h.UpdateTaskStatus}, // TODO: Implement
		// {"POST", "/:id/updates", h.AddTaskUpdate}, // TODO: Implement
	}

	// --- Register Routes with Echo Group ---
	for _, route := range routes {
		// Log the path relative to the group being registered
		logPath := route.Path
		if logPath == "" {
			logPath = "/" // Represent root of the group as "/" for clarity
		}

		switch route.Method {
		case "POST": g.POST(route.Path, route.Func)
		case "GET": g.GET(route.Path, route.Func)
		case "PUT": g.PUT(route.Path, route.Func)
		case "DELETE": g.DELETE(route.Path, route.Func)
		}
		// Log the method and the path *relative* to the group 'g'
		slog.Debug("Registered task route", "method", route.Method, "path", logPath)
	}

	slog.Debug("Finished registering task routes")
}
