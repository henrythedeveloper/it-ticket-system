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
Solution       *string        `json:"solution,omitempty"`
ResolvedBy     *uint          `json:"resolvedBy,omitempty" gorm:"index"`
ResolvedAt     *time.Time     `json:"resolvedAt,omitempty"`
CreatedAt      time.Time      `json:"createdAt"`
UpdatedAt      time.Time      `json:"updatedAt"`
DeletedAt      gorm.DeletedAt `json:"-" gorm:"index"`
History        []TicketHistory `json:"history,omitempty" gorm:"foreignKey:TicketID"`
}

// TicketSolution represents a reusable solution for tickets
type TicketSolution struct {
ID          uint           `json:"id" gorm:"primaryKey"`
Title       string         `json:"title" gorm:"not null"`
Description string         `json:"description" gorm:"type:text;not null"`
Category    string         `json:"category" gorm:"not null"`
CreatedBy   uint           `json:"createdBy" gorm:"not null"`
Creator     User           `json:"creator" gorm:"foreignKey:CreatedBy"`
CreatedAt   time.Time      `json:"createdAt"`
UpdatedAt   time.Time      `json:"updatedAt"`
DeletedAt   gorm.DeletedAt `json:"-" gorm:"index"`
}

// TicketHistory tracks all changes to a ticket
type TicketHistory struct {
ID        uint      `json:"id" gorm:"primaryKey"`
TicketID  uint      `json:"ticketId" gorm:"not null"`
Action    string    `json:"action" gorm:"not null"` // e.g., 'created', 'updated', 'resolved'
UserID    *uint     `json:"userId,omitempty" gorm:"index"`
User      *User     `json:"user,omitempty" gorm:"foreignKey:UserID"`
Notes     string    `json:"notes"`
CreatedAt time.Time `json:"createdAt"`
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
History      []TaskHistory  `json:"history,omitempty" gorm:"foreignKey:TaskID"`
CreatedAt    time.Time      `json:"createdAt"`
UpdatedAt    time.Time      `json:"updatedAt"`
DeletedAt    gorm.DeletedAt `json:"-" gorm:"index"`
}

// TaskHistory tracks changes to tasks
type TaskHistory struct {
ID        uint      `json:"id" gorm:"primaryKey"`
TaskID    uint      `json:"taskId" gorm:"not null"`
Action    string    `json:"action" gorm:"not null"` // e.g., 'created', 'updated', 'reassigned'
UserID    uint      `json:"userId" gorm:"not null"`
User      User      `json:"user" gorm:"foreignKey:UserID"`
Notes     string    `json:"notes"`
CreatedAt time.Time `json:"createdAt"`
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

// TableName overrides the table name for TaskHistory
func (TaskHistory) TableName() string {
return "task_history"
}

// TableName overrides the table name for TicketSolution
func (TicketSolution) TableName() string {
return "ticket_solutions"
}

// TableName overrides the table name for TicketHistory
func (TicketHistory) TableName() string {
return "ticket_history"
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

// Constants for status, roles, and history actions
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

// Task history actions
TaskHistoryActionCreated       = "created"
TaskHistoryActionTitleUpdated  = "title_updated"
TaskHistoryActionDescUpdated   = "description_updated"
TaskHistoryActionStatusChanged = "status_changed"
TaskHistoryActionPriorityChanged = "priority_changed"
TaskHistoryActionAssigned      = "assigned"
TaskHistoryActionReassigned    = "reassigned"
TaskHistoryActionUnassigned    = "unassigned"

// Ticket history actions
TicketHistoryActionCreated     = "created"
TicketHistoryActionUpdated     = "updated"
TicketHistoryActionAssigned    = "assigned"
TicketHistoryActionInProgress  = "in_progress"
TicketHistoryActionResolved    = "resolved"
)
