// backend/internal/db/db.go
// ==========================================================================
// Handles PostgreSQL database connections using pgxpool and runs database

// ==========================================================================

package db

import (
	"context"
	"fmt"
	"log/slog" // Use structured logging
	"time"

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
// provided configuration. It also pings the database to verify the connection.
//
// Parameters:
//   - cfg: The database configuration (config.DatabaseConfig).
//
// Returns:
//   - *DB: A pointer to the DB struct containing the connection pool.
//   - error: An error if the connection fails or the ping times out.
func Connect(cfg config.DatabaseConfig) (*DB, error) {
	logger := slog.With("component", "Database", "operation", "Connect")
	logger.Info("Attempting to connect to database...", "host", cfg.Host, "port", cfg.Port, "db", cfg.Name, "user", cfg.User)

	// --- Build Connection String ---
	// Example: "postgres://user:password@host:port/dbname?sslmode=disable"
	connString := fmt.Sprintf(
		"postgres://%s:%s@%s:%d/%s?sslmode=%s",
		cfg.User, cfg.Password, cfg.Host, cfg.Port, cfg.Name, cfg.SSLMode,
	)

	// --- Create Connection Pool ---
	// Use a context with timeout for the initial connection attempt.
	// Consider making the timeout configurable.
	connectCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	poolConfig, err := pgxpool.ParseConfig(connString)
	if err != nil {
		logger.Error("Failed to parse database connection string", "error", err)
		return nil, fmt.Errorf("invalid database connection string: %w", err)
	}

	// TODO: Configure pool settings (e.g., MaxConns, MinConns, MaxConnLifetime) if needed
	// poolConfig.MaxConns = 10

	pool, err := pgxpool.NewWithConfig(connectCtx, poolConfig)
	if err != nil {
		logger.Error("Failed to create database connection pool", "error", err)
		return nil, fmt.Errorf("unable to create connection pool: %w", err)
	}

	// --- Verify Connection ---
	// Ping the database to ensure connectivity.
	pingCtx, pingCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer pingCancel()
	if err := pool.Ping(pingCtx); err != nil {
		// Close the pool if ping fails
		pool.Close()
		logger.Error("Failed to ping database after connection", "error", err)
		return nil, fmt.Errorf("database ping failed: %w", err)
	}

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
