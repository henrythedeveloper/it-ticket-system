package user

import (
    "net/http"
    "time"

    "github.com/labstack/echo/v4"
    "github.com/henrythedeveloper/bus-it-ticket/internal/models"
)

// Login handles user login
func (h *Handler) Login(c echo.Context) error {
	var loginReq models.UserLogin
	if err := c.Bind(&loginReq); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}

	ctx := c.Request().Context()

	// Get user by email using the helper function
	user, err := h.getUserByEmail(ctx, loginReq.Email)
	if err != nil {
		if err.Error() == "user not found" {
			return echo.NewHTTPError(http.StatusUnauthorized, "invalid email or password")
		}
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to get user")
	}

	// Check password
	if err := h.authService.CheckPassword(user.PasswordHash, loginReq.Password); err != nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "invalid email or password")
	}

	// Generate JWT token
	token, err := h.authService.GenerateToken(user)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to generate token")
	}

	type LoginResponse struct {
		AccessToken string     `json:"access_token"`
		TokenType   string     `json:"token_type"`
		ExpiresAt   string     `json:"expires_at"`
		User        models.User `json:"user"`
	}
	
	// Combine token and user data
	response := LoginResponse{
	    AccessToken: token.AccessToken,
	    TokenType:   token.TokenType,
	    ExpiresAt:   token.ExpiresAt.Format(time.RFC3339),
	    User:        user,
	}
	
	return c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    response,
	})
}