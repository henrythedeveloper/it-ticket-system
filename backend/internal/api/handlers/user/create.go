package user

import (
	"net/http"
	"time"

	"github.com/henrythedeveloper/bus-it-ticket/internal/models"
	"github.com/labstack/echo/v4"
)

// CreateUser creates a new user
func (h *Handler) CreateUser(c echo.Context) error {
	var userCreate models.UserCreate
	if err := c.Bind(&userCreate); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}

	ctx := c.Request().Context()

	// Check if email already exists using the helper function
	exists, err := h.emailExists(ctx, userCreate.Email)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	if exists {
		return echo.NewHTTPError(http.StatusConflict, "email already exists")
	}

	// Hash password
	passwordHash, err := h.authService.HashPassword(userCreate.Password)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to hash password")
	}

	// Create user in database
	var user models.User
	err = h.db.Pool.QueryRow(ctx, QueryCreateUser,
		userCreate.Name,
		userCreate.Email,
		passwordHash,
		userCreate.Role,
		time.Now(),
		time.Now(),
	).Scan(
		&user.ID,
		&user.Name,
		&user.Email,
		&user.Role,
		&user.CreatedAt,
		&user.UpdatedAt,
	)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to create user")
	}

	return c.JSON(http.StatusCreated, models.APIResponse{
		Success: true,
		Message: "User created successfully",
		Data:    user,
	})
}
