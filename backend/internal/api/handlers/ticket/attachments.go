// backend/internal/api/handlers/ticket/attachments.go
// ==========================================================================
// Handler functions for managing ticket attachments (upload, download, metadata).
// Interacts with the file storage service and database.
// **REVISED**: Changed expected form field name from "file" to "attachments".
//              Updated to handle potential multiple file uploads under the same key.
// ==========================================================================

package ticket

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"mime/multipart"
	"net/http"
	"path/filepath"
	"time"
	"database/sql" // Import for sql.NullString

	"github.com/google/uuid" // Import UUID package
	"github.com/henrythedeveloper/it-ticket-system/internal/api/middleware/auth"
	"github.com/henrythedeveloper/it-ticket-system/internal/models" // Data models
	"github.com/jackc/pgx/v5"
	"github.com/labstack/echo/v4"
)

const (
	// Define attachment constraints
	maxAttachmentSize = 10 * 1024 * 1024 // 10 MB
)

// --- Handler Functions ---

// UploadAttachment handles requests to upload one or more files and attach them to a ticket.
// It validates the files, uploads them via the fileService, and stores metadata in the DB.
//
// Path Parameters:
//   - id: The UUID of the ticket to attach the file(s) to.
//
// Form Data:
//   - Expects a multipart/form-data request with file field(s) named "attachments".
//
// Returns:
//   - JSON response with an array of created Attachment metadata objects or an error response.
func (h *Handler) UploadAttachment(c echo.Context) error {
	ctx := c.Request().Context()
	ticketID := c.Param("id")
	logger := slog.With("handler", "UploadAttachment", "ticketUUID", ticketID)

	// --- 1. Input Validation ---
	if ticketID == "" {
		logger.WarnContext(ctx, "Missing ticket ID in request path")
		return echo.NewHTTPError(http.StatusBadRequest, "Missing ticket ID.")
	}

	// Verify ticket exists before proceeding
	exists, err := h.checkTicketExists(ctx, ticketID)
	if err != nil {
		// Error logged in checkTicketExists
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to verify ticket existence.")
	}
	if !exists {
		logger.WarnContext(ctx, "Attempted to upload attachment to non-existent ticket")
		return echo.NewHTTPError(http.StatusNotFound, "Ticket not found.")
	}

	// --- 2. Get Files from Request ---
	// Use MultipartForm() to handle multiple files under the same key
	form, err := c.MultipartForm()
	if err != nil {
		logger.ErrorContext(ctx, "Failed to parse multipart form", "error", err)
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid form data: "+err.Error())
	}
	// *** CHANGE: Look for "attachments" key ***
	files := form.File["attachments"]
	if len(files) == 0 {
		logger.WarnContext(ctx, "No files found under the 'attachments' key in the form")
		// *** CHANGE: Expecting "attachments" now ***
		return echo.NewHTTPError(http.StatusBadRequest, "No files uploaded. Ensure files are sent under the 'attachments' field name.")
	}

	// Get user info for audit fields (once before the loop)
	uploadedByUserID, _ := auth.GetUserIDFromContext(c) // Ignore error for now, default to ""
	uploadedByRole, _ := auth.GetUserRoleFromContext(c) // Ignore error for now, default to ""

	// --- 3. Process Each File ---
	attachmentsMetadata := make([]models.Attachment, 0, len(files))
	var processingError error // To capture the first error encountered

	// Use a transaction for database operations
	tx, txErr := h.db.Pool.Begin(ctx)
	if txErr != nil {
		logger.ErrorContext(ctx, "Failed to begin database transaction", "error", txErr)
		return echo.NewHTTPError(http.StatusInternalServerError, "Database error: failed to start transaction.")
	}
	// Defer rollback logic
	defer func() {
		if p := recover(); p != nil { // Catch panics
			_ = tx.Rollback(ctx)
			panic(p) // Re-throw panic after Rollback
		} else if processingError != nil { // Rollback on explicit error
			logger.WarnContext(ctx, "Rolling back transaction due to processing error", "error", processingError)
			if rbErr := tx.Rollback(ctx); rbErr != nil {
				logger.ErrorContext(ctx, "Failed to rollback transaction", "rollbackError", rbErr)
			}
		} else { // Commit if no error
			commitErr := tx.Commit(ctx)
			if commitErr != nil {
				logger.ErrorContext(ctx, "Failed to commit transaction", "error", commitErr)
				// Set processingError so the final response indicates failure
				processingError = fmt.Errorf("database error: failed to save attachments: %w", commitErr)
			}
		}
	}()

	for _, fileHeader := range files {
		logger.DebugContext(ctx, "Processing file", "filename", fileHeader.Filename, "size", fileHeader.Size)

		// --- 3a. Validate File ---
		if err := h.validateAttachment(fileHeader); err != nil {
			logger.WarnContext(ctx, "Attachment validation failed", "filename", fileHeader.Filename, "error", err)
			processingError = echo.NewHTTPError(http.StatusBadRequest, err.Error()) // Return specific validation error
			return processingError // Stop processing further files on validation error
		}

		// --- 3b. Open File ---
		file, openErr := fileHeader.Open()
		if openErr != nil {
			logger.ErrorContext(ctx, "Failed to open uploaded file", "filename", fileHeader.Filename, "error", openErr)
			processingError = echo.NewHTTPError(http.StatusInternalServerError, "Failed to process uploaded file: "+fileHeader.Filename)
			return processingError // Stop processing
		}

		// --- 3c. Upload File to Storage Service ---
		contentType := fileHeader.Header.Get("Content-Type")
		if contentType == "" { contentType = "application/octet-stream" }
		safeFilename := filepath.Base(fileHeader.Filename) // Sanitize filename
		// Generate a unique ID for the storage path part to avoid collisions even with same names/timestamps
		uniqueID := uuid.New().String()
		storagePath := fmt.Sprintf("tickets/%s/%s_%s", ticketID, uniqueID, safeFilename)

		storagePath, uploadErr := h.fileService.UploadFile(ctx, storagePath, file, fileHeader.Size, contentType)
		file.Close() // Close the file *after* uploading
		if uploadErr != nil {
			logger.ErrorContext(ctx, "Failed to upload attachment via file service", "filename", safeFilename, "error", uploadErr)
			processingError = echo.NewHTTPError(http.StatusInternalServerError, "Failed to store attachment: "+safeFilename)
			return processingError // Stop processing
		}
		logger.DebugContext(ctx, "File uploaded to storage", "storagePath", storagePath)

		// --- 3d. Store Metadata in Database (within transaction) ---
		var attachment models.Attachment
		var uploadedByUserIDNullable sql.NullString
		var uploadedByRoleNullable sql.NullString

		if uploadedByUserID != "" { uploadedByUserIDNullable = sql.NullString{String: uploadedByUserID, Valid: true} }
		if string(uploadedByRole) != "" { uploadedByRoleNullable = sql.NullString{String: string(uploadedByRole), Valid: true} }

		// Insert metadata into the database using the transaction (tx)
		dbErr := tx.QueryRow(ctx, `
            INSERT INTO attachments (ticket_id, filename, storage_path, mime_type, size, uploaded_at, uploaded_by_user_id, uploaded_by_role)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id, ticket_id, filename, storage_path, mime_type, size, uploaded_at, uploaded_by_user_id, uploaded_by_role
        `, ticketID, safeFilename, storagePath, contentType, fileHeader.Size, time.Now(), uploadedByUserIDNullable, uploadedByRoleNullable).Scan(
			&attachment.ID, &attachment.TicketID, &attachment.Filename,
			&attachment.StoragePath, &attachment.MimeType, &attachment.Size, &attachment.UploadedAt,
			&attachment.UploadedByUserID, &attachment.UploadedByRole, // Scan directly now
		)
		if dbErr != nil {
			logger.ErrorContext(ctx, "Failed to store attachment metadata in database", "filename", safeFilename, "storagePath", storagePath, "error", dbErr)
			// Attempt to clean up the file uploaded just before the DB error
			logger.WarnContext(ctx, "Attempting to clean up orphaned file from storage due to DB error", "storagePath", storagePath)
			if cleanupErr := h.fileService.DeleteFile(context.Background(), storagePath); cleanupErr != nil {
				logger.ErrorContext(ctx, "Failed to clean up orphaned file", "storagePath", storagePath, "cleanupError", cleanupErr)
			}
			processingError = echo.NewHTTPError(http.StatusInternalServerError, "Failed to save attachment metadata for: "+safeFilename)
			return processingError // Stop processing
		}

		attachment.URL = fmt.Sprintf("/api/attachments/download/%s", attachment.ID) // Add download URL
		attachmentsMetadata = append(attachmentsMetadata, attachment)
		logger.DebugContext(ctx, "Attachment metadata stored", "attachmentID", attachment.ID)
	} // End of file processing loop

	// If loop finished but an error occurred during commit (checked by defer), return error
	if processingError != nil {
		// The defer function already tried to rollback
		// Return the appropriate error status code based on the error type
		if httpErr, ok := processingError.(*echo.HTTPError); ok {
			return httpErr
		}
		return echo.NewHTTPError(http.StatusInternalServerError, processingError.Error())
	}

	// --- 4. Return Success Response ---
	logger.InfoContext(ctx, "Attachments uploaded and metadata stored successfully", "count", len(attachmentsMetadata))
	return c.JSON(http.StatusCreated, models.APIResponse{
		Success: true,
		Message: fmt.Sprintf("%d file(s) uploaded successfully.", len(attachmentsMetadata)),
		Data:    attachmentsMetadata, // Return array of metadata
	})
}


// GetAttachment retrieves metadata for a specific attachment.
//
// Path Parameters:
//   - id: The UUID of the ticket.
//   - attachmentId: The UUID of the attachment.
//
// Returns:
//   - JSON response with Attachment metadata or an error response.
func (h *Handler) GetAttachment(c echo.Context) error {
	ctx := c.Request().Context()
	ticketID := c.Param("id")
	attachmentID := c.Param("attachmentId")
	logger := slog.With("handler", "GetAttachment", "ticketUUID", ticketID, "attachmentID", attachmentID)

	// --- 1. Input Validation ---
	if ticketID == "" || attachmentID == "" {
		logger.WarnContext(ctx, "Missing ticket ID or attachment ID in request path")
		return echo.NewHTTPError(http.StatusBadRequest, "Missing ticket ID or attachment ID.")
	}

	// --- 2. Fetch Metadata from Database ---
	var attachment models.Attachment
	// Use pointers/nullable types for potentially NULL columns
	var uploadedByUserIDNullable sql.NullString
	var uploadedByRoleNullable sql.NullString
	var urlNullable sql.NullString

	err := h.db.Pool.QueryRow(ctx, `
        SELECT id, ticket_id, filename, storage_path, mime_type, size, uploaded_at, uploaded_by_user_id, uploaded_by_role, url
        FROM attachments
        WHERE id = $1 AND ticket_id = $2 -- Ensure attachment belongs to the ticket
    `, attachmentID, ticketID).Scan(
		&attachment.ID, &attachment.TicketID, &attachment.Filename,
		&attachment.StoragePath, &attachment.MimeType, &attachment.Size, &attachment.UploadedAt,
		&uploadedByUserIDNullable, &uploadedByRoleNullable, &urlNullable,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			logger.WarnContext(ctx, "Attachment metadata not found")
			return echo.NewHTTPError(http.StatusNotFound, "Attachment not found.")
		}
		logger.ErrorContext(ctx, "Failed to query attachment metadata", "error", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to retrieve attachment metadata.")
	}

	// Assign values from nullable types if valid
	if uploadedByUserIDNullable.Valid { attachment.UploadedByUserID = uploadedByUserIDNullable.String }
	if uploadedByRoleNullable.Valid { attachment.UploadedByRole = uploadedByRoleNullable.String }
	if urlNullable.Valid { attachment.URL = urlNullable.String }


	// --- 3. Add Download URL & Return Response ---
	// Generate download URL if not present in DB (optional fallback)
	if attachment.URL == "" {
	    attachment.URL = fmt.Sprintf("/api/attachments/download/%s", attachment.ID) // Construct download URL
	}
	logger.DebugContext(ctx, "Attachment metadata retrieved successfully")
	return c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    attachment,
	})
}

// DownloadAttachment streams the content of an attachment file to the client.
// Assumes a separate route like /api/attachments/download/:attachmentId is registered.
//
// Path Parameters:
//   - attachmentId: The UUID of the attachment to download.
//
// Returns:
//   - The file content as a stream or an error response.
func (h *Handler) DownloadAttachment(c echo.Context) error {
	ctx := c.Request().Context()
	attachmentID := c.Param("attachmentId") // Assuming this is the param name in the route definition
	logger := slog.With("handler", "DownloadAttachment", "attachmentID", attachmentID)

	// --- 1. Input Validation ---
	if attachmentID == "" {
		logger.WarnContext(ctx, "Missing attachment ID in request path")
		return echo.NewHTTPError(http.StatusBadRequest, "Missing attachment ID.")
	}

	// --- 2. Get Attachment Metadata from DB ---
	// Fetch only necessary fields (storage path, filename, MIME type)
	var storagePath, filename, mimeType string
	err := h.db.Pool.QueryRow(ctx, `
        SELECT storage_path, filename, mime_type FROM attachments WHERE id = $1
    `, attachmentID).Scan(&storagePath, &filename, &mimeType)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			logger.WarnContext(ctx, "Attachment metadata not found for download")
			return echo.NewHTTPError(http.StatusNotFound, "Attachment not found.")
		}
		logger.ErrorContext(ctx, "Failed to get attachment metadata for download", "error", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to retrieve attachment information.")
	}

	// --- 3. Get File Stream from Storage Service ---
	fileReader, err := h.fileService.GetObject(ctx, storagePath)
	if err != nil {
		// Error should be logged within fileService.GetObject
		logger.ErrorContext(ctx, "Failed to get object stream from storage service", "storagePath", storagePath, "error", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to retrieve file from storage.")
	}
	// Ensure the reader (which should be io.ReadCloser) is closed after streaming
	defer func() {
		if closer, ok := fileReader.(io.Closer); ok {
			if closeErr := closer.Close(); closeErr != nil {
				logger.ErrorContext(ctx, "Error closing file stream after download", "storagePath", storagePath, "error", closeErr)
			}
		}
	}()

	// --- 4. Stream File to Client ---
	// Set headers for file download
	c.Response().Header().Set(echo.HeaderContentType, mimeType)
	// Content-Disposition forces browser download dialog
	c.Response().Header().Set(echo.HeaderContentDisposition, fmt.Sprintf("attachment; filename=\"%s\"", filename))
	// Optional: Set Content-Length if size is known and reliable
	// c.Response().Header().Set(echo.HeaderContentLength, fmt.Sprintf("%d", size))

	logger.InfoContext(ctx, "Streaming attachment download", "filename", filename, "mimeType", mimeType)

	// Use Echo's Stream function for efficient streaming
	// Note: Errors during the actual io.Copy within Stream are harder to catch/log here
	// as headers might already be sent.
	return c.Stream(http.StatusOK, mimeType, fileReader)
}

// DeleteAttachment handles requests to delete an attachment file and its metadata.
// Performs authorization check based on the associated ticket.
//
// Path Parameters:
//   - id: The UUID of the ticket.
//   - attachmentId: The UUID of the attachment to delete.
//
// Returns:
//   - JSON success message or an error response.
func (h *Handler) DeleteAttachment(c echo.Context) error {
	ctx := c.Request().Context()
	ticketID := c.Param("id")
	attachmentID := c.Param("attachmentId")
	logger := slog.With("handler", "DeleteAttachment", "ticketUUID", ticketID, "attachmentID", attachmentID)

	// --- 1. Input Validation ---
	if ticketID == "" || attachmentID == "" {
		logger.WarnContext(ctx, "Missing ticket ID or attachment ID in request path")
		return echo.NewHTTPError(http.StatusBadRequest, "Missing ticket ID or attachment ID.")
	}

	// --- 2. Authorization Check ---
	// Get user context and verify they can manage this ticket
	userID, err := auth.GetUserIDFromContext(c)
	if err != nil { return err } // Error logged in helper
	userRole, err := auth.GetUserRoleFromContext(c)
	if err != nil {
		// Log the error from GetUserRoleFromContext if needed, but it usually returns an HTTP error itself
		logger.ErrorContext(ctx, "Failed to get user role from context", "error", err)
		return err // Return the error provided by the helper
	}
	isAdmin := userRole == models.RoleAdmin
	// Use checkTicketAccess helper to verify permission (fetches ticket data needed for check)
	_, err = h.checkTicketAccess(ctx, ticketID, userID, isAdmin)
	if err != nil {
		logger.WarnContext(ctx, "Authorization check failed for deleting attachment", "error", err)
		if err.Error() == "ticket not found" { return echo.NewHTTPError(http.StatusNotFound, "Ticket not found.") }
		if err.Error() == "not authorized to access this ticket" { return echo.NewHTTPError(http.StatusForbidden, "Not authorized to manage this ticket's attachments.") }
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to verify ticket access.")
	}
	// Optional: Add check if ticket is closed?
	// if ticketData.Status == models.StatusClosed {
	// 	 return echo.NewHTTPError(http.StatusBadRequest, "Cannot delete attachments from a closed ticket.")
	// }

	// --- 3. Get Attachment Storage Path ---
	var storagePath, filename string
	err = h.db.Pool.QueryRow(ctx, `SELECT storage_path, filename FROM attachments WHERE id = $1 AND ticket_id = $2`, attachmentID, ticketID).Scan(&storagePath, &filename)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			logger.WarnContext(ctx, "Attachment not found for deletion")
			return echo.NewHTTPError(http.StatusNotFound, "Attachment not found.")
		}
		logger.ErrorContext(ctx, "Failed to query attachment storage path", "error", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to retrieve attachment details.")
	}

	// --- 4. Delete File from Storage Service ---
	logger.DebugContext(ctx, "Attempting to delete file from storage", "storagePath", storagePath)
	err = h.fileService.DeleteFile(ctx, storagePath)
	if err != nil {
		// Log the error but proceed to delete DB record anyway, as the file might already be gone
		// or there might be an issue with the storage service itself.
		logger.ErrorContext(ctx, "Failed to delete file from storage service (continuing to delete DB record)", "storagePath", storagePath, "error", err)
		// Depending on requirements, you might choose to return an error here instead.
	} else {
		logger.InfoContext(ctx, "Successfully deleted file from storage", "storagePath", storagePath)
	}


	// --- 5. Delete Metadata from Database ---
	commandTag, err := h.db.Pool.Exec(ctx, `DELETE FROM attachments WHERE id = $1`, attachmentID)
	if err != nil {
		logger.ErrorContext(ctx, "Failed to delete attachment metadata from database", "error", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "Database error: failed to delete attachment metadata.")
	}
	if commandTag.RowsAffected() == 0 {
		// Should be rare if previous check passed, but handle defensively
		logger.WarnContext(ctx, "Attachment metadata deletion affected 0 rows")
		return echo.NewHTTPError(http.StatusNotFound, "Attachment metadata not found or already deleted.")
	}

	// --- 6. Return Success Response ---
	logger.InfoContext(ctx, "Attachment deleted successfully", "filename", filename)
	return c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Message: "Attachment deleted successfully.",
	})
}


// --- Helper Functions ---

// checkTicketExists verifies if a ticket with the given ID exists in the database.
func (h *Handler) checkTicketExists(ctx context.Context, ticketID string) (bool, error) {
	var exists bool
	err := h.db.Pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM tickets WHERE id = $1)`, ticketID).Scan(&exists)
	if err != nil {
		slog.ErrorContext(ctx, "Failed to check ticket existence", "ticketUUID", ticketID, "error", err)
		return false, err
	}
	return exists, nil
}

// validateAttachment checks if the uploaded file meets size and potentially type constraints.
func (h *Handler) validateAttachment(fileHeader *multipart.FileHeader) error {
	// Check file size
	if fileHeader.Size > maxAttachmentSize {
		return fmt.Errorf("file exceeds maximum allowed size (%d MB)", maxAttachmentSize/(1024*1024))
	}

	// Optional: Add MIME type validation if needed
	// allowedTypes := []string{"image/jpeg", "image/png", "application/pdf"}
	// contentType := fileHeader.Header.Get("Content-Type")
	// isAllowed := false
	// for _, t := range allowedTypes {
	//     if contentType == t {
	//         isAllowed = true
	//         break
	//     }
	// }
	// if !isAllowed {
	//     return fmt.Errorf("file type '%s' is not allowed", contentType)
	// }

	return nil // Validation passed
}
