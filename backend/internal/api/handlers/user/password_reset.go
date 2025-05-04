// backend/internal/api/handlers/user/password_reset.go
// ==========================================================================
// Handler functions for requesting and performing password resets.
// **REVISED**: Switched to storing and querying RAW reset tokens in 'token' column.
// ==========================================================================

package user

import (
	"context"
	"database/sql" // Needed for sql.ErrNoRows comparison
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/henrythedeveloper/it-ticket-system/internal/models" // Data models
	"github.com/jackc/pgx/v5"
	"github.com/labstack/echo/v4"
)

const (
	// Define password reset token validity duration
	passwordResetTokenValidity = 1 * time.Hour

	// --- SQL Query Constants for Password Reset (Using RAW Token) ---
	// *** Use 'token' column (VARCHAR) ***
	QueryInsertPasswordResetToken = `
		INSERT INTO password_reset_tokens (token, user_id, expires_at, created_at)
		VALUES ($1, $2, $3, $4)`

	// *** Use 'token' column ***
	QueryFindPasswordResetToken = `
		SELECT user_id, expires_at FROM password_reset_tokens WHERE token = $1` // Query by raw token

	// *** Use 'token' column ***
	QueryDeletePasswordResetToken = `
		DELETE FROM password_reset_tokens WHERE token = $1` // Delete by raw token

	QueryDeleteExpiredTokens = `
		DELETE FROM password_reset_tokens WHERE expires_at < NOW()`

	QueryUpdateUserPassword = `
		UPDATE users SET password_hash = $1, updated_at = $2 WHERE id = $3`
)

// RequestPasswordReset handles the request to initiate a password reset.
// It finds the user by email, generates a reset token, stores it, and sends an email.
func (h *Handler) RequestPasswordReset(c echo.Context) error {
	ctx := c.Request().Context()
	logger := slog.With("handler", "RequestPasswordReset")

	var req models.PasswordResetRequest
	if err := c.Bind(&req); err != nil {
		logger.WarnContext(ctx, "Failed to bind request body", "error", err)
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid request body: "+err.Error())
	}

	logger.InfoContext(ctx, "Password reset requested", "email", req.Email)

	// --- Find User by Email ---
	user, err := getUserByEmail(ctx, h.db, req.Email)
	if err != nil {
		if errors.Is(err, errors.New("user not found")) {
			logger.WarnContext(ctx, "Password reset requested for non-existent email", "email", req.Email)
			return c.JSON(http.StatusOK, models.APIResponse{
				Success: true, // Lie about success for security
				Message: "If an account with that email exists, a password reset link has been sent.",
			})
		}
		logger.ErrorContext(ctx, "Database error looking up user for password reset", "email", req.Email, "error", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "An internal error occurred.")
	}

	// --- Generate and Store Token ---
	// Generate a secure random token (the raw token sent to the user AND stored)
	rawToken, err := h.authService.GenerateSecureRandomToken(32)
	if err != nil {
		logger.ErrorContext(ctx, "Failed to generate secure token", "userID", user.ID, "error", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to initiate password reset.")
	}

	// *** No Hashing Needed Here ***

	expiresAt := time.Now().Add(passwordResetTokenValidity)

	// *** Store the RAW token, user ID, and expiry in the database 'token' column ***
	_, err = h.db.Pool.Exec(ctx, QueryInsertPasswordResetToken,
		rawToken, user.ID, expiresAt, time.Now(), // Store rawToken
	)
	if err != nil {
		// Check for potential primary key violation (token collision - extremely rare but possible)
		logger.ErrorContext(ctx, "Failed to store password reset token", "userID", user.ID, "error", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to initiate password reset.")
	}

	// --- Construct Reset Link (using the RAW token) ---
	resetLink := fmt.Sprintf("%s/reset-password/%s", h.config.Server.PortalBaseURL, rawToken)
	logger.DebugContext(ctx, "Generated password reset link", "userID", user.ID) // Avoid logging link/token in prod

	// --- Send Password Reset Email (Asynchronous) ---
	go func(email, name, link string) {
		bgCtx := context.Background()
		emailLogger := slog.With("operation", "SendPasswordReset", "userID", user.ID)
		if emailErr := h.emailService.SendPasswordReset(email, name, link); emailErr != nil {
			emailLogger.ErrorContext(bgCtx, "Failed to send password reset email", "recipient", email, "error", emailErr)
		} else {
			emailLogger.InfoContext(bgCtx, "Sent password reset email", "recipient", email)
		}
	}(user.Email, user.Name, resetLink)

	// --- Return Generic Success Response ---
	logger.InfoContext(ctx, "Password reset initiated successfully", "userID", user.ID, "email", user.Email)
	return c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Message: "If an account with that email exists, a password reset link has been sent.",
	})
}

// ResetPassword handles the request to set a new password using a reset token.
func (h *Handler) ResetPassword(c echo.Context) error {
	ctx := c.Request().Context()
	logger := slog.With("handler", "ResetPassword")

	var req models.PasswordResetPayload
	if err := c.Bind(&req); err != nil {
		logger.WarnContext(ctx, "Failed to bind request body", "error", err)
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid request body: "+err.Error())
	}

	// --- Validate Input ---
	if req.NewPassword != req.ConfirmPassword {
		logger.WarnContext(ctx, "Password confirmation mismatch during reset")
		return echo.NewHTTPError(http.StatusBadRequest, "Passwords do not match.")
	}
	// Ensure password exists before checking length
	if req.NewPassword == "" || len(req.NewPassword) < 8 {
		logger.WarnContext(ctx, "New password too short during reset")
		return echo.NewHTTPError(http.StatusBadRequest, "New password must be at least 8 characters long.")
	}
	if req.Token == "" {
		logger.WarnContext(ctx, "Reset token missing")
		return echo.NewHTTPError(http.StatusBadRequest, "Reset token is required.")
	}

	logger.DebugContext(ctx, "Password reset attempt received") // Avoid logging token

	// --- Validate Token ---
	// 1. *** No Hashing Needed Here ***

	// 2. *** Find the RAW token in the database 'token' column ***
	var userID string
	var expiresAt time.Time
	err := h.db.Pool.QueryRow(ctx, QueryFindPasswordResetToken, req.Token).Scan(&userID, &expiresAt) // Query by RAW token

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) || errors.Is(err, sql.ErrNoRows) {
			logger.WarnContext(ctx, "Invalid or expired password reset token provided (token not found)")
			return echo.NewHTTPError(http.StatusBadRequest, "Invalid or expired password reset token.")
		}
		logger.ErrorContext(ctx, "Database error finding password reset token", "error", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "Error processing reset request.")
	}

	// 3. Check Expiry
	if time.Now().After(expiresAt) {
		logger.WarnContext(ctx, "Expired password reset token provided", "userID", userID, "expiresAt", expiresAt)
		// Attempt to delete the expired token (best effort)
		_, delErr := h.db.Pool.Exec(ctx, QueryDeletePasswordResetToken, req.Token) // Delete by RAW token
		if delErr != nil {
			logger.ErrorContext(ctx, "Failed to delete expired token", "error", delErr)
		}
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid or expired password reset token.")
	}

	// --- Update User Password ---
	newPasswordHash, err := h.authService.HashPassword(req.NewPassword)
	if err != nil {
		logger.ErrorContext(ctx, "Failed to hash new password", "userID", userID, "error", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "Error processing reset request.")
	}

	// Update the password in the users table
	_, err = h.db.Pool.Exec(ctx, QueryUpdateUserPassword, newPasswordHash, time.Now(), userID)
	if err != nil {
		logger.ErrorContext(ctx, "Failed to update user password in database", "userID", userID, "error", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to update password.")
	}

	// --- Invalidate Used Token ---
	// Delete the token now that it's been used successfully
	_, err = h.db.Pool.Exec(ctx, QueryDeletePasswordResetToken, req.Token) // Delete by RAW token
	if err != nil {
		// Log the error but don't fail the request, password update was successful
		logger.ErrorContext(ctx, "Failed to delete used password reset token", "userID", userID, "error", err)
	}

	// --- Return Success Response ---
	logger.InfoContext(ctx, "Password reset successfully", "userID", userID)
	return c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Message: "Password has been reset successfully. You can now log in with your new password.",
	})
}

// --- Optional: Background Task for Token Cleanup ---

// CleanupExpiredResetTokens deletes tokens that have passed their expiry time.
func (h *Handler) CleanupExpiredResetTokens(ctx context.Context) (int64, error) {
	logger := slog.With("task", "CleanupExpiredResetTokens")
	logger.Info("Running cleanup for expired password reset tokens...")

	commandTag, err := h.db.Pool.Exec(ctx, QueryDeleteExpiredTokens)
	if err != nil {
		logger.Error("Failed to delete expired reset tokens", "error", err)
		return 0, err
	}

	rowsAffected := commandTag.RowsAffected()
	logger.Info("Expired token cleanup complete", "tokensDeleted", rowsAffected)
	return rowsAffected, nil
}
