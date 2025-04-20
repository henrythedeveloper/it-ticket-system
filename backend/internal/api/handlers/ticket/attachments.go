package ticket

import (
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"time"

	"github.com/henrythedeveloper/bus-it-ticket/internal/models"
	"github.com/jackc/pgx/v5"
	"github.com/labstack/echo/v4"
)

// UploadAttachment uploads a file attachment to a ticket
func (h *Handler) UploadAttachment(c echo.Context) error {
	ticketID := c.Param("id")
	slog.Debug("Attempting to upload attachment", "ticketID", ticketID)

	if ticketID == "" {
		slog.Warn("UploadAttachment called with missing ticket ID")
		return echo.NewHTTPError(http.StatusBadRequest, "missing ticket ID")
	}

	ctx := c.Request().Context()

	// Verify ticket exists
	var exists bool
	err := h.db.Pool.QueryRow(ctx, `
        SELECT EXISTS(SELECT 1 FROM tickets WHERE id = $1)
    `, ticketID).Scan(&exists)
	if err != nil {
		// Log the underlying DB error before returning generic 500
		slog.Error("Failed to check ticket existence for attachment upload", "ticketID", ticketID, "error", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to check ticket existence")
	}
	if !exists {
		slog.Warn("Attempted to upload attachment to non-existent ticket", "ticketID", ticketID)
		return echo.NewHTTPError(http.StatusNotFound, "ticket not found")
	}

	// Get the file from the request
	file, fileHeader, err := c.Request().FormFile("file")
	if err != nil {
		slog.Error("Failed to get file from attachment upload request", "ticketID", ticketID, "error", err)
		return echo.NewHTTPError(http.StatusBadRequest, "failed to get file from request")
	}
	defer file.Close()

	// Check file size (limit to 10MB for example)
	const maxFileSize = 10 * 1024 * 1024
	if fileHeader.Size > maxFileSize {
		slog.Warn("Attachment file exceeds size limit", "ticketID", ticketID, "filename", fileHeader.Filename, "size", fileHeader.Size, "limit", maxFileSize)
		return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("file too large (max %dMB)", maxFileSize/(1024*1024)))
	}

	// Get content type
	contentType := fileHeader.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "application/octet-stream" // Default fallback
	}
	slog.Debug("Attachment details", "ticketID", ticketID, "filename", fileHeader.Filename, "size", fileHeader.Size, "contentType", contentType)

	// Upload file to storage
	storagePath, err := h.fileService.UploadFile(ctx, ticketID, fileHeader.Filename, file, contentType)
	if err != nil {
		// Error should ideally be logged within fileService.UploadFile, but log here too for context
		slog.Error("Failed to upload attachment to storage service", "ticketID", ticketID, "filename", fileHeader.Filename, "error", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to upload file")
	}
	slog.Debug("Attachment uploaded to storage", "ticketID", ticketID, "filename", fileHeader.Filename, "storagePath", storagePath)

	// Store attachment metadata in database
	var attachment models.Attachment
	err = h.db.Pool.QueryRow(ctx, `
        INSERT INTO attachments (ticket_id, filename, storage_path, mime_type, size, uploaded_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, ticket_id, filename, storage_path, mime_type, size, uploaded_at
    `, ticketID, fileHeader.Filename, storagePath, contentType, fileHeader.Size, time.Now()).Scan(
		&attachment.ID, // Should be string
		&attachment.TicketID, // Should be string
		&attachment.Filename,
		&attachment.StoragePath,
		&attachment.MimeType,
		&attachment.Size,
		&attachment.UploadedAt,
	)
	if err != nil {
		// Log the underlying DB error
		slog.Error("Failed to store attachment metadata in database", "ticketID", ticketID, "filename", fileHeader.Filename, "storagePath", storagePath, "error", err)
		// Consider cleaning up the uploaded file from storage here if the DB insert fails
		// h.fileService.DeleteFile(ctx, storagePath) // Requires DeleteFile method in service
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to store attachment metadata")
	}

	slog.Info("Attachment uploaded and metadata stored successfully", "ticketID", ticketID, "attachmentID", attachment.ID, "filename", attachment.Filename)
	return c.JSON(http.StatusCreated, models.APIResponse{
		Success: true,
		Message: "File uploaded successfully",
		Data:    attachment,
	})
}

// GetAttachment retrieves an attachment metadata for a ticket
func (h *Handler) GetAttachment(c echo.Context) error {
	ticketID := c.Param("id")
	attachmentID := c.Param("attachmentId")
	slog.Debug("Attempting to get attachment metadata", "ticketID", ticketID, "attachmentID", attachmentID)

	if ticketID == "" || attachmentID == "" {
		slog.Warn("GetAttachment called with missing IDs", "ticketID", ticketID, "attachmentID", attachmentID)
		return echo.NewHTTPError(http.StatusBadRequest, "missing ticket ID or attachment ID")
	}

	ctx := c.Request().Context()

	// Get attachment metadata
	var attachment models.Attachment
	err := h.db.Pool.QueryRow(ctx, `
        SELECT id, ticket_id, filename, storage_path, mime_type, size, uploaded_at
        FROM attachments
        WHERE id = $1 AND ticket_id = $2
    `, attachmentID, ticketID).Scan(
		&attachment.ID, 
		&attachment.TicketID, 
		&attachment.Filename,
		&attachment.StoragePath,
		&attachment.MimeType,
		&attachment.Size,
		&attachment.UploadedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			slog.Warn("Attachment metadata not found", "ticketID", ticketID, "attachmentID", attachmentID)
			return echo.NewHTTPError(http.StatusNotFound, "attachment not found")
		}
		// Log the underlying DB error
		slog.Error("Failed to query attachment metadata", "ticketID", ticketID, "attachmentID", attachmentID, "error", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to get attachment metadata")
	}

	slog.Debug("Attachment metadata retrieved successfully", "ticketID", ticketID, "attachmentID", attachmentID)
	return c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    attachment,
	})
}

// DownloadAttachment streams an attachment file back to the client
func (h *Handler) DownloadAttachment(c echo.Context) error {
	attachmentID := c.Param("attachmentId") // Read path parameter
	slog.Debug("Attempting to download attachment", "attachmentID", attachmentID)

	if attachmentID == "" {
		slog.Warn("DownloadAttachment called with missing attachment ID")
		return echo.NewHTTPError(http.StatusBadRequest, "missing attachment ID")
	}

	ctx := c.Request().Context()
	// User authentication is handled by the middleware applied to the group

	// 1. Get attachment metadata from DB
	var att models.Attachment
	err := h.db.Pool.QueryRow(ctx, `
        SELECT storage_path, filename, mime_type, size
        FROM attachments
        WHERE id = $1
    `, attachmentID).Scan(&att.StoragePath, &att.Filename, &att.MimeType, &att.Size)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			slog.Warn("Attachment metadata not found for download", "attachmentID", attachmentID)
			return echo.NewHTTPError(http.StatusNotFound, "attachment not found")
		}
		// Log the underlying DB error
		slog.Error("Failed to get attachment metadata for download", "attachmentID", attachmentID, "error", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to retrieve attachment info")
	}

	// 2. Get the object stream from S3/MinIO using the fileService
	fileReader, err := h.fileService.GetObject(ctx, att.StoragePath)
	if err != nil {
		// Log the storage service error
		slog.Error("Failed to get object from storage for download", "attachmentID", attachmentID, "storagePath", att.StoragePath, "error", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to retrieve file from storage")
	}
	// Ensure the reader (which should be an io.ReadCloser) is closed
	if closer, ok := fileReader.(io.Closer); ok {
		defer closer.Close() // Ensure closure even on successful streaming
	}

	// 3. Stream the file back to the client
	c.Response().Header().Set(echo.HeaderContentType, att.MimeType)
	// c.Response().Header().Set(echo.HeaderContentLength, fmt.Sprintf("%d", att.Size)) // Optional: Uncomment if needed
	c.Response().Header().Set(echo.HeaderContentDisposition, fmt.Sprintf("attachment; filename=\"%s\"", att.Filename))

	slog.Info("Streaming attachment download", "attachmentID", attachmentID, "filename", att.Filename, "mimeType", att.MimeType)
	// Use Stream to copy data - efficient for large files
	// Note: Errors during streaming are harder to log here as the response header is already sent.
	// Echo's Stream function handles the io.Copy internally.
	return c.Stream(http.StatusOK, att.MimeType, fileReader)
}