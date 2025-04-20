package ticket

import (
	"log/slog"

	"github.com/henrythedeveloper/bus-it-ticket/internal/db"
	"github.com/henrythedeveloper/bus-it-ticket/internal/email"
	"github.com/henrythedeveloper/bus-it-ticket/internal/file"
	"github.com/labstack/echo/v4"

)

// Handler handles ticket-related requests
type Handler struct {
	db           *db.DB
	emailService email.Service
	fileService  file.Service
}

// NewHandler creates a new ticket handler
func NewHandler(db *db.DB, emailService email.Service, fileService file.Service) *Handler {
	return &Handler{
		db:           db,
		emailService: emailService,
		fileService:  fileService,
	}
}

// RegisterRoutes registers the ticket handler routes
func RegisterRoutes(g *echo.Group, h *Handler) {
	// Use slog.Debug for route registration details
	// Removed g.Prefix as it's not accessible
	slog.Debug("Registering ticket routes group") // CHANGED: Removed prefix attribute

	routes := []struct {
		Method string
		Path   string
		Func   echo.HandlerFunc
	}{
		{"POST", "", h.CreateTicket},
		{"GET", "", h.GetAllTickets},
		{"GET", "/:id", h.GetTicketByID},
		{"PUT", "/:id", h.UpdateTicket},
		{"POST", "/:id/comments", h.AddTicketComment},
		{"POST", "/:id/attachments", h.UploadAttachment},
		{"GET", "/:id/attachments/:attachmentId", h.GetAttachment},
		// Note: "/attachments/download/:attachmentId" is relative to the PARENT group (/api),
		// not the ticket group (/api/tickets). This route should likely be registered
		// outside this specific ticket group registration if it doesn't depend on /tickets/:id.
		// If it *should* be /api/tickets/attachments/download/:attachmentId, change path below.
		// For now, assuming it's registered elsewhere or the path is correct as is relative to /api.
		// If it belongs here, adjust path: {"GET", "/attachments/download/:attachmentId", h.DownloadAttachment},
		{"GET", "/counts", h.GetTicketCounts},
		{"GET", "/search", h.SearchTickets},
		// Special case handled outside the loop for clarity if needed:
		// g.GET("/attachments/download/:attachmentId", h.DownloadAttachment)
		// slog.Debug("Registered ticket route", "method", "GET", "path", "/api/attachments/download/:attachmentId") // Manually log if outside group

	}

	// Register general ticket routes
	for _, route := range routes {
		// We will log the path relative to the group 'g'
		registeredPath := route.Path
		if registeredPath == "" {
			registeredPath = "/" // Represent group root
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
			// Add other methods if needed
		}
		// Log each route registration at Debug level with structured attributes
		slog.Debug("Registered ticket route", "method", route.Method, "relativePath", registeredPath)
	}

	// Special handling for the download route if it doesn't fit the group pattern well
	// This assumes it should be /api/attachments/download/:attachmentId, registered on the parent group usually
	// If it *is* meant to be /api/tickets/attachments/download/:attachmentId, add it to the 'routes' slice above.
	// Example if it's added to the slice above:
	// { Method: "GET", Path: "/attachments/download/:attachmentId", Func: h.DownloadAttachment },

	slog.Debug("Finished registering ticket routes")
}