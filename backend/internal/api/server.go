package api

import (
	"context"

	"github.com/henrythedeveloper/bus-it-ticket/internal/api/handlers/task"
	"github.com/henrythedeveloper/bus-it-ticket/internal/api/handlers/ticket"
	"github.com/henrythedeveloper/bus-it-ticket/internal/api/handlers/user"
	"github.com/henrythedeveloper/bus-it-ticket/internal/api/middleware/auth"
	"github.com/henrythedeveloper/bus-it-ticket/internal/auth"
	"github.com/henrythedeveloper/bus-it-ticket/internal/config"
	"github.com/henrythedeveloper/bus-it-ticket/internal/db"
	"github.com/henrythedeveloper/bus-it-ticket/internal/email"
	"github.com/henrythedeveloper/bus-it-ticket/internal/file"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
)

// Server represents the API server
type Server struct {
	echo        *echo.Echo
	config      *config.Config
	authService auth.Service
}

// NewServer creates a new API server
func NewServer(db *db.DB, emailService email.Service, fileService file.Service, cfg *config.Config) *Server {
	e := echo.New()
	e.HideBanner = true

	// Create auth service
	authService := auth.NewService(cfg.Auth)

	// Create handlers
	userHandler := user.NewHandler(db, authService)
	ticketHandler := ticket.NewHandler(db, emailService, fileService)
	taskHandler := task.NewHandler(db, emailService)

	// Middleware
	e.Use(middleware.Logger())
	e.Use(middleware.Recover())
	e.Use(middleware.CORS())

	// JWT middleware
	jwtMiddleware := authmw.JWTMiddleware(authService)
	adminMiddleware := authmw.AdminMiddleware()

	// Routes
	apiGroup := e.Group("/api/v1")

	// Public routes
	apiGroup.POST("/auth/login", userHandler.Login)
	apiGroup.POST("/tickets", ticketHandler.CreateTicket)
	apiGroup.GET("/faq", user.GetAllFAQs) // This would be in a FAQ handler
	apiGroup.GET("/faq/:id", user.GetFAQByID)
	apiGroup.GET("/tags", user.GetAllTags) // This would be in a Tag handler

	// Protected routes (require authentication)
	authGroup := apiGroup.Group("", jwtMiddleware)

	// User routes
	userGroup := authGroup.Group("/users")
	user.RegisterRoutes(userGroup, userHandler, adminMiddleware)

	// Ticket routes
	ticketGroup := authGroup.Group("/tickets")
	ticket.RegisterRoutes(ticketGroup, ticketHandler)

	// Task routes
	taskGroup := authGroup.Group("/tasks")
	task.RegisterRoutes(taskGroup, taskHandler)

	return &Server{
		echo:        e,
		config:      cfg,
		authService: authService,
	}
}

// Start starts the API server
func (s *Server) Start(address string) error {
	return s.echo.Start(address)
}

// Shutdown gracefully shuts down the server
func (s *Server) Shutdown(ctx context.Context) error {
	return s.echo.Shutdown(ctx)
}
