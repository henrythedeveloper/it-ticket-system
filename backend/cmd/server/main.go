package main

import (
	"context"
	"errors" // Import errors package
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	// Correctly import the api package (no alias needed or use 'api')
	"github.com/henrythedeveloper/it-ticket-system/internal/api"
	"github.com/henrythedeveloper/it-ticket-system/internal/config"
	"github.com/henrythedeveloper/it-ticket-system/internal/db"
	"github.com/henrythedeveloper/it-ticket-system/internal/email"
	"github.com/henrythedeveloper/it-ticket-system/internal/file"
)

func main() {
	// --- Setup slog Logger ---
	logLevel := new(slog.LevelVar) // Defaults to Info
	// TODO: Optionally set log level from config/env var later
	opts := slog.HandlerOptions{
		Level:     logLevel,
		AddSource: true, // Add source file and line number
	}
	// Use TextHandler for development, JSONHandler for production
	handler := slog.NewTextHandler(os.Stdout, &opts)
	logger := slog.New(handler)
	slog.SetDefault(logger)
	// --- End Logger Setup ---

	slog.Info("Application starting...")

	// --- Load Configuration ---
	cfg, err := config.Load() // config.Load already logs errors
	if err != nil {
		slog.Error("Configuration loading failed. Exiting.", "error", err) // Add explicit exit log
		os.Exit(1)
	}

	// --- Initialize Database ---
	database, err := db.Connect(cfg.Database)
	if err != nil {
		slog.Error("Failed to connect to database. Exiting.", "error", err)
		os.Exit(1)
	}
	defer database.Close() // Ensure DB pool is closed on exit
	slog.Info("Database connection established")


	// --- Initialize Email Service ---
	emailService, err := email.NewService(cfg.Email, cfg.Server.PortalBaseURL)
	if err != nil {
		slog.Error("Failed to initialize email service. Exiting.", "error", err)
		os.Exit(1)
	}
	slog.Info("Email service initialized")

	// --- Initialize File Storage Service ---
	fileService, err := file.NewService(cfg.Storage)
	if err != nil {
		slog.Error("Failed to initialize file storage service. Exiting.", "error", err)
		os.Exit(1)
	}
	// Be cautious logging storage endpoint if it contains sensitive info
	slog.Info("File storage service initialized", "endpoint", cfg.Storage.Endpoint)

	// --- Setup API Server ---
	// Use the correct package identifier 'api'
	server := api.NewServer(database, emailService, fileService, cfg)
	slog.Info("API server setup complete")

	// --- Log Registered Routes (Use Debug level) ---
	slog.Debug("Registering routes...")
	// Use the EchoInstance() method from the refactored api.Server
	routes := server.EchoInstance().Routes()
	for _, r := range routes {
		slog.Debug("Route registered", "method", r.Method, "path", r.Path, "name", r.Name)
	}
	slog.Debug("Route registration complete")
	// --- End block ---

	// --- Start Server ---
	// Start the server in a goroutine so it doesn't block the shutdown handling
	go func() {
		address := fmt.Sprintf(":%d", cfg.Server.Port)
		if err := server.Start(address); err != nil && !errors.Is(err, http.ErrServerClosed) {
			// Log fatal error if server can't start (excluding ErrServerClosed)
			slog.Error("Server failed to start", "address", address, "error", err)
			os.Exit(1) // Exit if server fails to start
		}
	}()

	// --- Graceful Shutdown Handling ---
	// Wait for interrupt signal (Ctrl+C) or termination signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt, syscall.SIGTERM)

	// Block until a signal is received
	recSignal := <-quit
	slog.Info("Received signal, initiating shutdown...", "signal", recSignal.String())

	// Create a context with a timeout for shutdown
	// Gives active connections time to finish
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Attempt to gracefully shut down the server
	if err := server.Shutdown(shutdownCtx); err != nil {
		slog.Error("Server forced to shutdown uncleanly", "error", err)
		os.Exit(1) // Exit with error status if shutdown fails
	}

	slog.Info("Server exited gracefully")
}
