// backend/internal/api/handlers/ticket/attachments.go
// ==========================================================================
// Handler functions for managing ticket attachments (upload, download, metadata).
// Interacts with the file storage service and database.
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

	"github.com/henrythedeveloper/it-ticket-system/internal/models" // Data models
	"github.com/jackc/pgx/v5"
	"github.com/labstack/echo/v4"
)

const (
	// Define attachment constraints
	maxAttachmentSize = 10 * 1024 * 1024 // 10 MB
)

// --- Handler Functions ---

// UploadAttachment handles requests to upload a file and attach it to a ticket.
// It validates the file, uploads it via the fileService, and stores metadata in the DB.
//
// Path Parameters:
//   - id: The UUID of the ticket to attach the file to.
//
// Form Data:
//   - Expects a multipart/form-data request with a file field named "file".
//
// Returns:
//   - JSON response with the created Attachment metadata or an error response.
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

	// --- 2. Get File from Request ---
	file, fileHeader, err := c.Request().FormFile("file") // "file" is the expected form field name
	if err != nil {
		logger.ErrorContext(ctx, "Failed to get file from request form", "error", err)
		return echo.NewHTTPError(http.StatusBadRequest, "Failed to read file from request. Ensure the field name is 'file'.")
	}
	defer file.Close() // Ensure the uploaded file reader is closed

	// --- 3. Validate File ---
	if err := h.validateAttachment(fileHeader); err != nil {
		logger.WarnContext(ctx, "Attachment validation failed", "filename", fileHeader.Filename, "error", err)
		return echo.NewHTTPError(http.StatusBadRequest, err.Error()) // Return specific validation error
	}

	contentType := fileHeader.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "application/octet-stream" // Default if not provided
	}
	logger.DebugContext(ctx, "Attachment details", "filename", fileHeader.Filename, "size", fileHeader.Size, "contentType", contentType)

	// --- 4. Upload File to Storage Service ---
	// Generate a unique storage path (e.g., tickets/{ticket_id}/{timestamp}_{filename})
	storagePath := fmt.Sprintf("tickets/%s/%d_%s", ticketID, time.Now().UnixNano(), filepath.Base(fileHeader.Filename)) // Use Base to avoid path traversal issues

	// Use the injected fileService to handle the upload
	storagePath, err = h.fileService.UploadFile(ctx, storagePath, file, fileHeader.Size, contentType)
	if err != nil {
		// Error should be logged within fileService.UploadFile, log context here
		logger.ErrorContext(ctx, "Failed to upload attachment via file service", "filename", fileHeader.Filename, "error", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to store attachment.")
	}
	logger.DebugContext(ctx, "File uploaded to storage", "storagePath", storagePath)

	// --- 5. Store Metadata in Database ---
	var attachment models.Attachment
	err = h.db.Pool.QueryRow(ctx, `
        INSERT INTO attachments (ticket_id, filename, storage_path, mime_type, size, uploaded_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, ticket_id, filename, storage_path, mime_type, size, uploaded_at
    `, ticketID, fileHeader.Filename, storagePath, contentType, fileHeader.Size, time.Now()).Scan(
		&attachment.ID, &attachment.TicketID, &attachment.Filename,
		&attachment.StoragePath, &attachment.MimeType, &attachment.Size, &attachment.UploadedAt,
	)
	if err != nil {
		logger.ErrorContext(ctx, "Failed to store attachment metadata in database", "filename", fileHeader.Filename, "storagePath", storagePath, "error", err)
		// --- Cleanup Attempt ---
		// If DB insert fails after successful upload, try to delete the orphaned file from storage.
		logger.WarnContext(ctx, "Attempting to clean up orphaned file from storage", "storagePath", storagePath)
		if cleanupErr := h.fileService.DeleteFile(context.Background(), storagePath); cleanupErr != nil { // Use background context for cleanup
			logger.ErrorContext(ctx, "Failed to clean up orphaned file from storage", "storagePath", storagePath, "cleanupError", cleanupErr)
		}
		// --- End Cleanup ---
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to save attachment metadata.")
	}

	// --- 6. Return Success Response ---
	logger.InfoContext(ctx, "Attachment uploaded and metadata stored successfully", "attachmentID", attachment.ID, "filename", attachment.Filename)
	// Add download URL before returning
	attachment.URL = fmt.Sprintf("/api/attachments/download/%s", attachment.ID) // Construct download URL

	return c.JSON(http.StatusCreated, models.APIResponse{
		Success: true,
		Message: "File uploaded successfully.",
		Data:    attachment,
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
	err := h.db.Pool.QueryRow(ctx, `
        SELECT id, ticket_id, filename, storage_path, mime_type, size, uploaded_at
        FROM attachments
        WHERE id = $1 AND ticket_id = $2 -- Ensure attachment belongs to the ticket
    `, attachmentID, ticketID).Scan(
		&attachment.ID, &attachment.TicketID, &attachment.Filename,
		&attachment.StoragePath, &attachment.MimeType, &attachment.Size, &attachment.UploadedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			logger.WarnContext(ctx, "Attachment metadata not found")
			return echo.NewHTTPError(http.StatusNotFound, "Attachment not found.")
		}
		logger.ErrorContext(ctx, "Failed to query attachment metadata", "error", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to retrieve attachment metadata.")
	}

	// --- 3. Add Download URL & Return Response ---
	attachment.URL = fmt.Sprintf("/api/attachments/download/%s", attachment.ID) // Construct download URL
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
