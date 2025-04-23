// backend/internal/api/handlers/user/utils.go
// ==========================================================================
// Utility functions specific to the user handler package.
// Includes helpers for common database queries related to users and SQL query constants.
// ==========================================================================

package user

import (
	"context"
	"errors"
	"fmt"
	"log/slog"

	"github.com/henrythedeveloper/it-ticket-system/internal/db"    // Corrected import path
	"github.com/henrythedeveloper/it-ticket-system/internal/models" // Data models
	"github.com/jackc/pgx/v5"
)

// --- SQL Query Constants ---
// Define SQL queries used by the user handlers and helpers.
const (
	QueryGetUserByID = `
		SELECT id, name, email, role, created_at, updated_at
		FROM users WHERE id = $1`

	QueryGetUserWithPasswordByID = `
		SELECT id, name, email, password_hash, role, created_at, updated_at
		FROM users WHERE id = $1`

	QueryGetUserByEmail = `
		SELECT id, name, email, password_hash, role, created_at, updated_at
		FROM users WHERE email = $1`

	QueryEmailExists = `
		SELECT EXISTS(SELECT 1 FROM users WHERE email = $1)`

	QueryEmailExistsExcept = `
		SELECT EXISTS(SELECT 1 FROM users WHERE email = $1 AND id != $2)`

	QueryGetAllUsers = `
		SELECT id, name, email, role, created_at, updated_at
		FROM users ORDER BY name ASC`

	QueryCreateUser = `
		INSERT INTO users (name, email, password_hash, role, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, name, email, role, created_at, updated_at`

	QueryDeleteUser = `
		DELETE FROM users WHERE id = $1`
)

// --- Database Query Helpers ---

// getUserByID retrieves a user by their ID, excluding the password hash.
//
// Parameters:
//   - ctx: The request context.
//   - db: The database connection pool.
//   - userID: The UUID string of the user to retrieve.
//
// Returns:
//   - models.User: The user object if found.
//   - error: An error if the user is not found or a database error occurs.
func getUserByID(ctx context.Context, db *db.DB, userID string) (models.User, error) {
	logger := slog.With("helper", "getUserByID", "userID", userID)
	var user models.User
	// Use the defined constant
	err := db.Pool.QueryRow(ctx, QueryGetUserByID, userID).Scan(
		&user.ID, &user.Name, &user.Email, &user.Role, &user.CreatedAt, &user.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			logger.WarnContext(ctx, "User not found")
			return user, errors.New("user not found")
		}
		logger.ErrorContext(ctx, "Database query failed", "error", err)
		return user, fmt.Errorf("failed to get user by ID: %w", err)
	}
	return user, nil
}

// getUserWithPasswordByID retrieves a user by ID, including the password hash.
// Used internally for authentication checks.
//
// Parameters:
//   - ctx: The request context.
//   - db: The database connection pool.
//   - userID: The UUID string of the user to retrieve.
//
// Returns:
//   - models.User: The user object including PasswordHash if found.
//   - error: An error if the user is not found or a database error occurs.
func getUserWithPasswordByID(ctx context.Context, db *db.DB, userID string) (models.User, error) {
	logger := slog.With("helper", "getUserWithPasswordByID", "userID", userID)
	var user models.User
	// Use the defined constant
	err := db.Pool.QueryRow(ctx, QueryGetUserWithPasswordByID, userID).Scan(
		&user.ID, &user.Name, &user.Email, &user.PasswordHash, // Include password hash
		&user.Role, &user.CreatedAt, &user.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			logger.WarnContext(ctx, "User not found")
			return user, errors.New("user not found")
		}
		logger.ErrorContext(ctx, "Database query failed", "error", err)
		return user, fmt.Errorf("failed to get user with password by ID: %w", err)
	}
	return user, nil
}

// getUserByEmail retrieves a user by their email address, including the password hash.
// Used primarily for the login process.
//
// Parameters:
//   - ctx: The request context.
//   - db: The database connection pool.
//   - email: The email address to search for.
//
// Returns:
//   - models.User: The user object including PasswordHash if found.
//   - error: An error if the user is not found or a database error occurs.
func getUserByEmail(ctx context.Context, db *db.DB, email string) (models.User, error) {
	logger := slog.With("helper", "getUserByEmail", "email", email)
	var user models.User
	// Use the defined constant
	err := db.Pool.QueryRow(ctx, QueryGetUserByEmail, email).Scan(
		&user.ID, &user.Name, &user.Email, &user.PasswordHash, // Include password hash
		&user.Role, &user.CreatedAt, &user.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			logger.DebugContext(ctx, "User not found by email") // Debug level as this is expected during login attempts
			return user, errors.New("user not found")
		}
		logger.ErrorContext(ctx, "Database query failed", "error", err)
		return user, fmt.Errorf("failed to get user by email: %w", err)
	}
	return user, nil
}

// emailExists checks if a given email address already exists in the users table.
//
// Parameters:
//   - ctx: The request context.
//   - db: The database connection pool.
//   - email: The email address to check.
//
// Returns:
//   - bool: True if the email exists, false otherwise.
//   - error: An error if the database query fails.
func emailExists(ctx context.Context, db *db.DB, email string) (bool, error) {
	logger := slog.With("helper", "emailExists", "email", email)
	var exists bool
	// Use the defined constant
	err := db.Pool.QueryRow(ctx, QueryEmailExists, email).Scan(&exists)
	if err != nil {
		logger.ErrorContext(ctx, "Database query failed", "error", err)
		return false, fmt.Errorf("failed to check email existence: %w", err)
	}
	logger.DebugContext(ctx, "Email existence check result", "exists", exists)
	return exists, nil
}

// emailExistsExcept checks if an email exists for any user *except* the one with the specified userID.
// Used during user updates to prevent assigning an email already taken by someone else.
//
// Parameters:
//   - ctx: The request context.
//   - db: The database connection pool.
//   - email: The email address to check.
//   - userID: The UUID string of the user to exclude from the check.
//
// Returns:
//   - bool: True if the email exists for another user, false otherwise.
//   - error: An error if the database query fails.
func emailExistsExcept(ctx context.Context, db *db.DB, email string, userID string) (bool, error) {
	logger := slog.With("helper", "emailExistsExcept", "email", email, "excludeUserID", userID)
	var exists bool
	// Use the defined constant
	err := db.Pool.QueryRow(ctx, QueryEmailExistsExcept, email, userID).Scan(&exists)
	if err != nil {
		logger.ErrorContext(ctx, "Database query failed", "error", err)
		return false, fmt.Errorf("failed to check email existence excluding user: %w", err)
	}
	logger.DebugContext(ctx, "Email existence check (excluding user) result", "exists", exists)
	return exists, nil
}

// getAllUsers retrieves all users from the database, excluding password hashes.
// Typically used by admins.
//
// Parameters:
//   - ctx: The request context.
//   - db: The database connection pool.
//
// Returns:
//   - []models.User: A slice of all user objects.
//   - error: An error if the database query fails.
func getAllUsers(ctx context.Context, db *db.DB) ([]models.User, error) {
	logger := slog.With("helper", "getAllUsers")
	// Use the defined constant
	rows, err := db.Pool.Query(ctx, QueryGetAllUsers)
	if err != nil {
		logger.ErrorContext(ctx, "Database query failed", "error", err)
		return nil, fmt.Errorf("failed to get all users: %w", err)
	}
	defer rows.Close()

	users := make([]models.User, 0)
	for rows.Next() {
		var user models.User
		if err := rows.Scan(
			&user.ID, &user.Name, &user.Email, &user.Role, &user.CreatedAt, &user.UpdatedAt,
		); err != nil {
			logger.ErrorContext(ctx, "Failed to scan user row", "error", err)
			// Continue scanning other rows? Or return error? Returning error.
			return nil, fmt.Errorf("failed to scan user data: %w", err)
		}
		users = append(users, user)
	}

	if err = rows.Err(); err != nil {
		logger.ErrorContext(ctx, "Error iterating user rows", "error", err)
		return nil, fmt.Errorf("failed to process user results: %w", err)
	}

	logger.DebugContext(ctx, "Fetched all users successfully", "count", len(users))
	return users, nil
}
