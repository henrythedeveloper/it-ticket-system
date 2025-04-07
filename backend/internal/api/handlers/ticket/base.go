package ticket

import (
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
	g.POST("", h.CreateTicket)
	g.GET("", h.GetAllTickets)
	g.GET("/:id", h.GetTicketByID)
	g.PUT("/:id", h.UpdateTicket)
	g.POST("/:id/comments", h.AddTicketComment)
	g.POST("/:id/attachments", h.UploadAttachment)
	g.GET("/:id/attachments/:attachmentId", h.GetAttachment)
	g.GET("/counts", h.GetTicketCounts)
	g.GET("/search", h.SearchTickets)
}
