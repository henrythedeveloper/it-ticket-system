// backend/internal/api/server.go
// ==========================================================================
// Configures and manages the main Echo web server instance.
// Initializes middleware, creates handlers, registers routes, and manages
// server lifecycle (start, shutdown).
// **REVISED**: Separated public auth routes from protected user management routes.
// **REVISED AGAIN**: Explicitly separated public GET routes for tags/faq
//                  from protected POST/PUT/DELETE routes.
// **REVISED AGAIN**: Adjusted protected routes to grant Staff near-Admin permissions,
//                    reserving AdminMiddleware only for user deletion.
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
	adminMiddleware := authmw.AdminMiddleware() // Middleware specifically for Admin-only actions
	slog.Info("Authentication middleware configured")

	// --- Define API Route Groups ---
	apiGroup := e.Group("/api")

	// ================== PUBLIC ROUTES ==================
	slog.Debug("Registering public routes...")

	// Public Auth Routes (/api/auth/*)
	authPublicGroup := apiGroup.Group("/auth")
	user.RegisterAuthRoutes(authPublicGroup, userHandler) // Registers /login, /register, etc.

	// Public Ticket Creation (/api/tickets)
	apiGroup.POST("/tickets", ticketHandler.CreateTicket)
	slog.Debug("Registered public route", "method", "POST", "path", "/api/tickets")

	// Public FAQ Routes (GET only) (/api/faq/*)
	faqGroupPublic := apiGroup.Group("/faq")
	faqGroupPublic.GET("", faqHandler.GetAllFAQs)
	faqGroupPublic.GET("/:id", faqHandler.GetFAQByID)
	slog.Debug("Registered public routes", "group", "/api/faq", "methods", "GET")

	// Public Tag Routes (GET only) (/api/tags)
	tagGroupPublic := apiGroup.Group("/tags")
	tagGroupPublic.GET("", tagHandler.GetAllTags) // Explicitly register only public GET for tags
	slog.Debug("Registered public route", "method", "GET", "path", "/api/tags")

	// Public Attachment Download (/api/attachments/download/:attachmentId)
	apiGroup.GET("/attachments/download/:attachmentId", ticketHandler.DownloadAttachment)
	slog.Debug("Registered public route", "method", "GET", "path", "/api/attachments/download/:attachmentId")

	// ================== PROTECTED ROUTES (Staff & Admin) ==================
	slog.Debug("Registering protected routes (JWT required)...")
	// Create a group that applies JWT middleware to all routes within it
	protectedGroup := apiGroup.Group("", jwtMiddleware) // Base JWT check for all below

	// --- Protected Ticket Routes (/api/tickets/*) ---
	// Assumes ticket management permissions are handled within ticket handlers if needed,
	// or that all authenticated users (Staff/Admin) can manage tickets.
	ticket.RegisterRoutes(protectedGroup.Group("/tickets"), ticketHandler)

	// --- Protected User Management Routes (/api/users/*) ---
	userGroup := protectedGroup.Group("/users")
	// GET /api/users - Accessible to Staff & Admin
	userGroup.GET("", userHandler.GetAllUsers)
	// GET /api/users/me - Accessible to logged-in user
	userGroup.GET("/me", userHandler.GetCurrentUser)
	// GET /api/users/:id - Accessible to Staff & Admin (internal checks might apply)
	userGroup.GET("/:id", userHandler.GetUserByID)
	// POST /api/users - Accessible to Staff & Admin
	userGroup.POST("", userHandler.CreateUser)
	// PUT /api/users/:id - Accessible to Staff & Admin (internal checks for self vs others)
	userGroup.PUT("/:id", userHandler.UpdateUser)
	// DELETE /api/users/:id - *ADMIN ONLY*
	userGroup.DELETE("/:id", userHandler.DeleteUser, adminMiddleware) // Apply specific adminMiddleware here
	slog.Debug("Registered user management routes", "group", "/api/users")

	// --- Protected FAQ Management Routes (/api/faq/*) ---
	faqGroupProtected := protectedGroup.Group("/faq") // JWT applied
	// GET routes already public
	// POST, PUT, DELETE Accessible to Staff & Admin
	faqGroupProtected.POST("", faqHandler.CreateFAQ)
	faqGroupProtected.PUT("/:id", faqHandler.UpdateFAQ)
	faqGroupProtected.DELETE("/:id", faqHandler.DeleteFAQ)
	slog.Debug("Registered protected FAQ routes", "group", "/api/faq", "methods", "POST, PUT, DELETE")

	// --- Protected Tag Management Routes (/api/tags/*) ---
	tagGroupProtected := protectedGroup.Group("/tags") // JWT applied
	// GET route already public
	// POST, DELETE Accessible to Staff & Admin
	tagGroupProtected.POST("", tagHandler.CreateTag)
	tagGroupProtected.DELETE("/:id", tagHandler.DeleteTag)
	slog.Debug("Registered protected Tag routes", "group", "/api/tags", "methods", "POST, DELETE")


	// --- Log All Routes and Complete Setup ---
	logRegisteredRoutes(e) // Log all registered routes at debug level
	slog.Info("API server setup complete")
	return &Server{
		echo:        e,
		config:      cfg,
		authService: authService,
		cache:       cacheService,
	}
}

// --- Server Lifecycle Methods ---

// EchoInstance returns the underlying Echo instance.
func (s *Server) EchoInstance() *echo.Echo { return s.echo }

// Start begins listening for HTTP requests on the configured address.
func (s *Server) Start(address string) error {
	slog.Info("Starting server", "address", address)
	err := s.echo.Start(address)
	// Don't log ErrServerClosed as an error, as it's expected during graceful shutdown
	if err != nil && !errors.Is(err, http.ErrServerClosed) {
		slog.Error("Server failed to start", "error", err)
		return fmt.Errorf("server startup failed: %w", err)
	}
	return nil
}

// Shutdown gracefully shuts down the server without interrupting active connections.
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

// logRegisteredRoutes iterates through the Echo router and logs all defined routes.
// Useful for debugging routing issues.
func logRegisteredRoutes(e *echo.Echo) {
	slog.Debug("--- Registered Routes ---")
	routes := e.Routes()
	for _, r := range routes {
		slog.Debug("Route:", "Method", r.Method, "Path", r.Path, "Name", r.Name)
	}
	slog.Debug("-------------------------")
}
