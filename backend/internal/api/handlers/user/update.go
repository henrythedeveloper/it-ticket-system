// backend/internal/api/handlers/user/update.go
// ==========================================================================
// Handler functions for modifying user accounts (updating details, deleting).
// Includes authorization checks.
// ==========================================================================

package user

import (
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/henrythedeveloper/it-ticket-system/internal/api/middleware/auth" // Auth helpers
	"github.com/henrythedeveloper/it-ticket-system/internal/models"              // Data models
	"github.com/jackc/pgx/v5"
	"github.com/labstack/echo/v4"
)

// --- Handler Functions ---

// UpdateUser handles requests to modify a user's details (name, email, role, password).
// Performs authorization checks: Admins can update anyone, regular users can only update themselves.
//
// Path Parameters:
//   - id: The UUID of the user to update.
//
// Request Body:
//   - Expects JSON matching models.UserCreate (reused, but password is optional).
//
// Returns:
//   - JSON response with the updated user details (excluding password hash) or an error response.
func (h *Handler) UpdateUser(c echo.Context) error {
	ctx := c.Request().Context()
	targetUserID := c.Param("id")
	logger := slog.With("handler", "UpdateUser", "targetUserID", targetUserID)

	// --- 1. Input Validation & Binding ---
	if targetUserID == "" {
		logger.WarnContext(ctx, "Missing user ID in request path")
		return echo.NewHTTPError(http.StatusBadRequest, "Missing user ID.")
	}

	var userUpdate models.UserCreate // Reuse UserCreate, password is optional here
	if err := c.Bind(&userUpdate); err != nil {
		logger.WarnContext(ctx, "Failed to bind request body", "error", err)
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid request body: "+err.Error())
	}
	// TODO: Add validation for update fields (e.g., non-empty name/email if provided)

	// --- 2. Get Requesting User Context & Permissions ---
	requestingUserID, err := auth.GetUserIDFromContext(c)
	if err != nil {
		return err
	}
	requestingUserRole, err := auth.GetUserRoleFromContext(c)
	if err != nil {
		return err
	}
	logger.DebugContext(ctx, "Update request initiated", "requestingUserID", requestingUserID, "requestingUserRole", requestingUserRole)

	// --- 3. Authorization Check ---
	// Users can only update their own profile unless they are Admins.
	if requestingUserRole != models.RoleAdmin && requestingUserID != targetUserID {
		logger.WarnContext(ctx, "Unauthorized attempt to update another user")
		return echo.NewHTTPError(http.StatusForbidden, "Not authorized to update this user.")
	}

	// --- 4. Fetch Current User State (for comparison and checks) ---
	currentUserData, err := getUserByID(ctx, h.db, targetUserID) // Fetch current data (no password needed yet)
	if err != nil {
		// Error logged in helper
		if errors.Is(err, errors.New("user not found")) {
			return echo.NewHTTPError(http.StatusNotFound, "User not found.")
		}
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to retrieve user for update.")
	}

	// --- 5. Perform Specific Update Checks ---
	// Check if email is being changed and if the new email is already taken
	if userUpdate.Email != "" && userUpdate.Email != currentUserData.Email {
		exists, checkErr := emailExistsExcept(ctx, h.db, userUpdate.Email, targetUserID)
		if checkErr != nil {
			logger.ErrorContext(ctx, "Failed to check email existence during update", "error", checkErr)
			return echo.NewHTTPError(http.StatusInternalServerError, "Database error checking email.")
		}
		if exists {
			logger.WarnContext(ctx, "Attempted to update email to one already in use", "newEmail", userUpdate.Email)
			return echo.NewHTTPError(http.StatusConflict, "Email address is already in use by another account.")
		}
	}

	// Check if role is being changed and if the requester has permission
	if userUpdate.Role != "" && userUpdate.Role != currentUserData.Role {
		if requestingUserRole != models.RoleAdmin {
			logger.WarnContext(ctx, "Unauthorized attempt to change user role", "requestingUserID", requestingUserID)
			return echo.NewHTTPError(http.StatusForbidden, "Not authorized to change user roles.")
		}
		// Validate the new role value
		if userUpdate.Role != models.RoleAdmin && userUpdate.Role != models.RoleStaff {
			logger.WarnContext(ctx, "Invalid role specified in update", "role", userUpdate.Role)
			return echo.NewHTTPError(http.StatusBadRequest, "Invalid user role specified. Must be 'Admin' or 'Staff'.")
		}
	}

	// --- 6. Build Dynamic Update Query ---
	queryBuilder := strings.Builder{}
	queryBuilder.WriteString("UPDATE users SET updated_at = $1")
	args := []interface{}{time.Now()} // $1 is always updated_at
	paramCount := 1

	// Add fields to update only if they are provided in the request body
	if userUpdate.Name != "" && userUpdate.Name != currentUserData.Name {
		paramCount++
		queryBuilder.WriteString(fmt.Sprintf(", name = $%d", paramCount))
		args = append(args, userUpdate.Name)
	}
	if userUpdate.Email != "" && userUpdate.Email != currentUserData.Email {
		paramCount++
		queryBuilder.WriteString(fmt.Sprintf(", email = $%d", paramCount))
		args = append(args, userUpdate.Email)
	}
	if userUpdate.Role != "" && userUpdate.Role != currentUserData.Role {
		paramCount++
		queryBuilder.WriteString(fmt.Sprintf(", role = $%d", paramCount))
		args = append(args, userUpdate.Role)
	}
	// Handle password update separately
	if userUpdate.Password != "" {
		// Hash the new password
		newPasswordHash, hashErr := h.authService.HashPassword(userUpdate.Password)
		if hashErr != nil {
			logger.ErrorContext(ctx, "Failed to hash new password during update", "error", hashErr)
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to process password.")
		}
		paramCount++
		queryBuilder.WriteString(fmt.Sprintf(", password_hash = $%d", paramCount))
		args = append(args, newPasswordHash)
	}

	// Only execute update if there are actual changes (besides updated_at)
	if paramCount == 1 {
		logger.InfoContext(ctx, "No update required, request data matches current user data.")
		// Return current user data as if updated successfully
		return c.JSON(http.StatusOK, models.APIResponse{
			Success: true,
			Message: "No changes detected.",
			Data:    currentUserData, // Return existing data
		})
	}

	// Add WHERE clause
	paramCount++
	queryBuilder.WriteString(fmt.Sprintf(" WHERE id = $%d", paramCount))
	args = append(args, targetUserID)

	// Add RETURNING clause to get updated data
	queryBuilder.WriteString(" RETURNING id, name, email, role, created_at, updated_at")

	// --- 7. Execute Update Query ---
	finalQuery := queryBuilder.String()
	logger.DebugContext(ctx, "Executing user update query", "query", finalQuery, "argsCount", len(args))

	var updatedUser models.User
	err = h.db.Pool.QueryRow(ctx, finalQuery, args...).Scan(
		&updatedUser.ID, &updatedUser.Name, &updatedUser.Email,
		&updatedUser.Role, &updatedUser.CreatedAt, &updatedUser.UpdatedAt,
	)
	if err != nil {
		// Check if the error is because the user was not found (should be rare after initial check)
		if errors.Is(err, pgx.ErrNoRows) {
			logger.WarnContext(ctx, "User not found during final update query execution")
			return echo.NewHTTPError(http.StatusNotFound, "User not found.")
		}
		logger.ErrorContext(ctx, "Failed to execute user update query", "error", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "Database error: failed to update user.")
	}

	// --- 8. Return Success Response ---
	logger.InfoContext(ctx, "User updated successfully", "userID", updatedUser.ID)
	return c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Message: "User updated successfully.",
		Data:    updatedUser, // Return updated user data (without hash)
	})
}

// DeleteUser handles requests to delete a user account.
// Restricted to Admin users via middleware.
//
// Path Parameters:
//   - id: The UUID of the user to delete.
//
// Returns:
//   - JSON success message or an error response.
func (h *Handler) DeleteUser(c echo.Context) error {
	ctx := c.Request().Context()
	targetUserID := c.Param("id")
	logger := slog.With("handler", "DeleteUser", "targetUserID", targetUserID)

	// --- 1. Input Validation ---
	if targetUserID == "" {
		logger.WarnContext(ctx, "Missing user ID in request path")
		return echo.NewHTTPError(http.StatusBadRequest, "Missing user ID.")
	}

	// --- 2. Prevent Self-Deletion ---
	requestingUserID, err := auth.GetUserIDFromContext(c)
	if err == nil && requestingUserID == targetUserID { // Check if error is nil before comparing
		logger.WarnContext(ctx, "Attempted self-deletion", "userID", requestingUserID)
		return echo.NewHTTPError(http.StatusBadRequest, "You cannot delete your own account.")
	}
	// Note: Admin role is already checked by middleware applied in RegisterRoutes

	// --- 3. Execute Delete Query ---
	// TODO: Consider implications of deleting a user.
	// - What happens to tickets/tasks created by or assigned to them?
	// - Foreign key constraints might need ON DELETE SET NULL or ON DELETE RESTRICT.
	// - Current setup likely relies on ON DELETE CASCADE or manual cleanup.
	// - For tasks/tickets, setting assigned_to_user_id/created_by_user_id to NULL might be preferable.
	// - This requires altering FK constraints if they are currently RESTRICT or CASCADE.
	commandTag, err := h.db.Pool.Exec(ctx, QueryDeleteUser, targetUserID)
	if err != nil {
		logger.ErrorContext(ctx, "Failed to execute user deletion query", "error", err)
		// TODO: Handle specific DB errors (e.g., foreign key constraints if not handled by DB)
		return echo.NewHTTPError(http.StatusInternalServerError, "Database error: failed to delete user.")
	}

	// Check if any row was actually deleted
	if commandTag.RowsAffected() == 0 {
		logger.WarnContext(ctx, "User deletion affected 0 rows, user likely not found")
		return echo.NewHTTPError(http.StatusNotFound, "User not found.")
	}

	// --- 4. Return Success Response ---
	logger.InfoContext(ctx, "User deleted successfully")
	return c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Message: "User deleted successfully.",
	})
}
