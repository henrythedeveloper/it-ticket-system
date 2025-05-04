// backend/internal/models/models.go
// ==========================================================================
// Defines the core data structures (structs) and enumerated types used
// throughout the backend application.
// **REVISED**: Changed json tag for ConfirmPassword to camelCase.
// ==========================================================================

package models

import (
	"time"
)

// ==========================================================================
// User & Authentication Models
// ==========================================================================

type UserRole string

const (
	RoleStaff UserRole = "Staff" // Default role for self-registration will be set here
	RoleAdmin UserRole = "Admin"
	RoleUser  UserRole = "User" // This role might still be used if Admins create users explicitly with this role
)

type User struct {
	ID           string    `json:"id"`
	Name         string    `json:"name"`
	Email        string    `json:"email"`
	PasswordHash string    `json:"-"` // Never expose hash
	Role         UserRole  `json:"role"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// UserCreate: Used by Admins to create users (requires role)
type UserCreate struct {
	Name     string   `json:"name" validate:"required,min=2,max=100"`
	Email    string   `json:"email" validate:"required,email"`
	Password string   `json:"password" validate:"required,min=8"`
	Role     UserRole `json:"role" validate:"required,oneof=Staff Admin User"` // Allow 'User' role creation by admin too
}

// UserRegister: Used for public self-registration (no role specified, defaults to 'Staff' now)
type UserRegister struct {
	Name            string `json:"name" validate:"required,min=2,max=100"`
	Email           string `json:"email" validate:"required,email"`
	Password        string `json:"password" validate:"required,min=8"`
	// *** FIXED: Changed json tag to match frontend ***
	ConfirmPassword string `json:"confirmPassword" validate:"required,eqfield=Password"`
}

type UserLogin struct {
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required"`
}

type Token struct {
	AccessToken string    `json:"access_token"`
	TokenType   string    `json:"token_type"`
	ExpiresAt   time.Time `json:"expires_at"`
}

// PasswordResetRequest: Used for the 'forgot password' endpoint
type PasswordResetRequest struct {
	Email string `json:"email" validate:"required,email"`
}

// PasswordResetPayload: Used for the 'reset password' endpoint
type PasswordResetPayload struct {
	Token           string `json:"token" validate:"required"`
	// Use snake_case if backend expects it, otherwise camelCase
	NewPassword     string `json:"newPassword" validate:"required,min=8"` // Assuming frontend sends camelCase
	ConfirmPassword string `json:"confirmPassword" validate:"required,eqfield=NewPassword"` // Assuming frontend sends camelCase
}

// PasswordResetToken: Represents the structure in the database (used internally)
// Assumes RAW token is stored in 'token' column based on previous fix.
type PasswordResetToken struct {
	Token     string    `db:"token"` // Raw token
	UserID    string    `db:"user_id"`
	ExpiresAt time.Time `db:"expires_at"`
	CreatedAt time.Time `db:"created_at"`
}


// ==========================================================================
// Ticket Models
// ==========================================================================

type TicketStatus string

const (
	StatusOpen       TicketStatus = "Open"
	StatusInProgress TicketStatus = "In Progress"
	StatusClosed     TicketStatus = "Closed"
)

type TicketUrgency string

const (
	UrgencyLow      TicketUrgency = "Low"
	UrgencyMedium   TicketUrgency = "Medium"
	UrgencyHigh     TicketUrgency = "High"
	UrgencyCritical TicketUrgency = "Critical"
)

type Ticket struct {
	ID               string         `json:"id"`
	TicketNumber     int32          `json:"ticket_number"`
	SubmitterName    *string        `json:"submitter_name,omitempty"`
	EndUserEmail     string         `json:"end_user_email"`
	IssueType        string         `json:"issue_type,omitempty"`
	Urgency          TicketUrgency  `json:"urgency"`
	Subject          string         `json:"subject"`
	Description      string         `json:"description"`
	Status           TicketStatus   `json:"status"`
	AssignedToUserID *string        `json:"assigned_to_user_id,omitempty"`
	AssignedToUser   *User          `json:"assigned_to_user,omitempty"` // Populated by JOIN
	Submitter        *User          `json:"submitter,omitempty"`       // Populated by JOIN based on email
	CreatedAt        time.Time      `json:"created_at"`
	UpdatedAt        time.Time      `json:"updated_at"`
	ClosedAt         *time.Time     `json:"closed_at,omitempty"`
	ResolutionNotes  *string        `json:"resolution_notes,omitempty"`
	Tags             []Tag          `json:"tags,omitempty"`
	Updates          []TicketUpdate `json:"updates,omitempty"`
	Attachments      []Attachment   `json:"attachments,omitempty"`
}

type TicketCreate struct {
	SubmitterName *string       `json:"submitter_name,omitempty"`
	EndUserEmail  string        `json:"end_user_email" validate:"required,email"`
	IssueType     string        `json:"issue_type" validate:"omitempty"` // Optional
	Urgency       TicketUrgency `json:"urgency" validate:"required,oneof=Low Medium High Critical"`
	Subject       string        `json:"subject" validate:"required,min=5,max=200"`
	Description   string        `json:"description" validate:"required"`
	Tags          []string      `json:"tags,omitempty"` // Tags submitted by name
}

type TicketUpdate struct {
	ID             string    `json:"id"`
	TicketID       string    `json:"ticket_id"`
	UserID         *string   `json:"user_id,omitempty"`
	User           *User     `json:"user,omitempty"` // Author of the update
	Comment        string    `json:"comment"`
	IsInternalNote bool      `json:"is_internal_note"`
	IsSystemUpdate bool      `json:"is_system_update,omitempty"`
	CreatedAt      time.Time `json:"created_at"`
}

// TicketState: Used internally for checking state before updates
type TicketState struct {
    Status           TicketStatus
    AssignedToUserID *string
    EndUserEmail     string
    Subject          string
    TicketNumber     int32
    ResolutionNotes  *string
}

type TicketUpdateCreate struct {
	Comment        string `json:"content" validate:"required"` // Matches frontend form field name
	IsInternalNote bool   `json:"is_internal_note"`
}

type TicketStatusUpdate struct {
	Status           TicketStatus `json:"status" validate:"required,oneof=Open In Progress Closed"`
	AssignedToUserID *string      `json:"assignedToId,omitempty"` // Frontend sends 'assignedToId'
	ResolutionNotes  *string      `json:"resolution_notes,omitempty"`
}

type Attachment struct {
	ID                string    `json:"id"`
	TicketID          string    `json:"ticket_id"`
	Filename          string    `json:"filename"`
	StoragePath       string    `json:"storage_path"` // Usually internal, might omit from JSON
	MimeType          string    `json:"mime_type"`
	Size              int64     `json:"size"`
	UploadedAt        time.Time `json:"uploaded_at"`
	URL               string    `json:"url,omitempty"` // Download URL
	UploadedByUserID  string    `json:"uploaded_by_user_id,omitempty"`
	UploadedByRole    string    `json:"uploaded_by_role,omitempty"`
}

// ==========================================================================
// FAQ Models
// ==========================================================================

type FAQEntry struct {
	ID        string    `json:"id"`
	Question  string    `json:"question"`
	Answer    string    `json:"answer"`
	Category  string    `json:"category"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type FAQCreate struct {
	Question string `json:"question" validate:"required,min=10"`
	Answer   string `json:"answer" validate:"required"`
	Category string `json:"category" validate:"required"`
}

// ==========================================================================
// Tag Models
// ==========================================================================

type Tag struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"created_at"`
}

// ==========================================================================
// Notification Models
// ==========================================================================

type Notification struct {
	ID              string    `json:"id"`
	UserID          string    `json:"user_id"`
	Type            string    `json:"type"` // e.g., "TicketAssigned", "NewComment"
	Message         string    `json:"message"`
	RelatedTicketID *string   `json:"related_ticket_id,omitempty"`
	IsRead          bool      `json:"is_read"`
	CreatedAt       time.Time `json:"created_at"`
}

type NotificationListResponse struct {
	Success bool           `json:"success"`
	Data    []Notification `json:"data"`
	Total   int            `json:"total"`
}

// ==========================================================================
// API & Common Models
// ==========================================================================

// APIResponse is a standard wrapper for single-item API responses.
type APIResponse struct {
	Success bool        `json:"success"`
	Message string      `json:"message,omitempty"`
	Data    interface{} `json:"data,omitempty"` // Can be any type of data
	Error   string      `json:"error,omitempty"`
}

// PaginatedResponse is a standard wrapper for list API responses with pagination info.
type PaginatedResponse struct {
	Success    bool        `json:"success"`
	Message    string      `json:"message,omitempty"`
	Data       interface{} `json:"data"` // Usually a slice of items (e.g., []Ticket, []User)
	Total      int         `json:"total"`
	Page       int         `json:"page"`
	Limit      int         `json:"limit"`
	TotalPages int         `json:"total_pages"`
	HasMore    bool        `json:"has_more"` // Calculated field for frontend convenience
}

// TicketFilter represents potential query parameters for filtering the ticket list.
// JSON tags added for consistency documentation.
type TicketFilter struct {
	Status      *TicketStatus  `json:"status,omitempty"`
	Urgency     *TicketUrgency `json:"urgency,omitempty"`
	AssignedTo  *string        `json:"assigned_to,omitempty"`  // Handles "me", "unassigned", or ID
	SubmitterID *string        `json:"submitter_id,omitempty"` // Can filter by submitter's user ID if available
	FromDate    *time.Time     `json:"from_date,omitempty"`
	ToDate      *time.Time     `json:"to_date,omitempty"`
	Tags        []string       `json:"tags,omitempty"`
	Search      string         `json:"search,omitempty"`
	Page        int            `json:"page,omitempty"`
	Limit       int            `json:"limit,omitempty"`
	SortBy      string         `json:"sort_by,omitempty"`
	SortOrder   string         `json:"sort_order,omitempty"` // "asc" or "desc"
}

