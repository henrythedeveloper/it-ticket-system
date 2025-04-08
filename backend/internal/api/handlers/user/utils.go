package user

import (
	"context"
	"errors"
	"github.com/jackc/pgx/v5"
	"github.com/henrythedeveloper/bus-it-ticket/internal/models"
)

// getUserByID retrieves a user by ID from the database
func (h *Handler) getUserByID(ctx context.Context, userID string) (models.User, error) {
	var user models.User
	err := h.db.Pool.QueryRow(ctx, QueryGetUserByID, userID).Scan(
		&user.ID,
		&user.Name,
		&user.Email,
		&user.Role,
		&user.CreatedAt,
		&user.UpdatedAt,
	)
	
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return user, errors.New("user not found")
		}
		return user, errors.New("failed to get user")
	}
	
	return user, nil
}

// getUserWithPasswordByID retrieves a user with password hash by ID
func (h *Handler) getUserWithPasswordByID(ctx context.Context, userID string) (models.User, error) {
	var user models.User
	err := h.db.Pool.QueryRow(ctx, QueryGetUserWithPasswordByID, userID).Scan(
		&user.ID,
		&user.Name,
		&user.Email,
		&user.PasswordHash,
		&user.Role,
		&user.CreatedAt,
		&user.UpdatedAt,
	)
	
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return user, errors.New("user not found")
		}
		return user, errors.New("failed to get user")
	}
	
	return user, nil
}

// getUserByEmail retrieves a user by email from the database
func (h *Handler) getUserByEmail(ctx context.Context, email string) (models.User, error) {
	var user models.User
	err := h.db.Pool.QueryRow(ctx, QueryGetUserByEmail, email).Scan(
		&user.ID,
		&user.Name,
		&user.Email,
		&user.PasswordHash,
		&user.Role,
		&user.CreatedAt,
		&user.UpdatedAt,
	)
	
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return user, errors.New("user not found")
		}
		return user, errors.New("failed to get user")
	}
	
	return user, nil
}

// emailExists checks if an email already exists
func (h *Handler) emailExists(ctx context.Context, email string) (bool, error) {
	var exists bool
	err := h.db.Pool.QueryRow(ctx, QueryEmailExists, email).Scan(&exists)
	
	if err != nil {
		return false, errors.New("failed to check email")
	}
	
	return exists, nil
}

// emailExistsExcept checks if an email exists for any user except the specified user
func (h *Handler) emailExistsExcept(ctx context.Context, email string, userID string) (bool, error) {
	var exists bool
	err := h.db.Pool.QueryRow(ctx, QueryEmailExistsExcept, email, userID).Scan(&exists)
	
	if err != nil {
		return false, errors.New("failed to check email")
	}
	
	return exists, nil
}

// getAllUsers retrieves all users from the database
func (h *Handler) getAllUsers(ctx context.Context) ([]models.User, error) {
	rows, err := h.db.Pool.Query(ctx, QueryGetAllUsers)
	if err != nil {
		return nil, errors.New("failed to get users")
	}
	defer rows.Close()

	var users []models.User
	for rows.Next() {
		var user models.User
		if err := rows.Scan(
			&user.ID,
			&user.Name,
			&user.Email,
			&user.Role,
			&user.CreatedAt,
			&user.UpdatedAt,
		); err != nil {
			return nil, errors.New("failed to scan user")
		}
		users = append(users, user)
	}

	return users, nil
}