// backend/internal/api/handlers/faq/faq.go
// ==========================================================================
// Handler functions for managing Frequently Asked Questions (FAQ) entries.
// Provides endpoints for CRUD operations on FAQs.
// ==========================================================================

package faq

import (
	"errors"
	"log/slog"
	"net/http"
	"time"

	"github.com/henrythedeveloper/it-ticket-system/internal/db"
	"github.com/henrythedeveloper/it-ticket-system/internal/models"
	"github.com/jackc/pgx/v5"
	"github.com/labstack/echo/v4"
)

// --- Handler Struct ---

// Handler holds dependencies for FAQ-related request handlers.
type Handler struct {
	db *db.DB // Database connection pool
}

// --- Constructor ---

// NewHandler creates a new instance of the FAQ Handler.
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

// RegisterRoutes defines and registers all API routes managed by this FAQ handler.
// It maps HTTP methods and paths to specific handler functions and applies admin middleware
// for protected operations (Create, Update, Delete).
//
// Parameters:
//   - g: The echo group (e.g., /api/faq) to register routes onto (*echo.Group).
//   - h: The FAQ Handler instance (*Handler).
//   - adminMiddleware: The middleware function to restrict access to Admins only.
func RegisterRoutes(g *echo.Group, h *Handler, adminMiddleware echo.MiddlewareFunc) {
	slog.Debug("Registering FAQ routes")

	// Public routes (Read operations)
	g.GET("", h.GetAllFAQs)     // GET /api/faq
	g.GET("/:id", h.GetFAQByID) // GET /api/faq/{id}

	// Admin-protected routes (Write operations)
	g.POST("", h.CreateFAQ, adminMiddleware)       // POST /api/faq
	g.PUT("/:id", h.UpdateFAQ, adminMiddleware)    // PUT /api/faq/{id}
	g.DELETE("/:id", h.DeleteFAQ, adminMiddleware) // DELETE /api/faq/{id}

	slog.Debug("Finished registering FAQ routes")
}

// --- Handler Functions ---

// GetAllFAQs retrieves all FAQ entries, optionally filtered by category.
//
// Query Parameters:
//   - category (optional): Filters FAQs by the specified category name.
//
// Returns:
//   - JSON response containing an array of FAQEntry objects or an error response.
func (h *Handler) GetAllFAQs(c echo.Context) error {
	ctx := c.Request().Context()
	category := c.QueryParam("category")
	logger := slog.With("handler", "GetAllFAQs", "categoryFilter", category)

	// --- Build Query ---
	query := `
        SELECT id, question, answer, category, created_at, updated_at
        FROM faq_entries
    `
	args := []interface{}{}
	if category != "" {
		query += " WHERE category = $1"
		args = append(args, category)
	}
	query += " ORDER BY category, created_at" // Order for consistent results

	logger.DebugContext(ctx, "Executing GetAllFAQs query", "query", query, "args", args)

	// --- Execute Query ---
	rows, err := h.db.Pool.Query(ctx, query, args...)
	if err != nil {
		logger.ErrorContext(ctx, "Database query failed", "error", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to retrieve FAQs.")
	}
	defer rows.Close()

	// --- Scan Results ---
	faqs := make([]models.FAQEntry, 0)
	for rows.Next() {
		var faq models.FAQEntry
		if err := rows.Scan(
			&faq.ID, &faq.Question, &faq.Answer, &faq.Category,
			&faq.CreatedAt, &faq.UpdatedAt,
		); err != nil {
			logger.ErrorContext(ctx, "Failed to scan FAQ row", "error", err)
			// Return error immediately if scanning fails for one row
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to process FAQ data.")
		}
		faqs = append(faqs, faq)
	}

	if err = rows.Err(); err != nil {
		logger.ErrorContext(ctx, "Error iterating FAQ rows", "error", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to process FAQ results.")
	}

	// --- Return Response ---
	logger.InfoContext(ctx, "Retrieved FAQs successfully", "count", len(faqs))
	return c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    faqs,
	})
}

// GetFAQByID retrieves a single FAQ entry by its ID.
//
// Path Parameters:
//   - id: The UUID of the FAQ entry to retrieve.
//
// Returns:
//   - JSON response containing the FAQEntry object or an error response (404 if not found).
func (h *Handler) GetFAQByID(c echo.Context) error {
	ctx := c.Request().Context()
	faqID := c.Param("id")
	logger := slog.With("handler", "GetFAQByID", "faqID", faqID)

	if faqID == "" {
		logger.WarnContext(ctx, "Missing FAQ ID in request path")
		return echo.NewHTTPError(http.StatusBadRequest, "Missing FAQ ID.")
	}

	// --- Fetch FAQ from Database ---
	var faq models.FAQEntry
	err := h.db.Pool.QueryRow(ctx, `
        SELECT id, question, answer, category, created_at, updated_at
        FROM faq_entries
        WHERE id = $1
    `, faqID).Scan(
		&faq.ID, &faq.Question, &faq.Answer, &faq.Category,
		&faq.CreatedAt, &faq.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			logger.WarnContext(ctx, "FAQ not found")
			return echo.NewHTTPError(http.StatusNotFound, "FAQ entry not found.")
		}
		logger.ErrorContext(ctx, "Database query failed", "error", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to retrieve FAQ entry.")
	}

	// --- Return Response ---
	logger.InfoContext(ctx, "Retrieved FAQ by ID successfully")
	return c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    faq,
	})
}

// CreateFAQ creates a new FAQ entry. (Admin Only)
//
// Request Body:
//   - Expects JSON matching models.FAQCreate (question, answer, category).
//
// Returns:
//   - JSON response containing the newly created FAQEntry object or an error response.
func (h *Handler) CreateFAQ(c echo.Context) error {
	ctx := c.Request().Context()
	logger := slog.With("handler", "CreateFAQ")

	// --- Bind and Validate Request Body ---
	var faqCreate models.FAQCreate
	if err := c.Bind(&faqCreate); err != nil {
		logger.WarnContext(ctx, "Failed to bind request body", "error", err)
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid request body: "+err.Error())
	}
	// TODO: Add validation for FAQCreate fields (e.g., non-empty)

	logger.DebugContext(ctx, "Create FAQ request received", "category", faqCreate.Category)

	// --- Insert FAQ into Database ---
	var createdFAQ models.FAQEntry
	err := h.db.Pool.QueryRow(ctx, `
        INSERT INTO faq_entries (question, answer, category, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, question, answer, category, created_at, updated_at
    `,
		faqCreate.Question, faqCreate.Answer, faqCreate.Category,
		time.Now(), time.Now(), // Set created_at and updated_at
	).Scan(
		&createdFAQ.ID, &createdFAQ.Question, &createdFAQ.Answer, &createdFAQ.Category,
		&createdFAQ.CreatedAt, &createdFAQ.UpdatedAt,
	)
	if err != nil {
		logger.ErrorContext(ctx, "Failed to insert FAQ into database", "error", err)
		// TODO: Check for specific DB errors (e.g., constraints)
		return echo.NewHTTPError(http.StatusInternalServerError, "Database error: failed to create FAQ entry.")
	}

	// --- Return Response ---
	logger.InfoContext(ctx, "FAQ entry created successfully", "faqID", createdFAQ.ID)
	return c.JSON(http.StatusCreated, models.APIResponse{
		Success: true,
		Message: "FAQ entry created successfully.",
		Data:    createdFAQ,
	})
}

// UpdateFAQ updates an existing FAQ entry. (Admin Only)
//
// Path Parameters:
//   - id: The UUID of the FAQ entry to update.
//
// Request Body:
//   - Expects JSON matching models.FAQCreate (question, answer, category).
//
// Returns:
//   - JSON response containing the updated FAQEntry object or an error response.
func (h *Handler) UpdateFAQ(c echo.Context) error {
	ctx := c.Request().Context()
	faqID := c.Param("id")
	logger := slog.With("handler", "UpdateFAQ", "faqID", faqID)

	// --- Input Validation & Binding ---
	if faqID == "" {
		logger.WarnContext(ctx, "Missing FAQ ID in request path")
		return echo.NewHTTPError(http.StatusBadRequest, "Missing FAQ ID.")
	}

	var faqUpdate models.FAQCreate
	if err := c.Bind(&faqUpdate); err != nil {
		logger.WarnContext(ctx, "Failed to bind request body", "error", err)
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid request body: "+err.Error())
	}
	// TODO: Add validation for faqUpdate fields

	logger.DebugContext(ctx, "Update FAQ request received", "category", faqUpdate.Category)

	// --- Update FAQ in Database ---
	var updatedFAQ models.FAQEntry
	err := h.db.Pool.QueryRow(ctx, `
        UPDATE faq_entries
        SET question = $1, answer = $2, category = $3, updated_at = $4
        WHERE id = $5
        RETURNING id, question, answer, category, created_at, updated_at
    `,
		faqUpdate.Question, faqUpdate.Answer, faqUpdate.Category,
		time.Now(), // Update updated_at timestamp
		faqID,
	).Scan(
		&updatedFAQ.ID, &updatedFAQ.Question, &updatedFAQ.Answer, &updatedFAQ.Category,
		&updatedFAQ.CreatedAt, &updatedFAQ.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			logger.WarnContext(ctx, "FAQ not found for update")
			return echo.NewHTTPError(http.StatusNotFound, "FAQ entry not found.")
		}
		logger.ErrorContext(ctx, "Failed to execute FAQ update query", "error", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "Database error: failed to update FAQ entry.")
	}

	// --- Return Response ---
	logger.InfoContext(ctx, "FAQ entry updated successfully")
	return c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Message: "FAQ entry updated successfully.",
		Data:    updatedFAQ,
	})
}

// DeleteFAQ deletes an FAQ entry by its ID. (Admin Only)
//
// Path Parameters:
//   - id: The UUID of the FAQ entry to delete.
//
// Returns:
//   - JSON success message or an error response.
func (h *Handler) DeleteFAQ(c echo.Context) error {
	ctx := c.Request().Context()
	faqID := c.Param("id")
	logger := slog.With("handler", "DeleteFAQ", "faqID", faqID)

	// --- Input Validation ---
	if faqID == "" {
		logger.WarnContext(ctx, "Missing FAQ ID in request path")
		return echo.NewHTTPError(http.StatusBadRequest, "Missing FAQ ID.")
	}

	// --- Execute Delete Query ---
	commandTag, err := h.db.Pool.Exec(ctx, `DELETE FROM faq_entries WHERE id = $1`, faqID)
	if err != nil {
		logger.ErrorContext(ctx, "Failed to execute FAQ deletion query", "error", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "Database error: failed to delete FAQ entry.")
	}

	// Check if any row was actually deleted
	if commandTag.RowsAffected() == 0 {
		logger.WarnContext(ctx, "FAQ deletion affected 0 rows, entry likely not found")
		return echo.NewHTTPError(http.StatusNotFound, "FAQ entry not found.")
	}

	// --- Return Response ---
	logger.InfoContext(ctx, "FAQ entry deleted successfully")
	return c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Message: "FAQ entry deleted successfully.",
	})
}
