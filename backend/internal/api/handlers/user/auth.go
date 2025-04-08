package user

import (
	"net/http"

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

	return c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    token,
	})
}