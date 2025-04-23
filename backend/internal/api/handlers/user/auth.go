// backend/internal/api/handlers/user/auth.go
// ==========================================================================
// Handler function for user authentication (login).
// ==========================================================================

package user

import (
	"errors"
	"log/slog"
	"net/http"
	"time"

	"github.com/henrythedeveloper/it-ticket-system/internal/models" // Data models
	"github.com/labstack/echo/v4"
)

// --- Handler Function ---

// Login handles the HTTP request for user login.
// It verifies credentials against the database and generates a JWT token upon success.
//
// Request Body:
//   - Expects JSON matching models.UserLogin (email, password).
//
// Returns:
//   - JSON response containing the access token, token type, expiration time,
//     and basic user information (excluding password hash), or an error response.
func (h *Handler) Login(c echo.Context) error {
	ctx := c.Request().Context()
	logger := slog.With("handler", "Login")

	// --- 1. Bind and Validate Request Body ---
	var loginReq models.UserLogin
	if err := c.Bind(&loginReq); err != nil {
		logger.WarnContext(ctx, "Failed to bind request body", "error", err)
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid request body: "+err.Error())
	}
	// TODO: Add validation for email format and password presence if not handled by Echo middleware

	logger.DebugContext(ctx, "Login attempt received", "email", loginReq.Email)

	// --- 2. Retrieve User by Email ---
	// Use the helper function which includes the password hash
	user, err := getUserByEmail(ctx, h.db, loginReq.Email)
	if err != nil {
		if errors.Is(err, errors.New("user not found")) {
			logger.WarnContext(ctx, "Login failed: User not found", "email", loginReq.Email)
			// Return generic unauthorized error for security
			return echo.NewHTTPError(http.StatusUnauthorized, "Invalid email or password.")
		}
		// Log unexpected database errors
		logger.ErrorContext(ctx, "Failed to retrieve user by email during login", "error", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "An internal error occurred.")
	}

	// --- 3. Verify Password ---
	// Use the injected authService to check the password
	err = h.authService.CheckPassword(user.PasswordHash, loginReq.Password)
	if err != nil {
		// Password mismatch (bcrypt.CompareHashAndPassword returns an error)
		logger.WarnContext(ctx, "Login failed: Invalid password", "email", loginReq.Email, "userID", user.ID)
		// Return generic unauthorized error
		return echo.NewHTTPError(http.StatusUnauthorized, "Invalid email or password.")
	}

	// --- 4. Generate JWT Token ---
	// Use the injected authService to generate the token
	token, err := h.authService.GenerateToken(user)
	if err != nil {
		logger.ErrorContext(ctx, "Failed to generate JWT token", "userID", user.ID, "error", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to process login.")
	}

	// --- 5. Prepare and Return Success Response ---
	// Define the structure for the login response payload
	type LoginResponseData struct {
		AccessToken string      `json:"access_token"`
		TokenType   string      `json:"token_type"`
		ExpiresAt   string      `json:"expires_at"` // Format as ISO 8601 string
		User        models.User `json:"user"`       // User details (excluding password hash)
	}

	// Remove password hash before sending user data in response
	user.PasswordHash = ""

	responsePayload := LoginResponseData{
		AccessToken: token.AccessToken,
		TokenType:   token.TokenType,
		ExpiresAt:   token.ExpiresAt.Format(time.RFC3339), // Standard ISO 8601 format
		User:        user,
	}

	logger.InfoContext(ctx, "User logged in successfully", "userID", user.ID, "email", user.Email)
	return c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Message: "Login successful.",
		Data:    responsePayload,
	})
}
