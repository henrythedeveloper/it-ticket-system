// backend/internal/api/handlers/tag/tag.go
// ==========================================================================
// Handler functions for managing tags used for categorizing tickets.
// Provides endpoints for listing, creating, and deleting tags.
// ==========================================================================

package tag

import (
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/henrythedeveloper/it-ticket-system/internal/db"
	"github.com/henrythedeveloper/it-ticket-system/internal/models"
	"github.com/jackc/pgx/v5"
	"github.com/labstack/echo/v4"
)

// --- Handler Struct ---

// Handler holds dependencies for tag-related request handlers.
type Handler struct {
	db *db.DB // Database connection pool
}

// --- Constructor ---

// NewHandler creates a new instance of the tag Handler.
//
// Parameters:
//   - db: The database connection pool (*db.DB).
//
// Returns:
//   - *Handler: A pointer to the newly created Handler.
func NewHandler(db *db.DB) *Handler {
	return &Handler{
		db: db,
	}
}

// --- Route Registration ---

// RegisterRoutes defines and registers all API routes managed by this tag handler.
// It maps HTTP methods and paths to specific handler functions and applies admin middleware
// for protected operations (Create, Delete).
//
// Parameters:
//   - g: The echo group (e.g., /api/tags) to register routes onto (*echo.Group).
//   - h: The tag Handler instance (*Handler).
//   - adminMiddleware: The middleware function to restrict access to Admins only.
func RegisterRoutes(g *echo.Group, h *Handler, adminMiddleware echo.MiddlewareFunc) {
	slog.Debug("Registering tag routes")

	// Public route (Read operation)
	g.GET("", h.GetAllTags) // GET /api/tags

	// Admin-protected routes (Write operations)
	g.POST("", h.CreateTag, adminMiddleware)   // POST /api/tags
	g.DELETE("/:id", h.DeleteTag, adminMiddleware) // DELETE /api/tags/{id}

	slog.Debug("Finished registering tag routes")
}

// --- Handler Functions ---

// GetAllTags retrieves all available tags, ordered alphabetically.
//
// Returns:
//   - JSON response containing an array of Tag objects or an error response.
func (h *Handler) GetAllTags(c echo.Context) error {
	ctx := c.Request().Context()
	logger := slog.With("handler", "GetAllTags")

	// --- Execute Query ---
	rows, err := h.db.Pool.Query(ctx, `
        SELECT id, name, created_at FROM tags ORDER BY name ASC
    `)
	if err != nil {
		logger.ErrorContext(ctx, "Database query failed", "error", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to retrieve tags.")
	}
	defer rows.Close()

	// --- Scan Results ---
	tags := make([]models.Tag, 0)
	for rows.Next() {
		var tag models.Tag
		if err := rows.Scan(&tag.ID, &tag.Name, &tag.CreatedAt); err != nil {
			logger.ErrorContext(ctx, "Failed to scan tag row", "error", err)
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to process tag data.")
		}
		tags = append(tags, tag)
	}

	if err = rows.Err(); err != nil {
		logger.ErrorContext(ctx, "Error iterating tag rows", "error", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to process tag results.")
	}

	// --- Return Response ---
	logger.InfoContext(ctx, "Retrieved tags successfully", "count", len(tags))
	return c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    tags,
	})
}

// CreateTag creates a new tag. (Admin Only)
// It checks if a tag with the same name already exists before insertion.
//
// Request Body:
//   - Expects JSON with a "name" field (string).
//
// Returns:
//   - JSON response containing the newly created Tag object or an error response (409 if conflict).
func (h *Handler) CreateTag(c echo.Context) error {
	ctx := c.Request().Context()
	logger := slog.With("handler", "CreateTag")

	// --- Bind and Validate Request Body ---
	var tagCreate struct {
		Name string `json:"name" validate:"required,min=1,max=50"` // Add validation tags
	}
	if err := c.Bind(&tagCreate); err != nil {
		logger.WarnContext(ctx, "Failed to bind request body", "error", err)
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid request body: "+err.Error())
	}
	// TODO: Add explicit validation if not handled by middleware
	if tagCreate.Name == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "Tag name cannot be empty.")
	}

	logger.DebugContext(ctx, "Create tag request received", "tagName", tagCreate.Name)

	// --- Check for Existing Tag ---
	var exists bool
	err := h.db.Pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM tags WHERE name = $1)`, tagCreate.Name).Scan(&exists)
	if err != nil {
		logger.ErrorContext(ctx, "Failed to check for existing tag", "tagName", tagCreate.Name, "error", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "Database error checking tag.")
	}
	if exists {
		logger.WarnContext(ctx, "Attempted to create duplicate tag", "tagName", tagCreate.Name)
		return echo.NewHTTPError(http.StatusConflict, fmt.Sprintf("Tag '%s' already exists.", tagCreate.Name))
	}

	// --- Insert Tag into Database ---
	var newTag models.Tag
	err = h.db.Pool.QueryRow(ctx, `
        INSERT INTO tags (name, created_at) VALUES ($1, $2)
        RETURNING id, name, created_at
    `, tagCreate.Name, time.Now()).Scan(&newTag.ID, &newTag.Name, &newTag.CreatedAt)
	if err != nil {
		logger.ErrorContext(ctx, "Failed to insert tag into database", "tagName", tagCreate.Name, "error", err)
		// TODO: Check for specific DB errors (e.g., unique constraint race condition)
		return echo.NewHTTPError(http.StatusInternalServerError, "Database error: failed to create tag.")
	}

	// --- Return Response ---
	logger.InfoContext(ctx, "Tag created successfully", "tagID", newTag.ID, "tagName", newTag.Name)
	return c.JSON(http.StatusCreated, models.APIResponse{
		Success: true,
		Message: "Tag created successfully.",
		Data:    newTag,
	})
}

// DeleteTag deletes a tag by its ID. (Admin Only)
// It checks if the tag is currently associated with any tickets before deleting.
//
// Path Parameters:
//   - id: The UUID of the tag to delete.
//
// Returns:
//   - JSON success message or an error response (400 if tag is in use, 404 if not found).
func (h *Handler) DeleteTag(c echo.Context) error {
	ctx := c.Request().Context()
	tagID := c.Param("id")
	logger := slog.With("handler", "DeleteTag", "tagID", tagID)

	// --- Input Validation ---
	if tagID == "" {
		logger.WarnContext(ctx, "Missing tag ID in request path")
		return echo.NewHTTPError(http.StatusBadRequest, "Missing tag ID.")
	}

	// --- Check if Tag is in Use ---
	var inUse bool
	// Check the ticket_tags join table
	err := h.db.Pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM ticket_tags WHERE tag_id = $1)`, tagID).Scan(&inUse)
	if err != nil {
		// Handle case where tag doesn't exist at all during this check
		if errors.Is(err, pgx.ErrNoRows) {
			// This might indicate the tag was already deleted or never existed, but the check itself didn't fail
			logger.WarnContext(ctx, "Tag not found during usage check, proceeding with delete attempt")
			// Continue to the delete step, which will handle the 404 if needed
		} else {
			logger.ErrorContext(ctx, "Failed to check tag usage", "error", err)
			return echo.NewHTTPError(http.StatusInternalServerError, "Database error checking tag usage.")
		}
	}

	if inUse {
		logger.WarnContext(ctx, "Attempted to delete tag that is currently in use")
		return echo.NewHTTPError(http.StatusBadRequest, "Cannot delete tag: it is currently assigned to one or more tickets.")
	}

	// --- Execute Delete Query ---
	// Deleting from `tags` might fail if FK constraints exist elsewhere, but
	// the primary check is `ticket_tags`. If `ticket_tags` has ON DELETE CASCADE,
	// deleting from `tags` will automatically remove the links.
	commandTag, err := h.db.Pool.Exec(ctx, `DELETE FROM tags WHERE id = $1`, tagID)
	if err != nil {
		logger.ErrorContext(ctx, "Failed to execute tag deletion query", "error", err)
		// TODO: Handle specific DB errors (e.g., foreign key constraints if not ON DELETE CASCADE)
		return echo.NewHTTPError(http.StatusInternalServerError, "Database error: failed to delete tag.")
	}

	// Check if any row was actually deleted
	if commandTag.RowsAffected() == 0 {
		logger.WarnContext(ctx, "Tag deletion affected 0 rows, tag likely not found")
		return echo.NewHTTPError(http.StatusNotFound, "Tag not found.")
	}

	// --- Return Response ---
	logger.InfoContext(ctx, "Tag deleted successfully")
	return c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Message: "Tag deleted successfully.",
	})
}
