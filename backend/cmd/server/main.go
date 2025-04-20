package main

import (
	"context"
	"fmt"
	"log/slog" 
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/henrythedeveloper/bus-it-ticket/internal/api"
	"github.com/henrythedeveloper/bus-it-ticket/internal/config"
	"github.com/henrythedeveloper/bus-it-ticket/internal/db"
	"github.com/henrythedeveloper/bus-it-ticket/internal/email"
	"github.com/henrythedeveloper/bus-it-ticket/internal/file"
)

func main() {
	// --- Setup slog Logger ---
	// Use TextHandler for development, JSONHandler for production environments
	logLevel := new(slog.LevelVar) // Defaults to Info
	// TODO: Optionally set log level from config/env var later
	// Example: logLevel.Set(slog.LevelDebug)
	opts := slog.HandlerOptions{
		Level: logLevel,
	}
	handler := slog.NewTextHandler(os.Stdout, &opts) // Or slog.NewJSONHandler
	logger := slog.New(handler)
	slog.SetDefault(logger)
	// --- End Logger Setup ---

	slog.Info("Application starting...")

	// Load configuration
	cfg, err := config.Load() // config.Load already logs errors using slog
	if err != nil {
		// config.Load already logged the specific error
		os.Exit(1) // Exit after config load failure
	}

	// Initialize database connection
	database, err := db.Connect(cfg.Database)
	if err != nil {
		slog.Error("Failed to connect to database", "error", err)
		os.Exit(1)
	}
	defer database.Close()
	slog.Info("Database connection established")

	// Run database migrations
	err = db.RunMigrations(cfg.Database) // db.RunMigrations logs success/failure
	if err != nil {
		slog.Error("Failed to run database migrations", "error", err)
		os.Exit(1)
	}

	// Initialize email service
	emailService, err := email.NewService(cfg.Email, cfg.Server.PortalBaseURL)
	if err != nil {
		slog.Error("Failed to initialize email service", "error", err)
		os.Exit(1)
	}
	slog.Info("Email service initialized", "provider", cfg.Email.Provider)

	// Initialize file storage service
	fileService, err := file.NewService(cfg.Storage)
	if err != nil {
		slog.Error("Failed to initialize file storage service", "error", err)
		os.Exit(1)
	}
	slog.Info("File storage service initialized", "endpoint", cfg.Storage.Endpoint) // Be careful logging endpoints if sensitive

	// Setup API server
	server := api.NewServer(database, emailService, fileService, cfg)
	slog.Info("API server setup complete")

	// --- Log Registered Routes (Use Debug level) ---
	slog.Debug("Registering routes...") 
	routes := server.EchoInstance().Routes()
	for _, r := range routes {
		slog.Debug("Route registered", "method", r.Method, "path", r.Path, "name", r.Name) // Structured logging
	}
	slog.Debug("Route registration complete") 
	// --- End block ---

	// Start the server in a goroutine
	go func() {
		address := fmt.Sprintf(":%d", cfg.Server.Port)
		slog.Info("Starting server", "address", address)
		if err := server.Start(address); err != nil && err != http.ErrServerClosed {
			slog.Error("Server failed to start", "error", err)
			os.Exit(1) // Exit if server can't start
		}
	}()

	// Wait for interrupt signal to gracefully shutdown the server
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt, syscall.SIGTERM)
	<-quit
	slog.Info("Shutting down server...")

	// Create a deadline to wait for
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Doesn't block if no connections, but will otherwise wait until the timeout
	if err := server.Shutdown(ctx); err != nil {
		slog.Error("Server forced to shutdown", "error", err)
		os.Exit(1)
	}

	slog.Info("Server exited properly")
}