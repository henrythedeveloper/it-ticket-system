package ticket

import (
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"

	"github.com/henrythedeveloper/bus-it-ticket/internal/models"
	"github.com/jackc/pgx/v5"
	"github.com/labstack/echo/v4"
)

// UploadAttachment uploads a file attachment to a ticket
func (h *Handler) UploadAttachment(c echo.Context) error {
	ticketID := c.Param("id")
	if ticketID == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "missing ticket ID")
	}

	ctx := c.Request().Context()

	// Verify ticket exists
	var exists bool
	err := h.db.Pool.QueryRow(ctx, `
		SELECT EXISTS(SELECT 1 FROM tickets WHERE id = $1)
	`, ticketID).Scan(&exists)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to check ticket")
	}
	if !exists {
		return echo.NewHTTPError(http.StatusNotFound, "ticket not found")
	}

	// Get the file from the request
	file, fileHeader, err := c.Request().FormFile("file")
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "failed to get file from request")
	}
	defer file.Close()

	// Check file size (limit to 10MB for example)
	if fileHeader.Size > 10*1024*1024 {
		return echo.NewHTTPError(http.StatusBadRequest, "file too large (max 10MB)")
	}

	// Get content type
	contentType := fileHeader.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "application/octet-stream"
	}

	// Upload file to storage
	storagePath, err := h.fileService.UploadFile(ctx, ticketID, fileHeader.Filename, file, contentType)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to upload file")
	}

	// Store attachment metadata in database
	var attachment models.Attachment
	err = h.db.Pool.QueryRow(ctx, `
		INSERT INTO attachments (ticket_id, filename, storage_path, mime_type, size, uploaded_at)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, ticket_id, filename, storage_path, mime_type, size, uploaded_at
	`, ticketID, fileHeader.Filename, storagePath, contentType, fileHeader.Size, time.Now()).Scan(
		&attachment.ID,
		&attachment.TicketID,
		&attachment.Filename,
		&attachment.StoragePath,
		&attachment.MimeType,
		&attachment.Size,
		&attachment.UploadedAt,
	)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to store attachment metadata")
	}

	return c.JSON(http.StatusCreated, models.APIResponse{
		Success: true,
		Message: "File uploaded successfully",
		Data:    attachment,
	})
}

// GetAttachment retrieves an attachment for a ticket
func (h *Handler) GetAttachment(c echo.Context) error {
	ticketID := c.Param("id")
	attachmentID := c.Param("attachmentId")
	if ticketID == "" || attachmentID == "" {
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
			return echo.NewHTTPError(http.StatusNotFound, "attachment not found")
		}
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to get attachment metadata")
	}

	return c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    attachment,
	})
}

// DownloadAttachment streams an attachment file back to the client
func (h *Handler) DownloadAttachment(c echo.Context) error {
	attachmentID := c.Param("attachmentId") // Read path parameter
	if attachmentID == "" {
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
			return echo.NewHTTPError(http.StatusNotFound, "attachment not found")
		}
		log.Printf("ERROR: Failed to get attachment metadata %s: %v", attachmentID, err)
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to retrieve attachment info")
	}

	// 2. Get the object stream from S3/MinIO using the fileService
	//    (Requires adding GetObject method to file.Service - see next step)
	fileReader, err := h.fileService.GetObject(ctx, att.StoragePath)
	if err != nil {
		log.Printf("ERROR: Failed to get object %s from storage: %v", att.StoragePath, err)
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to retrieve file from storage")
	}
	// Ensure the reader (which should be an io.ReadCloser) is closed
	if closer, ok := fileReader.(io.Closer); ok {
		defer closer.Close()
	}

	// 3. Stream the file back to the client
	c.Response().Header().Set(echo.HeaderContentType, att.MimeType)
	// Optional: Set content length if available (helps browser show progress)
	// c.Response().Header().Set(echo.HeaderContentLength, fmt.Sprintf("%d", att.Size))
	// Set filename for download prompt
	c.Response().Header().Set(echo.HeaderContentDisposition, fmt.Sprintf("attachment; filename=\"%s\"", att.Filename))

	// Use Stream to copy data - efficient for large files
	return c.Stream(http.StatusOK, att.MimeType, fileReader)

}
