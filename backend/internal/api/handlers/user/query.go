package user

import (
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/henrythedeveloper/bus-it-ticket/internal/api/middleware/auth"
	"github.com/henrythedeveloper/bus-it-ticket/internal/models"
)

// GetAllUsers returns all users
func (h *Handler) GetAllUsers(c echo.Context) error {
	ctx := c.Request().Context()

	// Get all users using the helper function
	users, err := h.getAllUsers(ctx)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    users,
	})
}

// GetUserByID returns a user by ID
func (h *Handler) GetUserByID(c echo.Context) error {
	userID := c.Param("id")
	if userID == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "missing user ID")
	}

	ctx := c.Request().Context()

	// Get user from database using the helper function
	user, err := h.getUserByID(ctx, userID)
	if err != nil {
		if err.Error() == "user not found" {
			return echo.NewHTTPError(http.StatusNotFound, "user not found")
		}
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    user,
	})
}

// GetCurrentUser returns the current authenticated user
func (h *Handler) GetCurrentUser(c echo.Context) error {
	userID, err := auth.GetUserIDFromContext(c)
	if err != nil {
		return err
	}

	ctx := c.Request().Context()

	// Get user from database using the helper function
	user, err := h.getUserByID(ctx, userID)
	if err != nil {
		if err.Error() == "user not found" {
			return echo.NewHTTPError(http.StatusNotFound, "user not found")
		}
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    user,
	})
}