package models

import (
"database/sql"
"time"
)

type User struct {
ID        int           `json:"id"`
Name      string        `json:"name"`
Email     string        `json:"email"`
Password  string        `json:"-"`
Role      string        `json:"role"`
CreatedAt time.Time    `json:"created_at"`
UpdatedAt time.Time    `json:"updated_at"`
DeletedAt sql.NullTime `json:"deleted_at,omitempty"`
}

type Ticket struct {
ID             int           `json:"id"`
TicketNumber   string        `json:"ticketNumber"`
Category       string        `json:"category"`
Description    string        `json:"description"`
Status         string        `json:"status"`
Urgency        string        `json:"urgency"`
CreatedBy      int          `json:"createdBy"`
AssignedTo     sql.NullInt64 `json:"assignedTo"`
SubmitterEmail string        `json:"submitterEmail"`
DueDate        sql.NullTime  `json:"dueDate"`
CreatedAt      time.Time     `json:"createdAt"`
UpdatedAt      time.Time     `json:"updatedAt"`
DeletedAt      sql.NullTime  `json:"deletedAt,omitempty"`
AssignedUser   *User         `json:"assignedUser,omitempty"`
}

type Task struct {
ID               int           `json:"id"`
Title            string        `json:"title"`
Description      string        `json:"description"`
Status           string        `json:"status"`
Priority         string        `json:"priority"`
CreatedBy        int          `json:"createdBy"`
AssignedTo       sql.NullInt64 `json:"assignedTo"`
DueDate          sql.NullTime  `json:"dueDate"`
RecurrenceType   string        `json:"recurrenceType"`
RecurrenceInterval int         `json:"recurrenceInterval"`
RecurrenceEndDate sql.NullTime `json:"recurrenceEndDate"`
ParentTaskID     sql.NullInt64 `json:"parentTaskId"`
NextOccurrence   sql.NullTime  `json:"nextOccurrence"`
CreatedAt        time.Time     `json:"createdAt"`
UpdatedAt        time.Time     `json:"updatedAt"`
DeletedAt        sql.NullTime  `json:"deletedAt,omitempty"`
AssignedUser     *User         `json:"assignedUser,omitempty"`
}

type TicketHistory struct {
ID          int       `json:"id"`
TicketID    int       `json:"ticketId"`
UpdatedBy   int       `json:"updatedBy"`
Status      string    `json:"status"`
Comment     string    `json:"comment"`
CreatedAt   time.Time `json:"createdAt"`
UpdatedByUser *User    `json:"updatedByUser,omitempty"`
}

type Solution struct {
ID          int       `json:"id"`
Title       string    `json:"title"`
Description string    `json:"description"`
Category    string    `json:"category"`
CreatedBy   int      `json:"createdBy"`
CreatedAt   time.Time `json:"createdAt"`
UpdatedAt   time.Time `json:"updatedAt"`
DeletedAt   sql.NullTime `json:"deletedAt,omitempty"`
}
