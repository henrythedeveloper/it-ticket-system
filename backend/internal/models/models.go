// backend/internal/models/models.go
// ==========================================================================
// Defines the core data structures (structs) and enumerated types used
// throughout the backend application. These models represent database entities,
// API request/response payloads, and other shared data shapes.
// ==========================================================================

package models

import (
	"time"
)

// ==========================================================================
// User & Authentication Models
// ==========================================================================

// UserRole defines the possible roles a user can have within the system.
type UserRole string

// Constants for the defined user roles.
const (
	RoleStaff UserRole = "Staff" // Regular IT staff member, can work on tickets/tasks.
	RoleAdmin UserRole = "Admin" // Administrator with full system privileges.
	RoleUser  UserRole = "User"  // Represents an end-user (submitter), potentially for future features.
)

// User represents a user account in the system.
type User struct {
	ID           string    `json:"id"`                      // Unique identifier (UUID)
	Name         string    `json:"name"`                    // User's full name
	Email        string    `json:"email"`                   // User's email address (unique)
	PasswordHash string    `json:"-"`                       // Hashed password (never exposed in API responses)
	Role         UserRole  `json:"role"`                    // User's role (Admin, Staff, User)
	CreatedAt    time.Time `json:"created_at"`              // Timestamp when the user was created
	UpdatedAt    time.Time `json:"updated_at"`              // Timestamp when the user was last updated
}

// UserCreate represents the data required to create a new user account.
// Used for binding request bodies, typically in admin-only endpoints.
type UserCreate struct {
	Name     string   `json:"name" validate:"required,min=2,max=100"`        // User's full name
	Email    string   `json:"email" validate:"required,email"`               // User's email address
	Password string   `json:"password" validate:"required,min=8"`            // Plaintext password (will be hashed)
	Role     UserRole `json:"role" validate:"required,oneof=Staff Admin"` // User's role (restricted options)
}

// UserLogin represents the credentials provided during a login attempt.
type UserLogin struct {
	Email    string `json:"email" validate:"required,email"` // User's email
	Password string `json:"password" validate:"required"`    // User's plaintext password
}

// Token represents the JWT authentication token returned upon successful login.
type Token struct {
	AccessToken string    `json:"access_token"` // The JWT token string
	TokenType   string    `json:"token_type"`   // Typically "Bearer"
	ExpiresAt   time.Time `json:"expires_at"`   // Timestamp when the token expires
}

// ==========================================================================
// Ticket Models
// ==========================================================================

// TicketStatus defines the possible lifecycle states of a support ticket.
type TicketStatus string

// Constants for the defined ticket statuses.
const (
	StatusUnassigned TicketStatus = "Unassigned" // Ticket is new and not yet assigned.
	StatusAssigned   TicketStatus = "Assigned"   // Ticket is assigned to a staff member.
	StatusInProgress TicketStatus = "In Progress" // Ticket is actively being worked on.
	StatusClosed     TicketStatus = "Closed"     // Ticket has been resolved and closed.
)

// TicketUrgency defines the priority level of a support ticket.
type TicketUrgency string

// Constants for the defined ticket urgency levels.
const (
	UrgencyLow      TicketUrgency = "Low"      // Non-critical issue.
	UrgencyMedium   TicketUrgency = "Medium"   // Standard priority.
	UrgencyHigh     TicketUrgency = "High"     // Requires prompt attention.
	UrgencyCritical TicketUrgency = "Critical" // Requires immediate attention.
)

// Ticket represents a support ticket submitted by an end-user.
type Ticket struct {
	ID               string         `json:"id"`                            // Unique identifier (UUID)
	TicketNumber     int32          `json:"ticket_number"`                 // User-facing sequential number
	EndUserEmail     string         `json:"end_user_email"`                // Email of the person who submitted the ticket
	IssueType        string         `json:"issue_type,omitempty"`          // Category or type of issue (e.g., "Hardware", "Software")
	Urgency          TicketUrgency  `json:"urgency"`                       // Urgency level (Low, Medium, High, Critical)
	Subject          string         `json:"subject"`                       // Brief summary of the issue
	Body             string         `json:"body"`                          // Detailed description of the issue
	Status           TicketStatus   `json:"status"`                        // Current status (Unassigned, Assigned, etc.)
	AssignedToUserID *string        `json:"assigned_to_user_id,omitempty"` // UUID of the assigned staff member (nullable)
	AssignedToUser   *User          `json:"assigned_to_user,omitempty"`    // Populated details of the assigned staff member (nested)
	CreatedAt        time.Time      `json:"created_at"`                    // Timestamp when the ticket was created
	UpdatedAt        time.Time      `json:"updated_at"`                    // Timestamp when the ticket was last updated
	ClosedAt         *time.Time     `json:"closed_at,omitempty"`           // Timestamp when the ticket was closed (nullable)
	ResolutionNotes  *string        `json:"resolution_notes,omitempty"`    // Notes added upon closing the ticket (nullable)
	Tags             []Tag          `json:"tags,omitempty"`                // List of associated tags (nested)
	Updates          []TicketUpdate `json:"updates,omitempty"`             // History of comments and updates (nested)
	Attachments      []Attachment   `json:"attachments,omitempty"`         // List of file attachments (nested)
}

// TicketCreate represents the data required to create a new support ticket.
// Used for binding request bodies, typically from public or internal forms.
type TicketCreate struct {
	EndUserEmail string        `json:"end_user_email" validate:"required,email"`               // Submitter's email
	IssueType    string        `json:"issue_type" validate:"required"`                         // Issue category
	Urgency      TicketUrgency `json:"urgency" validate:"required,oneof=Low Medium High Critical"` // Urgency level
	Subject      string        `json:"subject" validate:"required,min=5,max=200"`              // Ticket subject
	Body         string        `json:"body" validate:"required"`                               // Ticket description
	Tags         []string      `json:"tags,omitempty"`                                         // Optional list of tag names to associate
}

// TicketUpdate represents a comment or a system-generated update on a ticket.
type TicketUpdate struct {
	ID             string    `json:"id"`                      // Unique identifier (UUID) for the update
	TicketID       string    `json:"ticket_id"`               // ID of the associated ticket
	UserID         *string   `json:"user_id,omitempty"`       // ID of the user who made the update (nullable for system updates)
	User           *User     `json:"user,omitempty"`          // Populated details of the author (nested)
	Comment        string    `json:"comment"`                 // The content of the comment or update description
	IsInternalNote bool      `json:"is_internal_note"`        // Flag indicating if the note is visible only to staff/admins
	CreatedAt      time.Time `json:"created_at"`              // Timestamp when the update was created
}

// TicketUpdateCreate represents the data required to add a new comment or update to a ticket.
type TicketUpdateCreate struct {
	Comment        string `json:"comment" validate:"required"` // The comment content
	IsInternalNote bool   `json:"is_internal_note"`        // Flag if it's an internal note (defaults to false if omitted)
}

// TicketStatusUpdate represents the data required to change a ticket's status and/or assignee.
type TicketStatusUpdate struct {
	Status           TicketStatus `json:"status" validate:"required,oneof=Unassigned Assigned In Progress Closed"` // The new status
	AssignedToUserID *string      `json:"assigned_to_user_id,omitempty"`                                        // Optional: New assignee's UUID (or null/empty to unassign)
	ResolutionNotes  *string      `json:"resolution_notes,omitempty"`                                           // Optional: Required only if setting status to Closed
}

// Attachment represents metadata about a file attached to a ticket.
type Attachment struct {
	ID          string    `json:"id"`           // Unique identifier (UUID) for the attachment
	TicketID    string    `json:"ticket_id"`    // ID of the associated ticket
	Filename    string    `json:"filename"`     // Original filename of the uploaded file
	StoragePath string    `json:"storage_path"` // Path/key where the file is stored (e.g., in S3/MinIO)
	MimeType    string    `json:"mime_type"`    // MIME type of the file (e.g., "image/png")
	Size        int64     `json:"size"`         // File size in bytes (use int64 for potentially large files)
	UploadedAt  time.Time `json:"uploaded_at"`  // Timestamp when the file was uploaded
	URL         string    `json:"url,omitempty"` // Download URL (often generated on retrieval)
}

// ==========================================================================
// Task Models
// ==========================================================================

// TaskStatus defines the possible states of an internal task.
type TaskStatus string

// Constants for the defined task statuses.
const (
	TaskStatusOpen       TaskStatus = "Open"       // Task is created but not started.
	TaskStatusInProgress TaskStatus = "In Progress" // Task is actively being worked on.
	TaskStatusCompleted  TaskStatus = "Completed"  // Task is finished.
)

// Task represents an internal task, potentially linked to a ticket or standalone.
type Task struct {
	ID               string     `json:"id"`                            // Unique identifier (UUID)
	TaskNumber       int32      `json:"task_number"`                   // User-facing sequential number
	Title            string     `json:"title"`                         // Title or brief description of the task
	Description      *string    `json:"description,omitempty"`         // Optional detailed description (nullable)
	Status           TaskStatus `json:"status"`                        // Current status (Open, In Progress, Completed)
	AssignedToUserID *string    `json:"assigned_to_user_id,omitempty"` // UUID of the assigned staff member (nullable)
	AssignedToUser   *User      `json:"assigned_to_user,omitempty"`    // Populated details of the assigned staff member (nested)
	CreatedByUserID  string     `json:"created_by_user_id"`            // UUID of the user who created the task
	CreatedByUser    *User      `json:"created_by_user,omitempty"`     // Populated details of the creator (nested)
	DueDate          *time.Time `json:"due_date,omitempty"`            // Optional due date (nullable)
	IsRecurring      bool       `json:"is_recurring"`                  // Flag indicating if the task recurs
	RecurrenceRule   *string    `json:"recurrence_rule,omitempty"`     // Rule defining recurrence (e.g., cron string, RRULE) (nullable)
	CreatedAt        time.Time  `json:"created_at"`                    // Timestamp when the task was created
	UpdatedAt        time.Time  `json:"updated_at"`                    // Timestamp when the task was last updated
	CompletedAt      *time.Time `json:"completed_at,omitempty"`        // Timestamp when the task was completed (nullable)
	Updates          []TaskUpdate `json:"updates,omitempty"`             // History of comments/updates specific to this task (nested)
}

// TaskCreate represents the data required to create a new task.
type TaskCreate struct {
	Title          string     `json:"title" validate:"required,min=3,max=200"` // Task title
	Description    *string    `json:"description,omitempty"`                   // Optional description
	AssignedToID   *string    `json:"assigned_to_user_id,omitempty"`           // Optional assignee UUID
	DueDate        *time.Time `json:"due_date,omitempty"`                      // Optional due date
	IsRecurring    bool       `json:"is_recurring"`                            // Recurring flag
	RecurrenceRule *string    `json:"recurrence_rule,omitempty"`               // Optional recurrence rule (required if IsRecurring is true?)
}

// TaskUpdate represents a comment or update added to a task.
type TaskUpdate struct {
	ID        string    `json:"id"`                      // Unique identifier (UUID) for the update
	TaskID    string    `json:"task_id"`                 // ID of the associated task
	UserID    *string   `json:"user_id,omitempty"`       // ID of the user who made the update (nullable?)
	User      *User     `json:"user,omitempty"`          // Populated details of the author (nested)
	Comment   string    `json:"comment"`                 // The content of the comment or update description
	CreatedAt time.Time `json:"created_at"`              // Timestamp when the update was created
	// Add IsInternalNote bool `json:"is_internal_note"` if needed for tasks
}

// TaskUpdateCreate represents the data required to add a new comment/update to a task.
type TaskUpdateCreate struct {
	Comment string `json:"comment" validate:"required"` // The comment content
	// Add IsInternalNote bool `json:"is_internal_note"` if needed
}

// TaskStatusUpdate represents the data required to change a task's status.
type TaskStatusUpdate struct {
	Status TaskStatus `json:"status" validate:"required,oneof=Open In Progress Completed"` // The new status
}

// ==========================================================================
// FAQ Models
// ==========================================================================

// FAQEntry represents a single entry in the Frequently Asked Questions list.
type FAQEntry struct {
	ID        string    `json:"id"`        // Unique identifier (UUID)
	Question  string    `json:"question"`  // The question text
	Answer    string    `json:"answer"`    // The answer text
	Category  string    `json:"category"`  // Category for grouping FAQs
	CreatedAt time.Time `json:"created_at"` // Timestamp when created
	UpdatedAt time.Time `json:"updated_at"` // Timestamp when last updated
}

// FAQCreate represents the data required to create a new FAQ entry.
type FAQCreate struct {
	Question string `json:"question" validate:"required,min=10"` // The question
	Answer   string `json:"answer" validate:"required"`          // The answer
	Category string `json:"category" validate:"required"`        // The category
}

// ==========================================================================
// Tag Models
// ==========================================================================

// Tag represents a keyword or label that can be associated with tickets.
type Tag struct {
	ID        string    `json:"id"`        // Unique identifier (UUID)
	Name      string    `json:"name"`      // The tag name (unique)
	CreatedAt time.Time `json:"created_at"` // Timestamp when created
}

// ==========================================================================
// API & Common Models
// ==========================================================================

// APIResponse defines a standard structure for API responses.
// It indicates success/failure and includes optional data, message, or error details.
type APIResponse struct {
	Success bool        `json:"success"`             // True if the request was successful, false otherwise
	Message string      `json:"message,omitempty"`   // Optional message (e.g., "User created successfully")
	Data    interface{} `json:"data,omitempty"`      // Optional data payload (can be any type)
	Error   string      `json:"error,omitempty"`     // Optional error message if Success is false
}

// PaginatedResponse defines a standard structure for responses containing lists of items
// that are broken down into pages.
type PaginatedResponse struct {
	Success    bool        `json:"success"`             // Always true if data is returned (even if empty)
	Message    string      `json:"message,omitempty"`   // Optional message
	Data       interface{} `json:"data"`                // The slice of items for the current page
	Total      int         `json:"total"`               // Total number of items across all pages
	Page       int         `json:"page"`                // The current page number (1-based)
	Limit      int         `json:"limit"`               // The maximum number of items per page
	TotalPages int         `json:"total_pages"`         // The total number of pages
	HasMore    bool        `json:"has_more"`            // True if there are more pages after the current one
}

// TicketFilter represents potential query parameters for filtering the ticket list.
// This struct is mainly for documentation or internal use in building queries,
// not typically used for direct request binding unless the API expects a JSON filter object.
type TicketFilter struct {
	Status       *TicketStatus  `json:"status,omitempty"`       // Filter by status
	Urgency      *TicketUrgency `json:"urgency,omitempty"`      // Filter by urgency
	AssignedTo   *string        `json:"assigned_to,omitempty"`  // Filter by assignee ID, "me", or "unassigned"
	EndUserEmail *string        `json:"end_user_email,omitempty"`// Filter by submitter email
	FromDate     *time.Time     `json:"from_date,omitempty"`    // Filter by creation/update date start
	ToDate       *time.Time     `json:"to_date,omitempty"`      // Filter by creation/update date end
	Tags         []string       `json:"tags,omitempty"`         // Filter by tag names
	Search       string         `json:"search,omitempty"`       // Search term
	Page         int            `json:"page,omitempty"`         // Page number for pagination
	Limit        int            `json:"limit,omitempty"`        // Items per page
	// Add SortBy, SortOrder fields if needed
}

// TaskFilter represents potential query parameters for filtering the task list.
// Similar to TicketFilter, mainly for documentation or internal query building.
type TaskFilter struct {
	Status      *TaskStatus `json:"status,omitempty"`         // Filter by status
	AssignedTo  *string     `json:"assigned_to,omitempty"`    // Filter by assignee ID, "me", or "unassigned"
	CreatedBy   *string     `json:"created_by,omitempty"`     // Filter by creator ID or "me"
	DueFromDate *time.Time  `json:"due_from_date,omitempty"`  // Filter by due date start
	DueToDate   *time.Time  `json:"due_to_date,omitempty"`    // Filter by due date end
	IsRecurring *bool       `json:"is_recurring,omitempty"`   // Filter by recurring status
	Search      string      `json:"search,omitempty"`         // Search term
	Page        int         `json:"page,omitempty"`           // Page number
	Limit       int         `json:"limit,omitempty"`          // Items per page
	// Add SortBy, SortOrder fields if needed
}

