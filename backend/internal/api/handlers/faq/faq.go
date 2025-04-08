package faq

import (
	"errors"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/labstack/echo/v4"
	"github.com/henrythedeveloper/bus-it-ticket/internal/db"
	"github.com/henrythedeveloper/bus-it-ticket/internal/models"
)

// Handler handles FAQ-related requests
type Handler struct {
	db *db.DB
}

// NewHandler creates a new FAQ handler
func NewHandler(db *db.DB) *Handler {
	return &Handler{
		db: db,
	}
}

// RegisterRoutes registers the FAQ handler routes
func RegisterRoutes(g *echo.Group, h *Handler, adminMiddleware echo.MiddlewareFunc) {
	g.GET("", h.GetAllFAQs)
	g.GET("/:id", h.GetFAQByID)
	g.POST("", h.CreateFAQ, adminMiddleware)
	g.PUT("/:id", h.UpdateFAQ, adminMiddleware)
	g.DELETE("/:id", h.DeleteFAQ, adminMiddleware)
}

// GetAllFAQs returns all FAQ entries
func (h *Handler) GetAllFAQs(c echo.Context) error {
	ctx := c.Request().Context()

	// Get optional category filter
	category := c.QueryParam("category")
	query := `
		SELECT id, question, answer, category, created_at, updated_at
		FROM faq_entries
	`
	args := []interface{}{}
	
	if category != "" {
		query += " WHERE category = $1"
		args = append(args, category)
	}
	
	query += " ORDER BY category, created_at"

	// Get FAQs from database
	rows, err := h.db.Pool.Query(ctx, query, args...)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to get FAQs")
	}
	defer rows.Close()

	var faqs []models.FAQEntry
	for rows.Next() {
		var faq models.FAQEntry
		if err := rows.Scan(
			&faq.ID,
			&faq.Question,
			&faq.Answer,
			&faq.Category,
			&faq.CreatedAt,
			&faq.UpdatedAt,
		); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "failed to scan FAQ")
		}
		faqs = append(faqs, faq)
	}

	return c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    faqs,
	})
}

// GetFAQByID returns a FAQ entry by ID
func (h *Handler) GetFAQByID(c echo.Context) error {
	faqID := c.Param("id")
	if faqID == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "missing FAQ ID")
	}

	ctx := c.Request().Context()

	// Get FAQ from database
	var faq models.FAQEntry
	err := h.db.Pool.QueryRow(ctx, `
		SELECT id, question, answer, category, created_at, updated_at
		FROM faq_entries
		WHERE id = $1
	`, faqID).Scan(
		&faq.ID,
		&faq.Question,
		&faq.Answer,
		&faq.Category,
		&faq.CreatedAt,
		&faq.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return echo.NewHTTPError(http.StatusNotFound, "FAQ not found")
		}
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to get FAQ")
	}

	return c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    faq,
	})
}

// CreateFAQ creates a new FAQ entry
func (h *Handler) CreateFAQ(c echo.Context) error {
	var faqCreate models.FAQCreate
	if err := c.Bind(&faqCreate); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}

	ctx := c.Request().Context()

	// Create FAQ in database
	var faq models.FAQEntry
	err := h.db.Pool.QueryRow(ctx, `
		INSERT INTO faq_entries (question, answer, category, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, question, answer, category, created_at, updated_at
	`,
		faqCreate.Question,
		faqCreate.Answer,
		faqCreate.Category,
		time.Now(),
		time.Now(),
	).Scan(
		&faq.ID,
		&faq.Question,
		&faq.Answer,
		&faq.Category,
		&faq.CreatedAt,
		&faq.UpdatedAt,
	)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to create FAQ")
	}

	return c.JSON(http.StatusCreated, models.APIResponse{
		Success: true,
		Message: "FAQ created successfully",
		Data:    faq,
	})
}

// UpdateFAQ updates an FAQ entry
func (h *Handler) UpdateFAQ(c echo.Context) error {
	faqID := c.Param("id")
	if faqID == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "missing FAQ ID")
	}

	var faqUpdate models.FAQCreate
	if err := c.Bind(&faqUpdate); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}

	ctx := c.Request().Context()

	// Update FAQ in database
	var faq models.FAQEntry
	err := h.db.Pool.QueryRow(ctx, `
		UPDATE faq_entries
		SET question = $1, answer = $2, category = $3, updated_at = $4
		WHERE id = $5
		RETURNING id, question, answer, category, created_at, updated_at
	`,
		faqUpdate.Question,
		faqUpdate.Answer,
		faqUpdate.Category,
		time.Now(),
		faqID,
	).Scan(
		&faq.ID,
		&faq.Question,
		&faq.Answer,
		&faq.Category,
		&faq.CreatedAt,
		&faq.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return echo.NewHTTPError(http.StatusNotFound, "FAQ not found")
		}
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to update FAQ")
	}

	return c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Message: "FAQ updated successfully",
		Data:    faq,
	})
}

// DeleteFAQ deletes an FAQ entry
func (h *Handler) DeleteFAQ(c echo.Context) error {
	faqID := c.Param("id")
	if faqID == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "missing FAQ ID")
	}

	ctx := c.Request().Context()

	// Delete FAQ from database
	result, err := h.db.Pool.Exec(ctx, `
		DELETE FROM faq_entries
		WHERE id = $1
	`, faqID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to delete FAQ")
	}

	if result.RowsAffected() == 0 {
		return echo.NewHTTPError(http.StatusNotFound, "FAQ not found")
	}

	return c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Message: "FAQ deleted successfully",
	})
}