// backend/internal/api/handlers/task/base.go
// ==========================================================================
// Base setup for the task handler package. Defines the Handler struct
// and registers routes for task-related API endpoints.
// ==========================================================================

package task

import (
	"log/slog" // Use structured logging

	"github.com/henrythedeveloper/it-ticket-system/internal/db"    // Corrected import path
	"github.com/henrythedeveloper/it-ticket-system/internal/email" // Corrected import path
	"github.com/labstack/echo/v4"
)

// --- Handler Struct ---

// Handler holds dependencies for task-related request handlers.
type Handler struct {
	db           *db.DB        // Database connection pool
	emailService email.Service // Service for sending emails
	// Note: fileService might be needed if tasks have attachments in the future
}

// --- Constructor ---

// NewHandler creates a new instance of the task Handler.
// It initializes the handler with necessary service dependencies.
//
// Parameters:
//   - db: The database connection pool (*db.DB).
//   - emailService: The email sending service (email.Service).
//
// Returns:
//   - *Handler: A pointer to the newly created Handler.
func NewHandler(db *db.DB, emailService email.Service) *Handler {
	return &Handler{
		db:           db,
		emailService: emailService,
	}
}

// --- Route Registration ---

// RegisterRoutes defines and registers all API routes managed by this task handler.
// It maps HTTP methods and paths to specific handler functions.
// Middleware (like authentication) is applied at the group level in server.go.
//
// Parameters:
//   - g: The echo group to register routes onto (*echo.Group).
//   - h: The task Handler instance containing the handler functions (*Handler).
func RegisterRoutes(g *echo.Group, h *Handler) {
	// Log route registration at Debug level for clarity
	slog.Debug("Registering task routes")

	// --- Route Definitions ---
	// Define routes in a structured way for readability
	routes := []struct {
		Method string
		Path   string
		Func   echo.HandlerFunc
	}{
		// Authenticated routes (JWT middleware applied by caller)
		{"GET", "", h.GetAllTasks},             // GET /api/tasks
		{"POST", "", h.CreateTask},            // POST /api/tasks
		{"GET", "/count", h.GetTaskCounts},      // GET /api/tasks/count
		{"GET", "/:id", h.GetTaskByID},         // GET /api/tasks/{id}
		{"PUT", "/:id", h.UpdateTask},         // PUT /api/tasks/{id} (Core details)
		{"DELETE", "/:id", h.DeleteTask},      // DELETE /api/tasks/{id}
		{"PUT", "/:id/status", h.UpdateTaskStatus}, // PUT /api/tasks/{id}/status (Status only)
		{"POST", "/:id/updates", h.AddTaskUpdate}, // POST /api/tasks/{id}/updates (Add comment)
		// Note: GET /:id/updates is implicitly handled by GetTaskByID fetching updates
	}

	// --- Register Routes with Echo Group ---
	for _, route := range routes {
		// Log the path relative to the current group 'g'
		relativePath := route.Path
		if relativePath == "" {
			relativePath = "/" // Represent group root clearly in logs
		}

		switch route.Method {
		case "POST":
			g.POST(route.Path, route.Func)
		case "GET":
			g.GET(route.Path, route.Func)
		case "PUT":
			g.PUT(route.Path, route.Func)
		case "DELETE":
			g.DELETE(route.Path, route.Func)
			// Add other HTTP methods if needed
		}
		// Log each registered route using the relative path
		slog.Debug("Registered task route", "method", route.Method, "relativePath", relativePath)
	}

	slog.Debug("Finished registering task routes")
}
