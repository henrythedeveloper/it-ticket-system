package scheduler

import (
"log"
"time"

"gorm.io/gorm"
"helpdesk/internal/models"
)

type CleanupService struct {
db *gorm.DB
}

func NewCleanupService(db *gorm.DB) *CleanupService {
return &CleanupService{db: db}
}

func (s *CleanupService) Start() {
// Run cleanup daily at midnight
go func() {
for {
now := time.Now()
nextRun := time.Date(now.Year(), now.Month(), now.Day()+1, 0, 0, 0, 0, now.Location())
time.Sleep(time.Until(nextRun))
s.CleanupOldTasks()
}
}()
}

func (s *CleanupService) CleanupOldTasks() {
log.Println("Starting cleanup of old tasks...")

// Find tasks older than 90 days that are done
ninetyDaysAgo := time.Now().AddDate(0, 0, -90)

// Start a transaction
tx := s.db.Begin()
if tx.Error != nil {
log.Printf("Error starting cleanup transaction: %v", tx.Error)
return
}

// Get tasks to archive
var tasksToArchive []models.Task
err := tx.Where("status = ? AND updated_at < ?", models.TaskStatusDone, ninetyDaysAgo).Find(&tasksToArchive).Error
if err != nil {
tx.Rollback()
log.Printf("Error finding tasks to archive: %v", err)
return
}

for _, task := range tasksToArchive {
// Create archive record
archiveNote := "Task archived after 90 days in done status"

// Add final history entry
history := models.TaskHistory{
TaskID:  task.ID,
Action:  "archived",
UserID:  task.CreatedBy,
Notes:   archiveNote,
}

if err := tx.Create(&history).Error; err != nil {
tx.Rollback()
log.Printf("Error creating archive history for task %d: %v", task.ID, err)
return
}
}

// Soft delete the tasks
if err := tx.Where("status = ? AND updated_at < ?", models.TaskStatusDone, ninetyDaysAgo).Delete(&models.Task{}).Error; err != nil {
tx.Rollback()
log.Printf("Error archiving old tasks: %v", err)
return
}

if err := tx.Commit().Error; err != nil {
log.Printf("Error committing cleanup transaction: %v", err)
return
}

log.Printf("Successfully archived tasks older than %v", ninetyDaysAgo)
}