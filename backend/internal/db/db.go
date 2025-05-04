// backend/internal/db/db.go
// ==========================================================================
// Handles PostgreSQL database connections using pgxpool.
// **REVISED**: Modified Connect function to use DatabaseConfig.URL directly.
// ==========================================================================

package db

import (
	"context"
	"fmt"
	"log/slog" // Use structured logging
	"time"
	"errors"

	"github.com/henrythedeveloper/it-ticket-system/internal/config" // App configuration
	"github.com/jackc/pgx/v5/pgxpool"                               // PostgreSQL driver/pool
)

// --- DB Struct ---

// DB encapsulates the pgx connection pool.
type DB struct {
	Pool *pgxpool.Pool // The connection pool instance
}

// --- Connection Function ---

// Connect establishes a connection pool to the PostgreSQL database using the
// provided configuration URL. It also pings the database to verify the connection.
//
// Parameters:
//   - cfg: The database configuration containing the connection URL (config.DatabaseConfig).
//
// Returns:
//   - *DB: A pointer to the DB struct containing the connection pool.
//   - error: An error if the connection fails or the ping times out.
func Connect(cfg config.DatabaseConfig) (*DB, error) {
	logger := slog.With("component", "Database", "operation", "Connect")
	// Log that we are using the URL, but DO NOT log the URL itself as it contains the password
	logger.Info("Attempting to connect to database using DATABASE_URL...")

	// --- Use Connection String from Config ---
	connString := cfg.URL
	if connString == "" {
		// This should have been caught by config validation, but double-check
		err := errors.New("DATABASE_URL is not configured")
		logger.Error("Database connection string is empty", "error", err)
		return nil, err
	}

	// --- Create Connection Pool ---
	connectCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	poolConfig, err := pgxpool.ParseConfig(connString)
	if err != nil {
		logger.Error("Failed to parse database connection string", "error", err)
		// Don't log the connString here either
		return nil, fmt.Errorf("invalid database connection string: %w", err)
	}

	// TODO: Configure pool settings if needed (e.g., MaxConns, MinConns)
	// poolConfig.MaxConns = 10

	pool, err := pgxpool.NewWithConfig(connectCtx, poolConfig)
	if err != nil {
		logger.Error("Failed to create database connection pool", "error", err)
		return nil, fmt.Errorf("unable to create connection pool: %w", err)
	}

	// --- Verify Connection ---
	pingCtx, pingCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer pingCancel()
	if err := pool.Ping(pingCtx); err != nil {
		pool.Close() // Close the pool if ping fails
		logger.Error("Failed to ping database after connection", "error", err)
		return nil, fmt.Errorf("database ping failed: %w", err)
	}

	// Log success without revealing sensitive parts of the URL
	logger.Info("Database connection pool established successfully.")
	return &DB{
		Pool: pool,
	}, nil
}

// --- Close Function ---

// Close terminates all connections in the pool.
// It should be called when the application is shutting down.
func (db *DB) Close() {
	if db.Pool != nil {
		slog.Info("Closing database connection pool...")
		db.Pool.Close()
		slog.Info("Database connection pool closed.")
	}
}
