package user

import (
	"fmt"
	"net/http"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/henrythedeveloper/bus-it-ticket/internal/api/middleware/auth"
	"github.com/henrythedeveloper/bus-it-ticket/internal/models"
)

// UpdateUser updates a user
func (h *Handler) UpdateUser(c echo.Context) error {
	userID := c.Param("id")
	if userID == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "missing user ID")
	}

	// Get current user ID and role from context
	currentUserID, err := auth.GetUserIDFromContext(c)
	if err != nil {
		return err
	}
	currentUserRole, err := auth.GetUserRoleFromContext(c)
	if err != nil {
		return err
	}

	// Users can only update their own profile unless they're admins
	if currentUserID != userID && currentUserRole != models.RoleAdmin {
		return echo.NewHTTPError(http.StatusForbidden, "unauthorized to update other users")
	}

	var userUpdate models.UserCreate
	if err := c.Bind(&userUpdate); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}

	ctx := c.Request().Context()

	// Check if user exists using the helper function
	user, err := h.getUserByID(ctx, userID)
	if err != nil {
		if err.Error() == "user not found" {
			return echo.NewHTTPError(http.StatusNotFound, "user not found")
		}
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to get user")
	}

	// Check if email is already used by another user using the helper function
	if userUpdate.Email != "" && userUpdate.Email != user.Email {
		exists, err := h.emailExistsExcept(ctx, userUpdate.Email, userID)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
		}
		if exists {
			return echo.NewHTTPError(http.StatusConflict, "email already exists")
		}
	}

	// Only admins can change roles
	if userUpdate.Role != "" && userUpdate.Role != user.Role && currentUserRole != models.RoleAdmin {
		return echo.NewHTTPError(http.StatusForbidden, "unauthorized to change role")
	}

	// Build update query
	query := `UPDATE users SET updated_at = $1`
	args := []interface{}{time.Now()}
	paramCount := 1

	if userUpdate.Name != "" {
		paramCount++
		query += fmt.Sprintf(", name = $%d", paramCount)
		args = append(args, userUpdate.Name)
	}

	if userUpdate.Email != "" {
		paramCount++
		query += fmt.Sprintf(", email = $%d", paramCount)
		args = append(args, userUpdate.Email)
	}

	if userUpdate.Password != "" {
		passwordHash, err := h.authService.HashPassword(userUpdate.Password)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "failed to hash password")
		}
		paramCount++
		query += fmt.Sprintf(", password_hash = $%d", paramCount)
		args = append(args, passwordHash)
	}

	if userUpdate.Role != "" {
		paramCount++
		query += fmt.Sprintf(", role = $%d", paramCount)
		args = append(args, userUpdate.Role)
	}

	paramCount++
	query += fmt.Sprintf(" WHERE id = $%d RETURNING id, name, email, role, created_at, updated_at", paramCount)
	args = append(args, userID)

	// Update user in database
	var updatedUser models.User
	err = h.db.Pool.QueryRow(ctx, query, args...).Scan(
		&updatedUser.ID,
		&updatedUser.Name,
		&updatedUser.Email,
		&updatedUser.Role,
		&updatedUser.CreatedAt,
		&updatedUser.UpdatedAt,
	)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to update user")
	}

	return c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Message: "User updated successfully",
		Data:    updatedUser,
	})
}

// DeleteUser deletes a user
func (h *Handler) DeleteUser(c echo.Context) error {
	userID := c.Param("id")
	if userID == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "missing user ID")
	}

	ctx := c.Request().Context()

	// Delete user from database
	commandTag, err := h.db.Pool.Exec(ctx, `
		DELETE FROM users
		WHERE id = $1
	`, userID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to delete user")
	}

	if commandTag.RowsAffected() == 0 {
		return echo.NewHTTPError(http.StatusNotFound, "user not found")
	}

	return c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Message: "User deleted successfully",
	})
}