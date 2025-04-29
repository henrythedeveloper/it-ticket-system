// backend/internal/api/handlers/ticket/create.go
// ==========================================================================
// Handler function for creating new tickets.
// **REVISED**: Now handles multipart/form-data requests to accept attachments.
// **REVISED AGAIN**: Fixed import paths and removed duplicate function.
// ==========================================================================

package ticket

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"mime/multipart" // Import for multipart handling
	"net/http"
	"path/filepath"
	"strconv"
	"time"

	"github.com/henrythedeveloper/it-ticket-system/internal/models" // Correct models import
	"github.com/jackc/pgx/v5"                                     // Correct pgx import
	"github.com/labstack/echo/v4"                                 // Correct echo import
	// Removed invalid/duplicate imports
)

// CreateTicket handles the HTTP request to create a new support ticket.
// It now expects multipart/form-data, processes form fields for ticket data,
// handles file uploads, and saves attachment metadata.
func (h *Handler) CreateTicket(c echo.Context) (err error) { // Use named return for defer rollback check
	ctx := c.Request().Context()
	logger := slog.With("handler", "CreateTicket")

	// --- 1. Parse Multipart Form ---
	const maxMemory = 32 << 20 // 32MB
	if err = c.Request().ParseMultipartForm(maxMemory); err != nil {
		logger.ErrorContext(ctx, "Failed to parse multipart form", "error", err)
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid form data: "+err.Error())
	}
	form := c.Request().MultipartForm

	// --- 2. Extract and Validate Form Fields ---
	// Helper function to safely get the first value or default
	getFormValue := func(key string, defaultValue string) string {
		if values, ok := form.Value[key]; ok && len(values) > 0 {
			return values[0]
		}
		return defaultValue
	}
	getFormValueSlice := func(key string) []string {
		if values, ok := form.Value[key]; ok {
			return values
		}
		return []string{}
	}

	ticketCreate := models.TicketCreate{
		EndUserEmail: getFormValue("submitterEmail", ""),
		IssueType:    getFormValue("issueType", ""),
		Urgency:      models.TicketUrgency(getFormValue("urgency", string(models.UrgencyMedium))), // Default urgency
		Subject:      getFormValue("subject", ""),
		Body:         getFormValue("description", ""), // Map 'description' field from form to 'Body'
		Tags:         getFormValueSlice("tags"),
	}

	// Validation
	if ticketCreate.EndUserEmail == "" || ticketCreate.Subject == "" || ticketCreate.Body == "" {
		logger.WarnContext(ctx, "Missing required form fields", "payload", ticketCreate)
		return echo.NewHTTPError(http.StatusBadRequest, "Missing required ticket information (email, subject, description).")
	}
	if _, ok := map[models.TicketUrgency]bool{models.UrgencyLow: true, models.UrgencyMedium: true, models.UrgencyHigh: true, models.UrgencyCritical: true}[ticketCreate.Urgency]; !ok {
		logger.WarnContext(ctx, "Invalid urgency value", "urgency", ticketCreate.Urgency)
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid urgency value.")
	}

	emailToSend := ticketCreate.EndUserEmail

	logger.DebugContext(ctx, "Ticket creation request received (multipart)",
		"endUserEmail", emailToSend,
		"subject", ticketCreate.Subject,
		"tags", ticketCreate.Tags)

	// --- 3. Database Transaction ---
	tx, err := h.db.Pool.Begin(ctx)
	if err != nil {
		logger.ErrorContext(ctx, "Failed to begin database transaction", "error", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "Database error: failed to start transaction.")
	}
	defer func() {
		if err != nil {
			logger.WarnContext(ctx, "Rolling back transaction due to error", "error", err)
			if rbErr := tx.Rollback(ctx); rbErr != nil {
				logger.ErrorContext(ctx, "Failed to rollback transaction", "rollbackError", rbErr)
			}
		}
	}()

	// --- 4. Insert Ticket into Database ---
	var createdTicket models.Ticket
	err = tx.QueryRow(ctx, `
        INSERT INTO tickets (
            end_user_email, issue_type, urgency, subject, body,
            status, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, ticket_number, end_user_email, issue_type, urgency, subject, body,
                  status, assigned_to_user_id, created_at, updated_at, closed_at,
                  resolution_notes
        `,
		emailToSend, ticketCreate.IssueType, ticketCreate.Urgency,
		ticketCreate.Subject, ticketCreate.Body, models.StatusUnassigned,
		time.Now(), time.Now(),
	).Scan(
		&createdTicket.ID, &createdTicket.TicketNumber, &createdTicket.EndUserEmail,
		&createdTicket.IssueType, &createdTicket.Urgency, &createdTicket.Subject,
		&createdTicket.Body, &createdTicket.Status, &createdTicket.AssignedToUserID,
		&createdTicket.CreatedAt, &createdTicket.UpdatedAt, &createdTicket.ClosedAt,
		&createdTicket.ResolutionNotes,
	)
	if err != nil {
		logger.ErrorContext(ctx, "Failed to insert ticket into database", "error", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "Database error: failed to create ticket record.")
	}
	logger.DebugContext(ctx, "Ticket record inserted", "ticketUUID", createdTicket.ID, "ticketNumber", createdTicket.TicketNumber)

	// --- 5. Process and Link Tags ---
	var tagIDs []string
	if len(ticketCreate.Tags) > 0 {
		tagIDs, err = h.findOrCreateTags(ctx, tx, ticketCreate.Tags)
		if err != nil {
			// Error logged in helper, trigger rollback
			return echo.NewHTTPError(http.StatusInternalServerError, "Database error: failed to process tags.")
		}
		err = h.linkTagsToTicket(ctx, tx, createdTicket.ID, tagIDs)
		if err != nil {
			// Error logged in helper, trigger rollback
			return echo.NewHTTPError(http.StatusInternalServerError, "Database error: failed to link tags to ticket.")
		}
		logger.DebugContext(ctx, "Tags processed and linked", "tagIDs", tagIDs)
	}

	// --- 6. Process Attachments ---
	attachmentsMetadata := make([]models.Attachment, 0)
	files := form.File["attachments"] // "attachments" is the field name from the form
	logger.DebugContext(ctx, "Processing attachments", "fileCount", len(files))

	for _, fileHeader := range files {
		logger.DebugContext(ctx, "Processing file", "filename", fileHeader.Filename, "size", fileHeader.Size)

		// --- 6a. Validate File (using the one defined in attachments.go, assuming Handler has access) ---
		if validationErr := h.validateAttachment(fileHeader); validationErr != nil {
			logger.WarnContext(ctx, "Attachment validation failed", "filename", fileHeader.Filename, "error", validationErr)
			err = fmt.Errorf("validation failed for file '%s': %w", fileHeader.Filename, validationErr)
			return echo.NewHTTPError(http.StatusBadRequest, err.Error())
		}

		// --- 6b. Open File ---
		file, openErr := fileHeader.Open()
		if openErr != nil {
			logger.ErrorContext(ctx, "Failed to open uploaded file", "filename", fileHeader.Filename, "error", openErr)
			err = fmt.Errorf("failed to open file '%s': %w", fileHeader.Filename, openErr)
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to process uploaded file.")
		}

		// Process file within a closure to ensure defer file.Close() runs per file
		func(fh *multipart.FileHeader, f multipart.File) {
			defer f.Close()

			// --- 6c. Upload File to Storage ---
			contentType := fh.Header.Get("Content-Type")
			if contentType == "" {
				contentType = "application/octet-stream"
			}
			storagePath := fmt.Sprintf("tickets/%s/%d_%s", createdTicket.ID, time.Now().UnixNano(), filepath.Base(fh.Filename))

			storagePath, uploadErr := h.fileService.UploadFile(ctx, storagePath, f, fh.Size, contentType)
			if uploadErr != nil {
				logger.ErrorContext(ctx, "Failed to upload attachment via file service", "filename", fh.Filename, "error", uploadErr)
				err = fmt.Errorf("failed to upload file '%s': %w", fh.Filename, uploadErr)
				return // Exit closure, setting outer 'err'
			}
			logger.DebugContext(ctx, "File uploaded to storage", "filename", fh.Filename, "storagePath", storagePath)

			// --- 6d. Store Metadata in Database (within transaction) ---
			var attachment models.Attachment
			dbErr := tx.QueryRow(ctx, `
                INSERT INTO attachments (ticket_id, filename, storage_path, mime_type, size, uploaded_at)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING id, ticket_id, filename, storage_path, mime_type, size, uploaded_at
            `, createdTicket.ID, fh.Filename, storagePath, contentType, fh.Size, time.Now()).Scan(
				&attachment.ID, &attachment.TicketID, &attachment.Filename,
				&attachment.StoragePath, &attachment.MimeType, &attachment.Size, &attachment.UploadedAt,
			)
			if dbErr != nil {
				logger.ErrorContext(ctx, "Failed to store attachment metadata in database", "filename", fh.Filename, "storagePath", storagePath, "error", dbErr)
				logger.WarnContext(ctx, "Attempting to clean up orphaned file from storage due to DB error", "storagePath", storagePath)
				if cleanupErr := h.fileService.DeleteFile(context.Background(), storagePath); cleanupErr != nil {
					logger.ErrorContext(ctx, "Failed to clean up orphaned file", "storagePath", storagePath, "cleanupError", cleanupErr)
				}
				err = fmt.Errorf("failed to save metadata for file '%s': %w", fh.Filename, dbErr)
				return // Exit closure, setting outer 'err'
			}
			attachment.URL = fmt.Sprintf("/api/attachments/download/%s", attachment.ID) // Add download URL
			attachmentsMetadata = append(attachmentsMetadata, attachment)
			logger.DebugContext(ctx, "Attachment metadata stored", "attachmentID", attachment.ID)

		}(fileHeader, file) // Pass fileHeader and file to the closure

		// Check if an error occurred inside the closure
		if err != nil {
			// Rollback will be handled by the main defer
			return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
		}
	} // End of attachment processing loop

	// --- 7. Commit Transaction ---
	err = tx.Commit(ctx)
	if err != nil {
		logger.ErrorContext(ctx, "Failed to commit transaction", "ticketUUID", createdTicket.ID, "error", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "Database error: failed to save ticket.")
	}

	// --- 8. Post-Creation Actions (Email Notification) ---
	logger.InfoContext(ctx, "Ticket created successfully with attachments",
		"ticketUUID", createdTicket.ID,
		"ticketNumber", createdTicket.TicketNumber,
		"attachmentCount", len(attachmentsMetadata))

	// Send confirmation email asynchronously
	go func(recipientEmail, ticketNumStr, ticketSubject string) {
		bgCtx := context.Background()
		emailLogger := slog.With("operation", "SendTicketConfirmation", "ticketNumber", ticketNumStr)
		if emailErr := h.emailService.SendTicketConfirmation(recipientEmail, ticketNumStr, ticketSubject); emailErr != nil {
			emailLogger.ErrorContext(bgCtx, "Failed to send ticket confirmation email", "recipient", recipientEmail, "error", emailErr)
		} else {
			emailLogger.InfoContext(bgCtx, "Sent ticket confirmation email", "recipient", recipientEmail)
		}
	}(emailToSend, strconv.Itoa(int(createdTicket.TicketNumber)), createdTicket.Subject)

	// --- 9. Return Success Response ---
	createdTicket.Attachments = attachmentsMetadata
	// Fetch Tag objects if needed for response (omitted for simplicity)
	// createdTicket.Tags = ...

	return c.JSON(http.StatusCreated, models.APIResponse{
		Success: true,
		Message: "Ticket created successfully.",
		Data:    createdTicket,
	})
}

// --- Helper Functions (findOrCreateTags, linkTagsToTicket) ---

// findOrCreateTags finds existing tags or creates new ones within a transaction.
func (h *Handler) findOrCreateTags(ctx context.Context, tx pgx.Tx, tagNames []string) ([]string, error) {
	logger := slog.With("helper", "findOrCreateTags")
	tagIDs := make([]string, 0, len(tagNames))

	for _, name := range tagNames {
		var tagID string
		err := tx.QueryRow(ctx, `SELECT id FROM tags WHERE name = $1`, name).Scan(&tagID)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				logger.DebugContext(ctx, "Tag not found, creating...", "tagName", name)
				err = tx.QueryRow(ctx, `INSERT INTO tags (name, created_at) VALUES ($1, $2) RETURNING id`, name, time.Now()).Scan(&tagID)
				if err != nil {
					logger.ErrorContext(ctx, "Failed to create new tag", "tagName", name, "error", err)
					return nil, fmt.Errorf("failed to create tag '%s': %w", name, err)
				}
				logger.DebugContext(ctx, "Created new tag", "tagName", name, "tagID", tagID)
			} else {
				logger.ErrorContext(ctx, "Failed to query existing tag", "tagName", name, "error", err)
				return nil, fmt.Errorf("failed to check tag '%s': %w", name, err)
			}
		} else {
			logger.DebugContext(ctx, "Found existing tag", "tagName", name, "tagID", tagID)
		}
		tagIDs = append(tagIDs, tagID)
	}
	return tagIDs, nil
}

// linkTagsToTicket associates a list of tag IDs with a ticket ID in the join table.
func (h *Handler) linkTagsToTicket(ctx context.Context, tx pgx.Tx, ticketID string, tagIDs []string) error {
	logger := slog.With("helper", "linkTagsToTicket", "ticketUUID", ticketID)
	if len(tagIDs) == 0 {
		return nil
	}

	sql := `INSERT INTO ticket_tags (ticket_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`
	batch := &pgx.Batch{}
	for _, tagID := range tagIDs {
		batch.Queue(sql, ticketID, tagID)
	}

	results := tx.SendBatch(ctx, batch)
	defer results.Close()

	for i := 0; i < len(tagIDs); i++ {
		_, err := results.Exec()
		if err != nil {
			logger.ErrorContext(ctx, "Failed to link tag in batch", "tagID", tagIDs[i], "error", err)
			return fmt.Errorf("failed to link tag ID %s: %w", tagIDs[i], err)
		}
	}
	logger.DebugContext(ctx, "Successfully linked tags to ticket")
	return nil
}
