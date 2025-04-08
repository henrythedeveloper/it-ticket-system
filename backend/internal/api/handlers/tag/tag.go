package tag

import (
	"net/http"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/henrythedeveloper/bus-it-ticket/internal/db"
	"github.com/henrythedeveloper/bus-it-ticket/internal/models"
)

// Handler handles tag-related requests
type Handler struct {
	db *db.DB
}

// NewHandler creates a new tag handler
func NewHandler(db *db.DB) *Handler {
	return &Handler{
		db: db,
	}
}

// RegisterRoutes registers the tag handler routes
func RegisterRoutes(g *echo.Group, h *Handler, adminMiddleware echo.MiddlewareFunc) {
	g.GET("", h.GetAllTags)
	g.POST("", h.CreateTag, adminMiddleware)
	g.DELETE("/:id", h.DeleteTag, adminMiddleware)
}

// GetAllTags returns all tags
func (h *Handler) GetAllTags(c echo.Context) error {
	ctx := c.Request().Context()

	// Get tags from database
	rows, err := h.db.Pool.Query(ctx, `
		SELECT id, name, created_at
		FROM tags
		ORDER BY name
	`)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to get tags")
	}
	defer rows.Close()

	var tags []models.Tag
	for rows.Next() {
		var tag models.Tag
		if err := rows.Scan(
			&tag.ID,
			&tag.Name,
			&tag.CreatedAt,
		); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "failed to scan tag")
		}
		tags = append(tags, tag)
	}

	return c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    tags,
	})
}

// CreateTag creates a new tag
func (h *Handler) CreateTag(c echo.Context) error {
	var tag struct {
		Name string `json:"name" validate:"required"`
	}
	
	if err := c.Bind(&tag); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}

	ctx := c.Request().Context()

	// Check if tag already exists
	var exists bool
	err := h.db.Pool.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1
			FROM tags
			WHERE name = $1
		)
	`, tag.Name).Scan(&exists)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to check tag")
	}
	if exists {
		return echo.NewHTTPError(http.StatusConflict, "tag already exists")
	}

	// Create tag in database
	var newTag models.Tag
	err = h.db.Pool.QueryRow(ctx, `
		INSERT INTO tags (name, created_at)
		VALUES ($1, $2)
		RETURNING id, name, created_at
	`,
		tag.Name,
		time.Now(),
	).Scan(
		&newTag.ID,
		&newTag.Name,
		&newTag.CreatedAt,
	)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to create tag")
	}

	return c.JSON(http.StatusCreated, models.APIResponse{
		Success: true,
		Message: "Tag created successfully",
		Data:    newTag,
	})
}

// DeleteTag deletes a tag
func (h *Handler) DeleteTag(c echo.Context) error {
	tagID := c.Param("id")
	if tagID == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "missing tag ID")
	}

	ctx := c.Request().Context()

	// Check if tag is in use
	var inUse bool
	err := h.db.Pool.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1
			FROM ticket_tags
			WHERE tag_id = $1
		)
	`, tagID).Scan(&inUse)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to check tag usage")
	}
	if inUse {
		return echo.NewHTTPError(http.StatusBadRequest, "cannot delete tag that is in use")
	}

	// Delete tag from database
	result, err := h.db.Pool.Exec(ctx, `
		DELETE FROM tags
		WHERE id = $1
	`, tagID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to delete tag")
	}

	if result.RowsAffected() == 0 {
		return echo.NewHTTPError(http.StatusNotFound, "tag not found")
	}

	return c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Message: "Tag deleted successfully",
	})
}