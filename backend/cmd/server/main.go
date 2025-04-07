package main

import (
	"context"
	"fmt"
	"log"
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
	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load configuration: %v", err)
	}

	// Initialize database connection
	database, err := db.Connect(cfg.Database)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer database.Close()

	// Run database migrations
	err = db.RunMigrations(cfg.Database)
	if err != nil {
		log.Fatalf("Failed to run migrations: %v", err)
	}

	// Initialize email service
	emailService, err := email.NewService(cfg.Email)
	if err != nil {
		log.Fatalf("Failed to initialize email service: %v", err)
	}

	// Initialize file storage service
	fileService, err := file.NewService(cfg.Storage)
	if err != nil {
		log.Fatalf("Failed to initialize file storage service: %v", err)
	}

	// Setup API server
	server := api.NewServer(database, emailService, fileService, cfg)

	// Start the server in a goroutine
	go func() {
		address := fmt.Sprintf(":%d", cfg.Server.Port)
		log.Printf("Starting server on %s", address)
		if err := server.Start(address); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Failed to start server: %v", err)
		}
	}()

	// Wait for interrupt signal to gracefully shutdown the server
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt, syscall.SIGTERM)
	<-quit
	log.Println("Shutting down server...")

	// Create a deadline to wait for
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Doesn't block if no connections, but will otherwise wait until the timeout
	if err := server.Shutdown(ctx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}

	log.Println("Server exited properly")
}
