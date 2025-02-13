package scheduler

import (
	"database/sql"
	"log"
	"time"

	"helpdesk/internal/models"
)

type TaskScheduler struct {
	db *sql.DB
}

func NewTaskScheduler(db *sql.DB) *TaskScheduler {
	return &TaskScheduler{db: db}
}

func (s *TaskScheduler) Start() {
	// Run every hour
	ticker := time.NewTicker(1 * time.Hour)
	go func() {
		for range ticker.C {
			s.createRecurringTasks()
		}
	}()
}

func (s *TaskScheduler) createRecurringTasks() {
	// Get all tasks with recurrence that need processing
	rows, err := s.db.Query(`
		SELECT 
			id, title, description, status, priority, created_by, assigned_to,
			due_date, recurrence_type, recurrence_interval, recurrence_end_date,
			next_occurrence
		FROM tasks 
		WHERE 
			recurrence_type != 'none'
			AND next_occurrence <= NOW()
			AND (recurrence_end_date IS NULL OR recurrence_end_date > NOW())
			AND deleted_at IS NULL
	`)
	if err != nil {
		log.Printf("Error querying recurring tasks: %v", err)
		return
	}
	defer rows.Close()

	for rows.Next() {
		var task models.Task
		var nextOcc time.Time
		err := rows.Scan(
			&task.ID,
			&task.Title,
			&task.Description,
			&task.Status,
			&task.Priority,
			&task.CreatedBy,
			&task.AssignedTo,
			&task.DueDate,
			&task.RecurrenceType,
			&task.RecurrenceInterval,
			&task.RecurrenceEndDate,
			&nextOcc,
		)
		if err != nil {
			log.Printf("Error scanning task row: %v", err)
			continue
		}

		// Calculate next occurrence dates
		nextDueDate := s.calculateNextDueDate(&task)
		nextOccurrence := s.calculateNextOccurrence(&task)

		if nextDueDate.IsZero() || nextOccurrence.IsZero() {
			continue
		}

		// Create new task instance
		tx, err := s.db.Begin()
		if err != nil {
			log.Printf("Error starting transaction: %v", err)
			continue
		}

		// Insert new task
		_, err = tx.Exec(`
			INSERT INTO tasks (
				title, description, status, priority, created_by, assigned_to,
				due_date, recurrence_type, recurrence_interval, recurrence_end_date,
				parent_task_id, next_occurrence, created_at, updated_at
			) VALUES (
				$1, $2, 'todo', $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW()
			)
		`,
			task.Title,
			task.Description,
			task.Priority,
			task.CreatedBy,
			task.AssignedTo,
			nextDueDate,
			task.RecurrenceType,
			task.RecurrenceInterval,
			task.RecurrenceEndDate,
			task.ID,
			nextOccurrence,
		)
		if err != nil {
			tx.Rollback()
			log.Printf("Error creating recurring task: %v", err)
			continue
		}

		// Update parent task's next occurrence
		_, err = tx.Exec(`
			UPDATE tasks 
			SET next_occurrence = $1 
			WHERE id = $2
		`,
			nextOccurrence,
			task.ID,
		)
		if err != nil {
			tx.Rollback()
			log.Printf("Error updating parent task: %v", err)
			continue
		}

		if err := tx.Commit(); err != nil {
			log.Printf("Error committing transaction: %v", err)
		}
	}
}

func (s *TaskScheduler) calculateNextDueDate(task *models.Task) time.Time {
	if !task.DueDate.Valid {
		return time.Time{}
	}

	baseDate := task.DueDate.Time
	interval := task.RecurrenceInterval

	switch task.RecurrenceType {
	case "daily":
		return baseDate.AddDate(0, 0, interval)
	case "weekly":
		return baseDate.AddDate(0, 0, 7*interval)
	case "monthly":
		return baseDate.AddDate(0, interval, 0)
	case "yearly":
		return baseDate.AddDate(interval, 0, 0)
	default:
		return time.Time{}
	}
}

func (s *TaskScheduler) calculateNextOccurrence(task *models.Task) time.Time {
	// Schedule next occurrence check for 1 hour before the due date
	nextDueDate := s.calculateNextDueDate(task)
	if nextDueDate.IsZero() {
		return time.Time{}
	}
	return nextDueDate.Add(-1 * time.Hour)
}