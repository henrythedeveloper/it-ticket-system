package models

import (
	"time"
)

// User represents a user of the system
type User struct {
	ID           string    `json:"id"`
	Name         string    `json:"name"`
	Email        string    `json:"email"`
	PasswordHash string    `json:"-"` // Never expose password hash in JSON responses
	Role         UserRole  `json:"role"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// UserRole represents the role of a user
type UserRole string

const (
	// RoleStaff represents a regular IT staff member
	RoleStaff UserRole = "Staff"
	// RoleAdmin represents an admin user with more privileges
	RoleAdmin UserRole = "Admin"
)

// UserCreate represents data needed to create a new user
type UserCreate struct {
	Name     string   `json:"name" validate:"required"`
	Email    string   `json:"email" validate:"required,email"`
	Password string   `json:"password" validate:"required,min=8"`
	Role     UserRole `json:"role" validate:"required,oneof=Staff Admin"`
}

// UserLogin represents login credentials
type UserLogin struct {
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required"`
}

// Ticket represents a support ticket
type Ticket struct {
	ID               string         `json:"id"`
	TicketNumber     int32          `json:"ticket_number"` // User-facing number
	EndUserEmail     string         `json:"end_user_email"`
	IssueType        string         `json:"issue_type"`
	Urgency          TicketUrgency  `json:"urgency"`
	Subject          string         `json:"subject"`
	Body             string         `json:"body"`
	Status           TicketStatus   `json:"status"`
	AssignedToUserID *string        `json:"assigned_to_user_id,omitempty"`
	AssignedToUser   *User          `json:"assigned_to_user,omitempty"`
	CreatedAt        time.Time      `json:"created_at"`
	UpdatedAt        time.Time      `json:"updated_at"`
	ClosedAt         *time.Time     `json:"closed_at,omitempty"`
	ResolutionNotes  *string        `json:"resolution_notes,omitempty"`
	Tags             []Tag          `json:"tags,omitempty"`
	Updates          []TicketUpdate `json:"updates,omitempty"` // Existing updates for tickets
	Attachments      []Attachment   `json:"attachments,omitempty"`
}

// TicketStatus represents the status of a ticket
type TicketStatus string

const (
	StatusUnassigned TicketStatus = "Unassigned"
	StatusAssigned   TicketStatus = "Assigned"
	StatusInProgress TicketStatus = "In Progress"
	StatusClosed     TicketStatus = "Closed"
)

// TicketUrgency represents the urgency level of a ticket
type TicketUrgency string

const (
	UrgencyLow      TicketUrgency = "Low"
	UrgencyMedium   TicketUrgency = "Medium"
	UrgencyHigh     TicketUrgency = "High"
	UrgencyCritical TicketUrgency = "Critical"
)

// TicketCreate represents data needed to create a new ticket
type TicketCreate struct {
	EndUserEmail string        `json:"end_user_email" validate:"required,email"`
	IssueType    string        `json:"issue_type" validate:"required"`
	Urgency      TicketUrgency `json:"urgency" validate:"required,oneof=Low Medium High Critical"`
	Subject      string        `json:"subject" validate:"required,min=5,max=200"`
	Body         string        `json:"body" validate:"required"`
	Tags         []string      `json:"tags,omitempty"` // Tag names are passed initially
}

// TicketUpdate represents an update or comment on a ticket (REUSED FOR TASKS)
type TicketUpdate struct {
	ID             string    `json:"id"`
	TicketID       string    `json:"ticket_id,omitempty"` // Keep for tickets
	TaskID         string    `json:"task_id,omitempty"`   // Add for tasks
	UserID         *string   `json:"user_id,omitempty"`
	User           *User     `json:"user,omitempty"`
	Comment        string    `json:"comment"`
	IsInternalNote bool      `json:"is_internal_note"` // You might want this for tasks too
	CreatedAt      time.Time `json:"created_at"`
}

// TicketUpdateCreate represents data needed to add a comment or update (REUSED FOR TASKS)
// Note: We might need a separate TaskUpdateCreate if fields differ significantly
type TicketUpdateCreate struct {
	Comment        string `json:"comment" validate:"required"`
	IsInternalNote bool   `json:"is_internal_note"` // Add if implementing internal notes for tasks
}

// TicketStatusUpdate represents data needed to update a ticket's status
type TicketStatusUpdate struct {
	Status           TicketStatus `json:"status" validate:"required,oneof=Unassigned Assigned In Progress Closed"`
	AssignedToUserID *string      `json:"assigned_to_user_id,omitempty"`
	ResolutionNotes  *string      `json:"resolution_notes,omitempty"`
}

// Attachment represents a file attached to a ticket
type Attachment struct {
	ID          string    `json:"id"`
	TicketID    string    `json:"ticket_id"`
	Filename    string    `json:"filename"`
	StoragePath string    `json:"storage_path"`
	MimeType    string    `json:"mime_type"`
	Size        int       `json:"size"`
	UploadedAt  time.Time `json:"uploaded_at"`
	URL         string    `json:"url,omitempty"`
}

// --- Task Related Structs ---

type TaskStatus string

const (
	TaskStatusOpen       TaskStatus = "Open"
	TaskStatusInProgress TaskStatus = "In Progress"
	TaskStatusCompleted  TaskStatus = "Completed"
)

// --- NEW: TaskUpdate Struct ---
type TaskUpdate struct {
	ID        string    `json:"id"`
	TaskID    string    `json:"task_id"`           // Specific to tasks
	UserID    *string   `json:"user_id,omitempty"` // User who made the update
	User      *User     `json:"user,omitempty"`    // Populated user details
	Comment   string    `json:"comment"`           // The comment text
	CreatedAt time.Time `json:"created_at"`        // When the comment was made
	// Add IsInternalNote bool `json:"is_internal_note"` if needed
}

// --- NEW: TaskUpdateCreate Struct ---
// Data needed to create a new task update/comment
type TaskUpdateCreate struct {
	Comment string `json:"comment" validate:"required"`
	// Add IsInternalNote bool `json:"is_internal_note"` if needed
}

type Task struct {
	ID               string     `json:"id"`
	TaskNumber       int32      `json:"task_number"`
	Title            string     `json:"title"`
	Description      *string    `json:"description,omitempty"`
	Status           TaskStatus `json:"status"`
	AssignedToUserID *string    `json:"assigned_to_user_id,omitempty"`
	AssignedToUser   *User      `json:"assigned_to_user,omitempty"`
	CreatedByUserID  string     `json:"created_by_user_id"`
	CreatedByUser    *User      `json:"created_by_user,omitempty"`
	DueDate          *time.Time `json:"due_date,omitempty"`
	IsRecurring      bool       `json:"is_recurring"`
	RecurrenceRule   *string    `json:"recurrence_rule,omitempty"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
	CompletedAt      *time.Time `json:"completed_at,omitempty"`
	// --- UPDATED: Use TaskUpdate type ---
	Updates []TaskUpdate `json:"updates,omitempty"`
}

type TaskCreate struct {
	Title          string     `json:"title" validate:"required"`
	Description    *string    `json:"description,omitempty"`
	AssignedToID   *string    `json:"assigned_to_user_id,omitempty"`
	DueDate        *time.Time `json:"due_date,omitempty"`
	IsRecurring    bool       `json:"is_recurring"`
	RecurrenceRule *string    `json:"recurrence_rule,omitempty"`
}

type TaskStatusUpdate struct {
	Status TaskStatus `json:"status" validate:"required,oneof=Open In Progress Completed"`
}

// FAQEntry represents a frequently asked question entry
type FAQEntry struct {
	ID        string    `json:"id"`
	Question  string    `json:"question"`
	Answer    string    `json:"answer"`
	Category  string    `json:"category"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// FAQCreate represents data needed to create a new FAQ entry
type FAQCreate struct {
	Question string `json:"question" validate:"required,min=10"`
	Answer   string `json:"answer" validate:"required"`
	Category string `json:"category" validate:"required"`
}

// Tag represents a tag that can be attached to tickets
type Tag struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"created_at"`
}

// APIResponse is a standard API response format
type APIResponse struct {
	Success bool        `json:"success"`
	Message string      `json:"message,omitempty"`
	Data    interface{} `json:"data,omitempty"`
	Error   string      `json:"error,omitempty"`
}

// Token represents an authentication token
type Token struct {
	AccessToken string    `json:"access_token"`
	TokenType   string    `json:"token_type"`
	ExpiresAt   time.Time `json:"expires_at"`
}

// SearchQuery represents a search request
type SearchQuery struct {
	Query  string `json:"query" validate:"required"`
	Limit  int    `json:"limit,omitempty"`
	Offset int    `json:"offset,omitempty"`
}

// SearchResult represents a generic search result
type SearchResult struct {
	Total   int           `json:"total"`
	Results []interface{} `json:"results"`
}

// PaginatedResponse represents a paginated response
type PaginatedResponse struct {
	Total   int         `json:"total"`
	Page    int         `json:"page"`
	Limit   int         `json:"limit"`
	Data    interface{} `json:"data"`
	HasMore bool        `json:"has_more"`
}

// TicketFilter represents filters for ticket listing
type TicketFilter struct {
	Status       *TicketStatus  `json:"status,omitempty"`
	Urgency      *TicketUrgency `json:"urgency,omitempty"`
	AssignedTo   *string        `json:"assigned_to,omitempty"` // Can be user ID (string UUID) or "me" / "unassigned"
	EndUserEmail *string        `json:"end_user_email,omitempty"`
	FromDate     *time.Time     `json:"from_date,omitempty"`
	ToDate       *time.Time     `json:"to_date,omitempty"`
	Tags         []string       `json:"tags,omitempty"` // Tag names
	Search       string         `json:"search,omitempty"`
	Page         int            `json:"page,omitempty"`
	Limit        int            `json:"limit,omitempty"`
}

// TaskFilter represents filters for task listing
type TaskFilter struct {
	Status      *TaskStatus `json:"status,omitempty"`
	AssignedTo  *string     `json:"assigned_to,omitempty"` // Can be user ID (string UUID) or "me" / "unassigned"
	CreatedBy   *string     `json:"created_by,omitempty"`  // Can be user ID (string UUID) or "me"
	DueFromDate *time.Time  `json:"due_from_date,omitempty"`
	DueToDate   *time.Time  `json:"due_to_date,omitempty"`
	IsRecurring *bool       `json:"is_recurring,omitempty"`
	Search      string      `json:"search,omitempty"`
	Page        int         `json:"page,omitempty"`
	Limit       int         `json:"limit,omitempty"`
}
