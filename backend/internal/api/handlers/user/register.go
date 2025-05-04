// backend/internal/api/handlers/user/register.go
// ==========================================================================
// Handler function for public user registration.
// Creates a new user with the default 'Staff' role.
// ==========================================================================

package user

import (
	"log/slog"
	"net/http"
	"time"
	"context"

	"github.com/henrythedeveloper/it-ticket-system/internal/models" // Data models
	"github.com/labstack/echo/v4"
)

// RegisterUser handles the HTTP request for public user registration.
//
// Request Body:
//   - Expects JSON matching models.UserRegister (name, email, password, confirmPassword).
//
// Returns:
//   - JSON response indicating success or failure, potentially including basic user info
//     (excluding password hash) upon successful registration.
func (h *Handler) RegisterUser(c echo.Context) error {
	ctx := c.Request().Context()
	logger := slog.With("handler", "RegisterUser")

	// --- 1. Bind and Validate Request Body ---
	var userRegister models.UserRegister
	if err := c.Bind(&userRegister); err != nil {
		logger.WarnContext(ctx, "Failed to bind registration request body", "error", err)
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid request body: "+err.Error())
	}

	// Basic validation (more complex validation can be added via a library)
	if userRegister.Password != userRegister.ConfirmPassword {
		logger.WarnContext(ctx, "Password confirmation mismatch")
		return echo.NewHTTPError(http.StatusBadRequest, "Passwords do not match.")
	}
	if len(userRegister.Password) < 8 { // Ensure password length check
		logger.WarnContext(ctx, "Password too short during registration")
		return echo.NewHTTPError(http.StatusBadRequest, "Password must be at least 8 characters long.")
	}

	logger.DebugContext(ctx, "Registration request received", "email", userRegister.Email, "name", userRegister.Name)

	// --- 2. Check if Email Already Exists ---
	exists, err := emailExists(ctx, h.db, userRegister.Email)
	if err != nil {
		logger.ErrorContext(ctx, "Failed to check email existence during registration", "error", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "Database error checking email.")
	}
	if exists {
		logger.WarnContext(ctx, "Registration attempt with existing email", "email", userRegister.Email)
		return echo.NewHTTPError(http.StatusConflict, "Email address is already registered.")
	}

	// --- 3. Hash Password ---
	passwordHash, err := h.authService.HashPassword(userRegister.Password)
	if err != nil {
		logger.ErrorContext(ctx, "Failed to hash password during registration", "error", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to process registration data.")
	}

	// --- 4. Insert User into Database with Default Role 'Staff' ---
	var createdUser models.User
	// ** CHANGE: Set default role to Staff **
	defaultRole := models.RoleStaff
	err = h.db.Pool.QueryRow(ctx, QueryCreateUser, // Use the existing create user query
		userRegister.Name,
		userRegister.Email,
		passwordHash,
		defaultRole, // Use the default role variable
		time.Now(),  // created_at
		time.Now(),  // updated_at
	).Scan(
		&createdUser.ID, &createdUser.Name, &createdUser.Email,
		&createdUser.Role, &createdUser.CreatedAt, &createdUser.UpdatedAt,
	)
	if err != nil {
		logger.ErrorContext(ctx, "Failed to insert user during registration", "email", userRegister.Email, "error", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "Database error: failed to create user account.")
	}

	// --- 5. Send Confirmation Email (Asynchronous) ---
	go func(email, name string) {
		// Use a background context for the goroutine
		bgCtx := context.Background()
		emailLogger := slog.With("operation", "SendRegistrationConfirmation", "userID", createdUser.ID)
		if emailErr := h.emailService.SendRegistrationConfirmation(email, name); emailErr != nil {
			emailLogger.ErrorContext(bgCtx, "Failed to send registration confirmation email", "recipient", email, "error", emailErr)
		} else {
			emailLogger.InfoContext(bgCtx, "Sent registration confirmation email", "recipient", email)
		}
	}(createdUser.Email, createdUser.Name)

	// --- 6. Return Success Response ---
	// Exclude password hash from the response
	createdUser.PasswordHash = ""
	logger.InfoContext(ctx, "User registered successfully", "userID", createdUser.ID, "email", createdUser.Email, "role", createdUser.Role)
	return c.JSON(http.StatusCreated, models.APIResponse{
		Success: true,
		Message: "Registration successful! Please check your email for confirmation.",
		Data:    createdUser, // Return basic user info
	})
}

