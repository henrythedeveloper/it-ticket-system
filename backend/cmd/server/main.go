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

	"github.com/henrythedeveloper/it-ticket-system/internal/api"
	"github.com/henrythedeveloper/it-ticket-system/internal/config"
	"github.com/henrythedeveloper/it-ticket-system/internal/db"
	"github.com/henrythedeveloper/it-ticket-system/internal/email"
	"github.com/henrythedeveloper/it-ticket-system/internal/file"
	"github.com/labstack/echo/v4" // Import Echo
)

func main() {
	// --- Setup slog Logger ---
	logLevel := new(slog.LevelVar)
	opts := slog.HandlerOptions{Level: logLevel, AddSource: true}
	handler := slog.NewTextHandler(os.Stdout, &opts)
	logger := slog.New(handler)
	slog.SetDefault(logger)
	// --- End Logger Setup ---

	slog.Info("Application starting...")

	// --- Log Internal Hostname ---
	hostname, hostErr := os.Hostname()
	if hostErr != nil {
		slog.Warn("Could not determine internal hostname", "error", hostErr)
	} else {
		slog.Info("Internal hostname reported by OS", "hostname", hostname)
	}
	// --- End Hostname Log ---

	// --- Load Configuration ---
	cfg, err := config.Load()
	if err != nil {
		slog.Error("Configuration loading failed. Exiting.", "error", err)
		os.Exit(1)
	}

	// --- Initialize Database ---
	database, err := db.Connect(cfg.Database)
	if err != nil {
		slog.Error("Failed to connect to database. Exiting.", "error", err)
		os.Exit(1)
	}
	defer database.Close()
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
	slog.Info("File storage service initialized", "endpoint", cfg.Storage.Endpoint)

	// --- Setup API Server ---
	server := api.NewServer(database, emailService, fileService, cfg)
	slog.Info("API server setup complete")

	// --- Add Health Check Endpoint ---
	// Get the underlying Echo instance from the server
	echoInstance := server.EchoInstance()
	// Add the health check route directly to the Echo instance
	echoInstance.GET("/api/healthz", func(c echo.Context) error {
		// Basic check: just return 200 OK. Could add DB ping later.
		return c.String(http.StatusOK, "ok")
	})
	slog.Info("Registered /api/healthz endpoint")
	// --- End Health Check ---

	// --- Log Registered Routes (Use Debug level) ---
	// This helper function should be defined in internal/api/server.go
	// logRegisteredRoutes(echoInstance) // Assuming logRegisteredRoutes exists

	// --- Start Server ---
	go func() {
		internalPort := os.Getenv("PORT")
		if internalPort == "" {
			internalPort = "8080" // Ensure backend listens on 8080 as specified in render.yaml
			slog.Warn("PORT environment variable not set by Render, defaulting to 8080")
		}
		address := fmt.Sprintf(":%s", internalPort)

		slog.Info("Starting server", "address", address) // Log before starting
		if err := server.Start(address); err != nil && !errors.Is(err, http.ErrServerClosed) {
			slog.Error("Server failed to start", "address", address, "error", err)
			os.Exit(1)
		}
	}()

	// --- Graceful Shutdown Handling ---
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt, syscall.SIGTERM)
	recSignal := <-quit
	slog.Info("Received signal, initiating shutdown...", "signal", recSignal.String())
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := server.Shutdown(shutdownCtx); err != nil {
		slog.Error("Server forced to shutdown uncleanly", "error", err)
		os.Exit(1)
	}
	slog.Info("Server exited gracefully")
}

