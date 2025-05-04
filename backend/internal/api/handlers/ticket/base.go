// backend/internal/api/handlers/ticket/base.go
// ==========================================================================
// Base setup for the ticket handler package. Defines the Handler struct
// and registers routes for ticket-related API endpoints.
// ==========================================================================

package ticket

import (
	"log/slog" // Use structured logging

	"github.com/henrythedeveloper/it-ticket-system/internal/db"    // Corrected import path
	"github.com/henrythedeveloper/it-ticket-system/internal/email" // Corrected import path
	"github.com/henrythedeveloper/it-ticket-system/internal/file"  // Corrected import path
	"github.com/labstack/echo/v4"
)

// --- Handler Struct ---

// Handler holds dependencies for ticket-related request handlers.
type Handler struct {
	db           *db.DB        // Database connection pool
	emailService email.Service // Service for sending emails
	fileService  file.Service  // Service for file storage operations
}

// --- Constructor ---

// NewHandler creates a new instance of the ticket Handler.
// It initializes the handler with necessary service dependencies.
//
// Parameters:
//   - db: The database connection pool (*db.DB).
//   - emailService: The email sending service (email.Service).
//   - fileService: The file storage service (file.Service).
//
// Returns:
//   - *Handler: A pointer to the newly created Handler.
func NewHandler(db *db.DB, emailService email.Service, fileService file.Service) *Handler {
	return &Handler{
		db:           db,
		emailService: emailService,
		fileService:  fileService,
	}
}

// --- Route Registration ---

// RegisterRoutes defines and registers all API routes managed by this ticket handler.
// It maps HTTP methods and paths to specific handler functions.
// Middleware (like authentication) is applied at the group level in server.go.
//
// Parameters:
//   - g: The echo group to register routes onto (*echo.Group).
//   - h: The ticket Handler instance containing the handler functions (*Handler).
func RegisterRoutes(g *echo.Group, h *Handler) {
	// Log route registration at Debug level for clarity
	slog.Debug("Registering ticket routes")

	// --- Route Definitions ---
	// Define routes in a structured way for readability
	routes := []struct {
		Method string
		Path   string
		Func   echo.HandlerFunc
	}{
		// Public route for creating tickets (moved to server.go for clarity)
		// {"POST", "", h.CreateTicket}, // POST /api/tickets

		// Authenticated routes (JWT middleware applied by caller to group 'g')
		{"GET", "", h.GetAllTickets},                                // GET /api/tickets
		{"GET", "/counts", h.GetTicketCounts},                      // GET /api/tickets/counts
		{"GET", "/search", h.SearchTickets},                        // GET /api/tickets/search
		{"GET", "/:id", h.GetTicketByID},                           // GET /api/tickets/{id}
		{"GET", "/:id", h.GetTicketByIDOptimized},                 // GET /api/tickets/{id} - Use optimized handler with attachments
		{"PUT", "/:id", h.UpdateTicket},                           // PUT /api/tickets/{id} (Handles status/assignee updates)
		{"POST", "/:id/comments", h.AddTicketComment},             // POST /api/tickets/{id}/comments
		{"POST", "/:id/attachments", h.UploadAttachment},          // POST /api/tickets/{id}/attachments
		{"GET", "/:id/attachments/:attachmentId", h.GetAttachment}, // GET /api/tickets/{id}/attachments/{attachmentId} (Metadata)
		{"DELETE", "/:id/attachments/:attachmentId", h.DeleteAttachment},
		// Note: Download route is often separate or handled differently, e.g., /api/attachments/download/:attachmentId
		// Assuming download route is handled elsewhere or via GetAttachment providing a URL
		// {"GET", "/attachments/download/:attachmentId", h.DownloadAttachment}, // Example if download is handled here
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
		slog.Debug("Registered ticket route", "method", route.Method, "relativePath", relativePath)
	}

	slog.Debug("Finished registering ticket routes")
}
