package scheduler

import (
"database/sql"
"log"
"time"
)

// CleanupService handles cleaning up old task instances and updating recurrence states
type CleanupService struct {
db *sql.DB
}

func NewCleanupService(db *sql.DB) *CleanupService {
return &CleanupService{db: db}
}

func (s *CleanupService) Start() {
// Run cleanup every day at midnight
go func() {
for {
now := time.Now()
midnight := time.Date(now.Year(), now.Month(), now.Day()+1, 0, 0, 0, 0, now.Location())
duration := midnight.Sub(now)
time.Sleep(duration)
s.CleanupOldTasks()
}
}()
}

// CleanupOldTasks performs the cleanup of old tasks and updates recurrence states
func (s *CleanupService) CleanupOldTasks() {
log.Println("Starting task cleanup...")

// Start transaction
tx, err := s.db.Begin()
if err != nil {
log.Printf("Error starting cleanup transaction: %v", err)
return
}

// Archive completed recurring tasks older than 30 days
_, err = tx.Exec(`
INSERT INTO archived_tasks
SELECT *
FROM tasks
WHERE status = 'done'
AND parent_task_id IS NOT NULL
AND updated_at < NOW() - INTERVAL '30 days'
`)
if err != nil {
tx.Rollback()
log.Printf("Error archiving old tasks: %v", err)
return
}

// Delete archived tasks from main table
_, err = tx.Exec(`
DELETE FROM tasks
WHERE status = 'done'
AND parent_task_id IS NOT NULL
AND updated_at < NOW() - INTERVAL '30 days'
`)
if err != nil {
tx.Rollback()
log.Printf("Error deleting archived tasks: %v", err)
return
}

// Update recurrence states for tasks that have passed their end date
_, err = tx.Exec(`
UPDATE tasks
SET recurrence_type = 'none',
    next_occurrence = NULL
WHERE recurrence_end_date IS NOT NULL
AND recurrence_end_date < NOW()
AND recurrence_type != 'none'
`)
if err != nil {
tx.Rollback()
log.Printf("Error updating recurrence states: %v", err)
return
}

if err := tx.Commit(); err != nil {
log.Printf("Error committing cleanup transaction: %v", err)
return
}

log.Println("Task cleanup completed successfully")
}