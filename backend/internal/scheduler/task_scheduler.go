package scheduler

import (
"log"
"time"

"gorm.io/gorm"
"helpdesk/internal/models"
)

type TaskScheduler struct {
db *gorm.DB
}

func NewTaskScheduler(db *gorm.DB) *TaskScheduler {
return &TaskScheduler{db: db}
}

func (s *TaskScheduler) Start() {
// Run immediately when starting
s.createRecurringTasks()

// Schedule to run every minute
ticker := time.NewTicker(1 * time.Minute)
go func() {
for range ticker.C {
s.createRecurringTasks()
}
}()
}

func (s *TaskScheduler) createRecurringTasks() {
var recurringTasks []models.RecurringTask
now := time.Now()

// Find all active recurring tasks that are due
err := s.db.Where("is_active = ? AND next_run <= ?", true, now).Find(&recurringTasks).Error
if err != nil {
log.Printf("Error fetching recurring tasks: %v", err)
return
}

for _, rt := range recurringTasks {
// Start transaction for each task
tx := s.db.Begin()
if tx.Error != nil {
log.Printf("Error starting transaction for task %d: %v", rt.ID, tx.Error)
continue
}

// Create new task instance
task := models.Task{
Title:           rt.Title,
Description:     rt.Description,
Priority:        rt.Priority,
Status:          models.TaskStatusTodo,
CreatedBy:       rt.CreatedBy,
AssignedTo:      rt.AssignedTo,
DueDate:         &rt.NextRun,
RecurringTaskID: &rt.ID,
}

if err := tx.Create(&task).Error; err != nil {
tx.Rollback()
log.Printf("Error creating task from recurring task %d: %v", rt.ID, err)
continue
}

// Create task history
history := models.TaskHistory{
TaskID:  task.ID,
Action:  models.TaskHistoryActionCreated,
UserID:  rt.CreatedBy,
Notes:   "Created from recurring task",
}

if err := tx.Create(&history).Error; err != nil {
tx.Rollback()
log.Printf("Error creating task history for task %d: %v", task.ID, err)
continue
}

// Update next run time
var nextRun time.Time
switch rt.Frequency {
case models.RecurringFrequencyDaily:
nextRun = rt.NextRun.Add(24 * time.Hour)
case models.RecurringFrequencyWeekly:
nextRun = rt.NextRun.Add(7 * 24 * time.Hour)
case models.RecurringFrequencyMonthly:
nextRun = rt.NextRun.AddDate(0, 1, 0)
}

if err := tx.Model(&rt).Update("next_run", nextRun).Error; err != nil {
tx.Rollback()
log.Printf("Error updating next run time for recurring task %d: %v", rt.ID, err)
continue
}

if err := tx.Commit().Error; err != nil {
log.Printf("Error committing transaction for recurring task %d: %v", rt.ID, err)
}
}
}