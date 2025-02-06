package models

import (
	"time"

	"gorm.io/gorm"
)

// User represents an IT staff member
type User struct {
	ID        uint           `json:"id" gorm:"primaryKey"`
	Name      string         `json:"name" gorm:"not null"`
	Email     string         `json:"email" gorm:"uniqueIndex;not null"`
	Password  string         `json:"-" gorm:"not null"` // "-" excludes from JSON
	Role      string         `json:"role" gorm:"type:varchar(20);not null;default:'staff'"`
	CreatedAt time.Time      `json:"createdAt"`
	UpdatedAt time.Time      `json:"updatedAt"`
	DeletedAt gorm.DeletedAt `json:"-" gorm:"index"`
}

// Ticket represents a help desk ticket submitted by end users
type Ticket struct {
	ID             uint           `json:"id" gorm:"primaryKey"`
	TicketNumber   string         `json:"ticketNumber" gorm:"unique"`
	Category       string         `json:"category"`
	Description    string         `json:"description"`
	Status         string         `json:"status"`
	SubmitterEmail string         `json:"submitterEmail"`
	AssignedTo     *uint          `json:"assignedTo,omitempty" gorm:"index"`
	CreatedAt      time.Time      `json:"createdAt"`
	UpdatedAt      time.Time      `json:"updatedAt"`
	DeletedAt      gorm.DeletedAt `json:"-" gorm:"index"`
}

// Task represents an internal task for IT staff
type Task struct {
	ID           uint           `json:"id" gorm:"primaryKey"`
	Title        string         `json:"title" gorm:"not null"`
	Description  string         `json:"description" gorm:"type:text;not null"`
	Priority     string         `json:"priority" gorm:"type:varchar(50);not null"`
	Status       string         `json:"status" gorm:"type:varchar(50);not null;default:'todo'"`
	CreatedBy    uint           `json:"createdBy" gorm:"not null"`
	Creator      User           `json:"creator" gorm:"foreignKey:CreatedBy"`
	AssignedTo   *uint          `json:"assignedTo,omitempty" gorm:"index"`
	AssignedUser *User          `json:"assignedUser,omitempty" gorm:"foreignKey:AssignedTo"`
	CreatedAt    time.Time      `json:"createdAt"`
	UpdatedAt    time.Time      `json:"updatedAt"`
	DeletedAt    gorm.DeletedAt `json:"-" gorm:"index"`
}

// TableName overrides the table name for User
func (User) TableName() string {
	return "users"
}

// TableName overrides the table name for Ticket
func (Ticket) TableName() string {
	return "tickets"
}

// TableName overrides the table name for Task
func (Task) TableName() string {
	return "tasks"
}

// BeforeCreate hook for User
func (u *User) BeforeCreate(tx *gorm.DB) error {
	if u.Role == "" {
		u.Role = "staff"
	}
	return nil
}

// BeforeCreate hook for Ticket
func (t *Ticket) BeforeCreate(tx *gorm.DB) error {
	if t.Status == "" {
		t.Status = "open"
	}
	return nil
}

// BeforeCreate hook for Task
func (t *Task) BeforeCreate(tx *gorm.DB) error {
	if t.Status == "" {
		t.Status = "todo"
	}
	return nil
}

// Constants for status and roles
const (
	// Ticket statuses
	TicketStatusOpen       = "open"
	TicketStatusInProgress = "in_progress"
	TicketStatusResolved   = "resolved"

	// Task statuses
	TaskStatusTodo       = "todo"
	TaskStatusInProgress = "in_progress"
	TaskStatusDone       = "done"

	// Task priorities
	TaskPriorityLow    = "low"
	TaskPriorityMedium = "medium"
	TaskPriorityHigh   = "high"

	// User roles
	UserRoleAdmin = "admin"
	UserRoleStaff = "staff"
)
