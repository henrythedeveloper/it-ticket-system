// backend/internal/api/handlers/user/query.go
// ==========================================================================
// Handler functions for querying user data (listing, specific user, current user).
// ==========================================================================

package user

import (
	"errors"
	"log/slog"
	"net/http"

	"github.com/henrythedeveloper/it-ticket-system/internal/api/middleware/auth" // Auth helpers
	"github.com/henrythedeveloper/it-ticket-system/internal/models"              // Data models
	"github.com/labstack/echo/v4"
)

// --- Handler Functions ---

// GetAllUsers retrieves a list of all users in the system.
// This endpoint is restricted to Admin users via middleware.
//
// Returns:
//   - JSON response containing an array of user objects (excluding password hashes)
//     or an error response.
func (h *Handler) GetAllUsers(c echo.Context) error {
	ctx := c.Request().Context()
	logger := slog.With("handler", "GetAllUsers")

	// --- 1. Fetch Users from Database ---
	// Use the helper function which excludes password hashes
	users, err := getAllUsers(ctx, h.db)
	if err != nil {
		// Error is already logged in the helper
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to retrieve users.")
	}

	// --- 2. Return Success Response ---
	logger.InfoContext(ctx, "Retrieved all users", "count", len(users))
	return c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    users,
	})
}

// GetUserByID retrieves details for a specific user by their ID.
// Access control (Admin or self) might be enforced here or via middleware/routing setup.
// Currently allows any authenticated user to fetch any user by ID if route is hit.
// Consider adding admin/self check if needed.
//
// Path Parameters:
//   - id: The UUID of the user to retrieve.
//
// Returns:
//   - JSON response containing the user object (excluding password hash) or an error response.
func (h *Handler) GetUserByID(c echo.Context) error {
	ctx := c.Request().Context()
	targetUserID := c.Param("id")
	logger := slog.With("handler", "GetUserByID", "targetUserID", targetUserID)

	// --- 1. Input Validation ---
	if targetUserID == "" {
		logger.WarnContext(ctx, "Missing user ID in request path")
		return echo.NewHTTPError(http.StatusBadRequest, "Missing user ID.")
	}

	// --- Optional: Authorization Check (Example: Admin or Self) ---
	// requestingUserID, _ := auth.GetUserIDFromContext(c) // Ignore error for now
	// requestingUserRole, _ := auth.GetUserRoleFromContext(c)
	// if requestingUserRole != models.RoleAdmin && requestingUserID != targetUserID {
	//     logger.WarnContext(ctx, "Unauthorized attempt to get user data", "requestingUserID", requestingUserID)
	//     return echo.NewHTTPError(http.StatusForbidden, "Not authorized to view this user's details.")
	// }

	// --- 2. Fetch User from Database ---
	// Use the helper function which excludes password hash
	user, err := getUserByID(ctx, h.db, targetUserID)
	if err != nil {
		// Error logged in helper
		if errors.Is(err, errors.New("user not found")) {
			return echo.NewHTTPError(http.StatusNotFound, "User not found.")
		}
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to retrieve user details.")
	}

	// --- 3. Return Success Response ---
	logger.InfoContext(ctx, "Retrieved user by ID successfully", "userID", user.ID)
	return c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    user,
	})
}

// GetCurrentUser retrieves the profile details of the currently authenticated user.
// Relies on the JWT middleware to extract the user ID from the token.
//
// Returns:
//   - JSON response containing the current user's object (excluding password hash)
//     or an error response if not authenticated or user not found.
func (h *Handler) GetCurrentUser(c echo.Context) error {
	ctx := c.Request().Context()
	logger := slog.With("handler", "GetCurrentUser")

	// --- 1. Get User ID from Context (Set by JWT Middleware) ---
	userID, err := auth.GetUserIDFromContext(c)
	if err != nil {
		// Error should be logged by GetUserIDFromContext or the middleware
		// Typically returns 401 if ID isn't found
		return err
	}
	logger = logger.With("userID", userID) // Add userID to logger context

	// --- 2. Fetch User from Database ---
	// Use the helper function which excludes password hash
	user, err := getUserByID(ctx, h.db, userID)
	if err != nil {
		// Error logged in helper
		if errors.Is(err, errors.New("user not found")) {
			// This case is unusual if the token was valid but user doesn't exist
			logger.ErrorContext(ctx, "Authenticated user not found in database", "error", err)
			// Log out the potentially invalid session state
			auth.LogoutUser(c) // Assuming a helper exists to clear context/session
			return echo.NewHTTPError(http.StatusUnauthorized, "User associated with token not found.")
		}
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to retrieve user profile.")
	}

	// --- 3. Return Success Response ---
	logger.InfoContext(ctx, "Retrieved current user profile successfully")
	return c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    user,
	})
}
