// backend/internal/models/models.go
// ==========================================================================
// Defines the core data structures (structs) and enumerated types used
// throughout the backend application.
// **REVISED**: Standardized all JSON tags to use snake_case.
// **REVISED AGAIN**: Added distinct TaskUpdate struct.
// **REVISED AGAIN**: Added snake_case JSON tags to Filter structs.
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
	RoleStaff UserRole = "Staff"
	RoleAdmin UserRole = "Admin"
	RoleUser  UserRole = "User"
)

type User struct {
	ID           string    `json:"id"`
	Name         string    `json:"name"`
	Email        string    `json:"email"`
	PasswordHash string    `json:"-"`
	Role         UserRole  `json:"role"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type UserCreate struct {
	Name     string   `json:"name" validate:"required,min=2,max=100"`
	Email    string   `json:"email" validate:"required,email"`
	Password string   `json:"password" validate:"required,min=8"`
	Role     UserRole `json:"role" validate:"required,oneof=Staff Admin"`
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

// ==========================================================================
// Ticket Models
// ==========================================================================

type TicketStatus string

const (
	StatusUnassigned TicketStatus = "Unassigned"
	StatusAssigned   TicketStatus = "Assigned"
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
	EndUserEmail   string         `json:"end_user_email"`
	IssueType        string         `json:"issue_type,omitempty"`
	Urgency          TicketUrgency  `json:"urgency"`
	Subject          string         `json:"subject"`
	Description      string         `json:"description"`
	Status           TicketStatus   `json:"status"`
	AssignedToUserID *string        `json:"assigned_to_user_id,omitempty"`
	AssignedToUser   *User          `json:"assigned_to_user,omitempty"`
	Submitter        *User          `json:"submitter,omitempty"`
	CreatedAt        time.Time      `json:"created_at"`
	UpdatedAt        time.Time      `json:"updated_at"`
	ClosedAt         *time.Time     `json:"closed_at,omitempty"`
	ResolutionNotes  *string        `json:"resolution_notes,omitempty"`
	Tags             []Tag          `json:"tags,omitempty"`
	Updates          []TicketUpdate `json:"updates,omitempty"`
	Attachments      []Attachment   `json:"attachments,omitempty"`
}

type TicketCreate struct {
	EndUserEmail string        `json:"end_user_email" validate:"required,email"`
	IssueType      string        `json:"issue_type" validate:"required"`
	Urgency        TicketUrgency `json:"urgency" validate:"required,oneof=Low Medium High Critical"`
	Subject        string        `json:"subject" validate:"required,min=5,max=200"`
	Description    string        `json:"description" validate:"required"`
	Tags           []string      `json:"tags,omitempty"`
}

type TicketUpdate struct {
	ID             string    `json:"id"`
	TicketID       string    `json:"ticket_id"`
	UserID         *string   `json:"user_id,omitempty"`
	User           *User     `json:"user,omitempty"`
	Comment        string    `json:"comment"`
	IsInternalNote bool      `json:"is_internal_note"`
	CreatedAt      time.Time `json:"created_at"`
}

type TicketUpdateCreate struct {
	Comment        string `json:"comment" validate:"required"`
	IsInternalNote bool   `json:"is_internal_note"`
}

type TicketStatusUpdate struct {
	Status           TicketStatus `json:"status" validate:"required,oneof=Unassigned Assigned In Progress Closed"`
	AssignedToUserID *string      `json:"assigned_to_user_id,omitempty"`
	ResolutionNotes  *string      `json:"resolution_notes,omitempty"`
}

type Attachment struct {
	ID          string    `json:"id"`
	TicketID    string    `json:"ticket_id"`
	Filename    string    `json:"filename"`
	StoragePath string    `json:"storage_path"`
	MimeType    string    `json:"mime_type"`
	Size        int64     `json:"size"`
	UploadedAt  time.Time `json:"uploaded_at"`
	URL         string    `json:"url,omitempty"`
}

// ==========================================================================
// Task Models
// ==========================================================================

type TaskStatus string

const (
	TaskStatusOpen       TaskStatus = "Open"
	TaskStatusInProgress TaskStatus = "In Progress"
	TaskStatusCompleted  TaskStatus = "Completed"
)

type TaskUpdate struct {
	ID        string    `json:"id"`
	TaskID    string    `json:"task_id"`
	UserID    *string   `json:"user_id,omitempty"`
	User      *User     `json:"user,omitempty"`
	Comment   string    `json:"comment"`
	CreatedAt time.Time `json:"created_at"`
}

type Task struct {
	ID               string       `json:"id"`
	TaskNumber       int32        `json:"task_number"`
	Title            string       `json:"title"`
	Description      *string      `json:"description,omitempty"`
	Status           TaskStatus   `json:"status"`
	AssignedToUserID *string      `json:"assigned_to_user_id,omitempty"`
	AssignedToUser   *User        `json:"assigned_to_user,omitempty"`
	CreatedByUserID  string       `json:"created_by_user_id"`
	CreatedByUser    *User        `json:"created_by_user,omitempty"`
	DueDate          *time.Time   `json:"due_date,omitempty"`
	IsRecurring      bool         `json:"is_recurring"`
	RecurrenceRule   *string      `json:"recurrence_rule,omitempty"`
	CreatedAt        time.Time    `json:"created_at"`
	UpdatedAt        time.Time    `json:"updated_at"`
	CompletedAt      *time.Time   `json:"completed_at,omitempty"`
	Updates          []TaskUpdate `json:"updates,omitempty"`
}

type TaskCreate struct {
	Title          string     `json:"title" validate:"required,min=3,max=200"`
	Description    *string    `json:"description,omitempty"`
	AssignedToID   *string    `json:"assigned_to_user_id,omitempty"`
	DueDate        *time.Time `json:"due_date,omitempty"`
	IsRecurring    bool       `json:"is_recurring"`
	RecurrenceRule *string    `json:"recurrence_rule,omitempty"`
	TicketID       *string    `json:"ticket_id,omitempty"`
}

type TaskUpdateCreate struct {
	Comment string `json:"comment" validate:"required"`
}

type TaskStatusUpdate struct {
	Status TaskStatus `json:"status" validate:"required,oneof=Open In Progress Completed"`
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
// API & Common Models
// ==========================================================================

type APIResponse struct {
	Success bool        `json:"success"`
	Message string      `json:"message,omitempty"`
	Data    interface{} `json:"data,omitempty"`
	Error   string      `json:"error,omitempty"`
}

type PaginatedResponse struct {
	Success    bool        `json:"success"`
	Message    string      `json:"message,omitempty"`
	Data       interface{} `json:"data"`
	Total      int         `json:"total"`
	Page       int         `json:"page"`
	Limit      int         `json:"limit"`
	TotalPages int         `json:"total_pages"`
	HasMore    bool        `json:"has_more"`
}

// TicketFilter represents potential query parameters for filtering the ticket list.
// These fields are not directly bound from JSON but used internally to build queries.
// JSON tags are added for consistency documentation, though not strictly necessary here.
type TicketFilter struct {
	Status      *TicketStatus  `json:"status,omitempty"`
	Urgency     *TicketUrgency `json:"urgency,omitempty"`
	AssignedTo  *string        `json:"assigned_to,omitempty"`  // Handles "me", "unassigned", or ID
	SubmitterID *string        `json:"submitter_id,omitempty"` // Changed from EndUserEmail for clarity
	FromDate    *time.Time     `json:"from_date,omitempty"`
	ToDate      *time.Time     `json:"to_date,omitempty"`
	Tags        []string       `json:"tags,omitempty"`
	Search      string         `json:"search,omitempty"`
	Page        int            `json:"page,omitempty"`
	Limit       int            `json:"limit,omitempty"`
	SortBy      string         `json:"sort_by,omitempty"`
	SortOrder   string         `json:"sort_order,omitempty"`
}

// TaskFilter represents potential query parameters for filtering the task list.
// JSON tags added for consistency documentation.
type TaskFilter struct {
	Status      *TaskStatus `json:"status,omitempty"`
	AssignedTo  *string     `json:"assigned_to,omitempty"`
	CreatedBy   *string     `json:"created_by,omitempty"`
	DueFromDate *time.Time  `json:"due_from_date,omitempty"`
	DueToDate   *time.Time  `json:"due_to_date,omitempty"`
	IsRecurring *bool       `json:"is_recurring,omitempty"`
	Search      string      `json:"search,omitempty"`
	Page        int         `json:"page,omitempty"`
	Limit       int         `json:"limit,omitempty"`
	SortBy      string      `json:"sort_by,omitempty"`
	SortOrder   string      `json:"sort_order,omitempty"`
}
