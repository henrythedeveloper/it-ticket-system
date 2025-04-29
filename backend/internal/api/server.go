// backend/internal/api/server.go
// ==========================================================================
// Configures and manages the main Echo web server instance.
// Initializes middleware, creates handlers, registers routes, and manages
// server lifecycle (start, shutdown).
// **REVISED**: Added attachment download route.
// **REVISED AGAIN**: Fixed import paths.
// ==========================================================================

package api

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"

	// Corrected handler imports
	"github.com/henrythedeveloper/it-ticket-system/internal/api/handlers/faq"
	"github.com/henrythedeveloper/it-ticket-system/internal/api/handlers/tag"
	"github.com/henrythedeveloper/it-ticket-system/internal/api/handlers/task"
	"github.com/henrythedeveloper/it-ticket-system/internal/api/handlers/ticket"
	"github.com/henrythedeveloper/it-ticket-system/internal/api/handlers/user"
	authmw "github.com/henrythedeveloper/it-ticket-system/internal/api/middleware/auth" // Auth middleware

	// Import core services and config
	"github.com/henrythedeveloper/it-ticket-system/internal/auth"
	"github.com/henrythedeveloper/it-ticket-system/internal/config"
	"github.com/henrythedeveloper/it-ticket-system/internal/db"
	"github.com/henrythedeveloper/it-ticket-system/internal/email"
	"github.com/henrythedeveloper/it-ticket-system/internal/file"

	// Correct echo imports
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
)

// --- Server Struct ---

// Server represents the API server application.
type Server struct {
	echo        *echo.Echo
	config      *config.Config
	authService auth.Service
}

// --- Constructor ---

// NewServer creates, configures, and returns a new Server instance.
func NewServer(db *db.DB, emailService email.Service, fileService file.Service, cfg *config.Config) *Server {
	slog.Info("Initializing API server...")
	e := echo.New()
	e.HideBanner = true

	authService := auth.NewService(cfg.Auth)
	slog.Info("Authentication service initialized")

	// --- Setup Middleware ---
	// Request Logger configuration (assuming it was correct)
	e.Use(middleware.RequestLoggerWithConfig(middleware.RequestLoggerConfig{
		LogStatus:   true,
		LogURI:      true,
		LogMethod:   true,
		LogLatency:  true,
		LogError:    true,
		LogRemoteIP: true,
		LogUserAgent: true,
		LogValuesFunc: func(c echo.Context, v middleware.RequestLoggerValues) error {
			level := slog.LevelInfo
			var errMsg string
			if v.Error != nil { errMsg = v.Error.Error() }
			if v.Status >= 500 { level = slog.LevelError }
			if v.Status >= 400 { level = slog.LevelWarn }
			attrs := []slog.Attr{
				slog.String("ip", v.RemoteIP), slog.String("method", v.Method),
				slog.String("uri", v.URI), slog.Int("status", v.Status),
				slog.Duration("latency", v.Latency), slog.String("user_agent", v.UserAgent),
			}
			if errMsg != "" { attrs = append(attrs, slog.String("error", errMsg)) }
			slog.LogAttrs(context.Background(), level, "HTTP Request", attrs...)
			return nil
		},
	}))
	e.Use(middleware.Recover())
	e.Use(middleware.CORSWithConfig(middleware.CORSConfig{
		AllowOrigins: []string{"*"}, // CHANGE FOR PRODUCTION
		AllowMethods: []string{http.MethodGet, http.MethodPut, http.MethodPost, http.MethodDelete, http.MethodOptions},
		AllowHeaders: []string{echo.HeaderOrigin, echo.HeaderContentType, echo.HeaderAccept, echo.HeaderAuthorization},
	}))
	slog.Info("Standard middleware configured")

	// --- Initialize Handlers ---
	faqHandler := faq.NewHandler(db)
	tagHandler := tag.NewHandler(db)
	userHandler := user.NewHandler(db, authService)
	ticketHandler := ticket.NewHandler(db, emailService, fileService)
	taskHandler := task.NewHandler(db, emailService)
	slog.Info("API handlers initialized")

	// --- Setup Authentication Middleware ---
	jwtMiddleware := authmw.JWTMiddleware(authService)
	adminMiddleware := authmw.AdminMiddleware()
	slog.Info("Authentication middleware configured")

	// --- Define API Route Groups ---
	apiGroup := e.Group("/api")

	// --- Public Routes ---
	slog.Debug("Registering public routes...")
	apiGroup.POST("/auth/login", userHandler.Login)
	apiGroup.POST("/tickets", ticketHandler.CreateTicket)
	faqGroupPublic := apiGroup.Group("/faq")
	faqGroupPublic.GET("", faqHandler.GetAllFAQs)
	faqGroupPublic.GET("/:id", faqHandler.GetFAQByID)
	tagGroupPublic := apiGroup.Group("/tags")
	tagGroupPublic.GET("", tagHandler.GetAllTags)
	apiGroup.GET("/attachments/download/:attachmentId", ticketHandler.DownloadAttachment)
	slog.Debug("Registered public route", "method", "GET", "path", "/api/attachments/download/:attachmentId")

	// --- Protected Routes (Require JWT Authentication) ---
	slog.Debug("Registering protected routes...")
	authGroup := apiGroup.Group("", jwtMiddleware)

	ticket.RegisterRoutes(authGroup.Group("/tickets"), ticketHandler)
	task.RegisterRoutes(authGroup.Group("/tasks"), taskHandler)
	user.RegisterRoutes(authGroup.Group("/users"), userHandler, adminMiddleware)
	faq.RegisterRoutes(authGroup.Group("/faq"), faqHandler, adminMiddleware)
	tag.RegisterRoutes(authGroup.Group("/tags"), tagHandler, adminMiddleware)

	logRegisteredRoutes(e)
	slog.Info("API server setup complete")
	return &Server{
		echo:        e,
		config:      cfg,
		authService: authService,
	}
}

// --- Server Lifecycle Methods ---
func (s *Server) EchoInstance() *echo.Echo { return s.echo }
func (s *Server) Start(address string) error {
	slog.Info("Starting server", "address", address)
	err := s.echo.Start(address)
	if err != nil && !errors.Is(err, http.ErrServerClosed) {
		slog.Error("Server failed to start", "error", err)
		return fmt.Errorf("server startup failed: %w", err)
	}
	return nil
}
func (s *Server) Shutdown(ctx context.Context) error {
	slog.Info("Initiating graceful server shutdown...")
	err := s.echo.Shutdown(ctx)
	if err != nil {
		slog.Error("Server shutdown failed", "error", err)
		return fmt.Errorf("server shutdown failed: %w", err)
	}
	slog.Info("Server shutdown completed successfully.")
	return nil
}

// --- Helper Functions ---
func logRegisteredRoutes(e *echo.Echo) {
	slog.Debug("--- Registered Routes ---")
	routes := e.Routes()
	for _, r := range routes {
		slog.Debug("Route:", "Method", r.Method, "Path", r.Path, "Name", r.Name)
	}
	slog.Debug("-------------------------")
}
