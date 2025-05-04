// backend/internal/api/server.go
// ==========================================================================
// Configures and manages the main Echo web server instance.
// Initializes middleware, creates handlers, registers routes, and manages
// server lifecycle (start, shutdown).
// **REVISED**: Separated public auth routes from protected user management routes.
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
	"github.com/henrythedeveloper/it-ticket-system/internal/api/handlers/ticket"
	"github.com/henrythedeveloper/it-ticket-system/internal/api/handlers/user" // User handler package
	authmw "github.com/henrythedeveloper/it-ticket-system/internal/api/middleware/auth" // Auth middleware

	// Import core services and config
	"github.com/henrythedeveloper/it-ticket-system/internal/auth"
	"github.com/henrythedeveloper/it-ticket-system/internal/cache"
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
	cache       cache.Cache
}

// --- Constructor ---

// NewServer creates, configures, and returns a new Server instance.
func NewServer(db *db.DB, emailService email.Service, fileService file.Service, cfg *config.Config) *Server {
	slog.Info("Initializing API server...")
	e := echo.New()
	e.HideBanner = true

	authService := auth.NewService(cfg.Auth)
	slog.Info("Authentication service initialized")

	// Initialize cache
	var cacheService cache.Cache
	if cfg.Cache.Enabled {
		cacheOptions := cache.Options{
			DefaultExpiration: cfg.Cache.DefaultExpiration,
			RedisURL:          cfg.Cache.RedisURL,
			UseMemoryCache:    cfg.Cache.Provider == "memory",
		}
		var err error
		cacheService, err = cache.NewCache(cacheOptions)
		if err != nil {
			slog.Warn("Failed to initialize cache service, proceeding without caching", "error", err)
			cacheService = cache.NewNoOpCache()
		} else {
			slog.Info("Cache service initialized successfully", "provider", cfg.Cache.Provider)
		}
	} else {
		slog.Info("Caching disabled in configuration")
		cacheService = cache.NewNoOpCache()
	}

	// --- Setup Middleware ---
	e.Use(middleware.RequestLoggerWithConfig(middleware.RequestLoggerConfig{
		LogStatus:    true, LogURI:       true, LogMethod:    true,
		LogLatency:   true, LogError:     true, LogRemoteIP:  true,
		LogUserAgent: true,
		LogValuesFunc: func(c echo.Context, v middleware.RequestLoggerValues) error {
			level := slog.LevelInfo; var errMsg string
			if v.Error != nil { errMsg = v.Error.Error() }
			if v.Status >= 500 { level = slog.LevelError } else if v.Status >= 400 { level = slog.LevelWarn }
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
	// Pass emailService and config to userHandler
	userHandler := user.NewHandler(db, authService, emailService, cfg)
	ticketHandler := ticket.NewHandler(db, emailService, fileService)
	slog.Info("API handlers initialized")

	// --- Setup Authentication Middleware ---
	jwtMiddleware := authmw.JWTMiddleware(authService)
	adminMiddleware := authmw.AdminMiddleware()
	slog.Info("Authentication middleware configured")

	// --- Define API Route Groups ---
	apiGroup := e.Group("/api")

	// --- Public Routes ---
	slog.Debug("Registering public routes...")
	// Public Auth Routes
	authPublicGroup := apiGroup.Group("/auth") // Group for public auth actions
	user.RegisterAuthRoutes(authPublicGroup, userHandler)

	// Public Ticket Creation
	apiGroup.POST("/tickets", ticketHandler.CreateTicket)

	// Public FAQ Routes
	faqGroupPublic := apiGroup.Group("/faq")
	faqGroupPublic.GET("", faqHandler.GetAllFAQs)
	faqGroupPublic.GET("/:id", faqHandler.GetFAQByID)

	// Public Tag Routes
	tagGroupPublic := apiGroup.Group("/tags")
	tagGroupPublic.GET("", tagHandler.GetAllTags)

	// Public Attachment Download
	apiGroup.GET("/attachments/download/:attachmentId", ticketHandler.DownloadAttachment)
	slog.Debug("Registered public route", "method", "GET", "path", "/api/attachments/download/:attachmentId")

	// --- Protected Routes (Require JWT Authentication) ---
	slog.Debug("Registering protected routes...")
	// Create a group that applies JWT middleware
	protectedGroup := apiGroup.Group("", jwtMiddleware)

	// Register resource routes under the protected group
	ticket.RegisterRoutes(protectedGroup.Group("/tickets"), ticketHandler)
	// Register user management routes (these already require JWT via protectedGroup)
	user.RegisterUserManagementRoutes(protectedGroup.Group("/users"), userHandler, adminMiddleware)
	// Register protected FAQ/Tag routes (admin-only write operations)
	faq.RegisterRoutes(protectedGroup.Group("/faq"), faqHandler, adminMiddleware)
	tag.RegisterRoutes(protectedGroup.Group("/tags"), tagHandler, adminMiddleware)

	logRegisteredRoutes(e)
	slog.Info("API server setup complete")
	return &Server{
		echo:        e,
		config:      cfg,
		authService: authService,
		cache:       cacheService,
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

