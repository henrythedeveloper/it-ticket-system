// backend/internal/api/handlers/user/create.go
// ==========================================================================
// Handler function for creating new users (Admin only).
// ==========================================================================

package user

import (
	"log/slog"
	"net/http"
	"time"

	"github.com/henrythedeveloper/it-ticket-system/internal/models" // Data models
	"github.com/labstack/echo/v4"
)

// --- Handler Function ---

// CreateUser handles the HTTP request to create a new user account.
// This endpoint is restricted to Admin users via middleware.
//
// Request Body:
//   - Expects JSON matching models.UserCreate (name, email, password, role).
//
// Returns:
//   - JSON response containing the newly created user details (excluding password hash)
//     or an error response.
func (h *Handler) CreateUser(c echo.Context) error {
	ctx := c.Request().Context()
	logger := slog.With("handler", "CreateUser")

	// --- 1. Bind and Validate Request Body ---
	var userCreate models.UserCreate
	if err := c.Bind(&userCreate); err != nil {
		logger.WarnContext(ctx, "Failed to bind request body", "error", err)
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid request body: "+err.Error())
	}
	// TODO: Add validation for UserCreate fields (e.g., password complexity, role value)
	// Example:
	// if err := validate.Struct(userCreate); err != nil {
	//     logger.WarnContext(ctx, "Request body validation failed", "error", err)
	//     return echo.NewHTTPError(http.StatusBadRequest, "Validation errors: "+err.Error())
	// }
	if userCreate.Role != models.RoleAdmin && userCreate.Role != models.RoleStaff {
		logger.WarnContext(ctx, "Invalid role specified", "role", userCreate.Role)
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid user role specified. Must be 'Admin' or 'Staff'.")
	}
	if len(userCreate.Password) < 8 { // Basic password length check
		logger.WarnContext(ctx, "Password too short")
		return echo.NewHTTPError(http.StatusBadRequest, "Password must be at least 8 characters long.")
	}

	logger.DebugContext(ctx, "Create user request received", "email", userCreate.Email, "role", userCreate.Role)

	// --- 2. Check if Email Already Exists ---
	// Use the helper function for clarity
	exists, err := emailExists(ctx, h.db, userCreate.Email)
	if err != nil {
		logger.ErrorContext(ctx, "Failed to check email existence", "error", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "Database error checking email.")
	}
	if exists {
		logger.WarnContext(ctx, "Attempted to create user with existing email", "email", userCreate.Email)
		return echo.NewHTTPError(http.StatusConflict, "Email address is already in use.")
	}

	// --- 3. Hash Password ---
	// Use the injected authService for hashing
	passwordHash, err := h.authService.HashPassword(userCreate.Password)
	if err != nil {
		logger.ErrorContext(ctx, "Failed to hash password", "error", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to process user data.")
	}

	// --- 4. Insert User into Database ---
	var createdUser models.User
	err = h.db.Pool.QueryRow(ctx, QueryCreateUser,
		userCreate.Name,
		userCreate.Email,
		passwordHash,
		userCreate.Role,
		time.Now(), // created_at
		time.Now(), // updated_at
	).Scan(
		&createdUser.ID, &createdUser.Name, &createdUser.Email,
		&createdUser.Role, &createdUser.CreatedAt, &createdUser.UpdatedAt,
	)
	if err != nil {
		logger.ErrorContext(ctx, "Failed to insert user into database", "email", userCreate.Email, "error", err)
		// TODO: Check for specific DB errors if needed
		return echo.NewHTTPError(http.StatusInternalServerError, "Database error: failed to create user.")
	}

	// --- 5. Return Success Response ---
	// Password hash is automatically excluded as it's not scanned back
	logger.InfoContext(ctx, "User created successfully", "userID", createdUser.ID, "email", createdUser.Email, "role", createdUser.Role)
	return c.JSON(http.StatusCreated, models.APIResponse{
		Success: true,
		Message: "User created successfully.",
		Data:    createdUser, // Return the created user object (without hash)
	})
}
