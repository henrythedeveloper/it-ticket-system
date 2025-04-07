package ticket

import (
	"errors"
	"fmt"
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

	// Generate signed URL for attachment
	url, err := h.fileService.GetFileURL(ctx, attachment.StoragePath)
	if err != nil {
		// Don't fail the whole request for a URL generation error
		fmt.Printf("Failed to generate URL for attachment %s: %v\n", attachment.ID, err)
	} else {
		attachment.URL = url
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

	// Generate signed URL for attachment
	url, err := h.fileService.GetFileURL(ctx, attachment.StoragePath)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to generate download URL")
	}
	attachment.URL = url

	return c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    attachment,
	})
}
