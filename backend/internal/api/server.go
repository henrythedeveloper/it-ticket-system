// backend/internal/api/server.go
// ==========================================================================
// Configures and manages the main Echo web server instance.
// Initializes middleware, creates handlers, registers routes, and manages
// server lifecycle (start, shutdown).
// ==========================================================================

package api

import (
	"context"
	"errors"   // Import errors package
	"fmt"      // Import fmt package
	"log/slog"
	"net/http" // Import for http.ErrServerClosed

	"github.com/henrythedeveloper/it-ticket-system/internal/api/handlers/faq"
	"github.com/henrythedeveloper/it-ticket-system/internal/api/handlers/tag"
	"github.com/henrythedeveloper/it-ticket-system/internal/api/handlers/task"
	"github.com/henrythedeveloper/it-ticket-system/internal/api/handlers/ticket"
	"github.com/henrythedeveloper/it-ticket-system/internal/api/handlers/user"
	authmw "github.com/henrythedeveloper/it-ticket-system/internal/api/middleware/auth" // Auth middleware

	// Import core services and config
	"github.com/henrythedeveloper/it-ticket-system/internal/auth"   // Auth service
	"github.com/henrythedeveloper/it-ticket-system/internal/config" // App configuration
	"github.com/henrythedeveloper/it-ticket-system/internal/db"     // Database access
	"github.com/henrythedeveloper/it-ticket-system/internal/email"  // Email service
	"github.com/henrythedeveloper/it-ticket-system/internal/file"   // File storage service

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware" // Echo middleware package
)

// --- Server Struct ---

// Server represents the API server application.
// It holds the Echo instance and other core components like configuration
// and the authentication service.
type Server struct {
	echo        *echo.Echo     // The Echo web server instance
	config      *config.Config // Application configuration
	authService auth.Service   // Authentication service (used for middleware)
	// Add other global services if needed
}

// --- Constructor ---

// NewServer creates, configures, and returns a new Server instance.
// It initializes the Echo framework, sets up middleware, creates handlers for
// different resource types, and registers all API routes.
//
// Parameters:
//   - db: Database connection pool (*db.DB).
//   - emailService: Email sending service (email.Service).
//   - fileService: File storage service (file.Service).
//   - cfg: Application configuration (*config.Config).
//
// Returns:
//   - *Server: A pointer to the newly configured Server instance.
func NewServer(db *db.DB, emailService email.Service, fileService file.Service, cfg *config.Config) *Server {
	slog.Info("Initializing API server...")

	// --- Initialize Echo ---
	e := echo.New()
	e.HideBanner = true // Hide the default Echo banner on startup

	// --- Initialize Core Services ---
	// Auth service needed for middleware setup
	authService := auth.NewService(cfg.Auth)
	slog.Info("Authentication service initialized")

	// --- Setup Middleware ---
	// Request Logger: Logs details about each incoming request.
	e.Use(middleware.RequestLoggerWithConfig(middleware.RequestLoggerConfig{
		LogStatus:   true,
		LogURI:      true,
		LogMethod:   true,
		LogLatency:  true,
		LogError:    true,
		LogRemoteIP: true,
		LogUserAgent: true,
		LogValuesFunc: func(c echo.Context, v middleware.RequestLoggerValues) error {
			// Determine log level based on status code
			level := slog.LevelInfo
			var errMsg string // Store error message separately
			if v.Error != nil {
				errMsg = v.Error.Error()
			}
			if v.Status >= 500 {
				level = slog.LevelError
			} else if v.Status >= 400 {
				level = slog.LevelWarn
			}

			// Log structured request details
			attrs := []slog.Attr{
				slog.String("ip", v.RemoteIP),
				slog.String("method", v.Method),
				slog.String("uri", v.URI),
				slog.Int("status", v.Status),
				slog.Duration("latency", v.Latency),
				slog.String("user_agent", v.UserAgent),
			}
			// Only add error attribute if an error exists
			if errMsg != "" {
				attrs = append(attrs, slog.String("error", errMsg))
			}

			slog.LogAttrs(context.Background(), level, "HTTP Request", attrs...)
			return nil
		},
	}))

	// Recover: Recovers from panics anywhere in the chain and handles them gracefully.
	e.Use(middleware.Recover())

	// CORS: Allows cross-origin requests (configure origins appropriately for production).
	e.Use(middleware.CORSWithConfig(middleware.CORSConfig{
		// TODO: Restrict AllowOrigins in production!
		AllowOrigins: []string{"*"}, // Allow all for development, CHANGE THIS FOR PRODUCTION
		AllowMethods: []string{http.MethodGet, http.MethodPut, http.MethodPost, http.MethodDelete, http.MethodOptions},
		AllowHeaders: []string{echo.HeaderOrigin, echo.HeaderContentType, echo.HeaderAccept, echo.HeaderAuthorization},
	}))
	slog.Info("Standard middleware (Logger, Recover, CORS) configured")

	// --- Initialize Handlers ---
	// Create instances of handlers, injecting dependencies
	faqHandler := faq.NewHandler(db)
	// Use the correct package identifier 'tag'
	tagHandler := tag.NewHandler(db)
	userHandler := user.NewHandler(db, authService) // User handler needs authService
	ticketHandler := ticket.NewHandler(db, emailService, fileService)
	taskHandler := task.NewHandler(db, emailService)
	slog.Info("API handlers initialized")

	// --- Setup Authentication Middleware ---
	jwtMiddleware := authmw.JWTMiddleware(authService) // Middleware to validate JWT tokens
	adminMiddleware := authmw.AdminMiddleware()       // Middleware to check for Admin role
	slog.Info("Authentication middleware configured")

	// --- Define API Route Groups ---
	apiGroup := e.Group("/api") // Base group for all API v1 routes

	// --- Public Routes (No Authentication Required) ---
	slog.Debug("Registering public routes...")
	// Authentication endpoint
	apiGroup.POST("/auth/login", userHandler.Login) // Moved from user.RegisterRoutes for clarity
	// Public ticket submission
	apiGroup.POST("/tickets", ticketHandler.CreateTicket) // Moved from ticket.RegisterRoutes for clarity
	// Public read-only endpoints
	faqGroupPublic := apiGroup.Group("/faq")
	faqGroupPublic.GET("", faqHandler.GetAllFAQs)
	faqGroupPublic.GET("/:id", faqHandler.GetFAQByID)
	tagGroupPublic := apiGroup.Group("/tags")
	tagGroupPublic.GET("", tagHandler.GetAllTags) // Use correct handler variable
	// Public attachment download (assuming separate route)
	// apiGroup.GET("/attachments/download/:attachmentId", ticketHandler.DownloadAttachment) // Register download route if needed

	// --- Protected Routes (Require JWT Authentication) ---
	slog.Debug("Registering protected routes...")
	authGroup := apiGroup.Group("", jwtMiddleware) // Apply JWT validation to this group

	// Register routes for each resource type within the authenticated group
	ticket.RegisterRoutes(authGroup.Group("/tickets"), ticketHandler)
	task.RegisterRoutes(authGroup.Group("/tasks"), taskHandler)
	// User routes require admin middleware for certain operations
	user.RegisterRoutes(authGroup.Group("/users"), userHandler, adminMiddleware)
	// FAQ and Tag management routes (assuming they require admin)
	faq.RegisterRoutes(authGroup.Group("/faq"), faqHandler, adminMiddleware)
	// Use the correct package identifier 'tag'
	tag.RegisterRoutes(authGroup.Group("/tags"), tagHandler, adminMiddleware)

	// --- Log All Registered Routes (Optional Debugging) ---
	logRegisteredRoutes(e)

	slog.Info("API server setup complete")
	return &Server{
		echo:        e,
		config:      cfg,
		authService: authService,
	}
}

// --- Server Lifecycle Methods ---

// EchoInstance returns the underlying Echo instance.
// Useful for testing or accessing Echo-specific features directly.
func (s *Server) EchoInstance() *echo.Echo {
	return s.echo
}

// Start begins listening for HTTP requests on the specified address.
//
// Parameters:
//   - address: The network address to listen on (e.g., ":8080").
//
// Returns:
//   - error: An error if the server fails to start, excluding http.ErrServerClosed.
func (s *Server) Start(address string) error {
	slog.Info("Starting server", "address", address)
	// Start the server
	err := s.echo.Start(address)
	// http.ErrServerClosed is expected on graceful shutdown, so don't treat it as a startup error.
	if err != nil && !errors.Is(err, http.ErrServerClosed) {
		slog.Error("Server failed to start", "error", err)
		return fmt.Errorf("server startup failed: %w", err)
	}
	return nil // Return nil if shutdown was graceful (ErrServerClosed)
}

// Shutdown gracefully shuts down the Echo server with a timeout.
//
// Parameters:
//   - ctx: A context used to set a deadline for the shutdown process.
//
// Returns:
//   - error: An error if the shutdown process fails or times out.
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

// logRegisteredRoutes iterates through all registered routes in the Echo instance
// and logs them at the Debug level. Useful for verifying route setup.
func logRegisteredRoutes(e *echo.Echo) {
	slog.Debug("--- Registered Routes ---")
	routes := e.Routes()
	for _, r := range routes {
		slog.Debug("Route:", "Method", r.Method, "Path", r.Path, "Name", r.Name)
	}
	slog.Debug("-------------------------")
}
