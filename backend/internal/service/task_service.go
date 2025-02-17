package service

import (
"fmt"
"time"

"gorm.io/gorm"
"helpdesk/internal/models"
"helpdesk/internal/repository"
)

type TaskService struct {
db       *gorm.DB
taskRepo *repository.TaskRepository
}

func NewTaskService(db *gorm.DB) *TaskService {
return &TaskService{
db:       db,
taskRepo: repository.NewTaskRepository(db),
}
}

type CreateTaskInput struct {
Title          string
Description    string
Priority       string
AssignedTo     *uint
DueDate        *time.Time
RecurringID    *uint      // ID of recurring task if this is an instance
}

type CreateRecurringTaskInput struct {
Title       string
Description string
Priority    string
AssignedTo  *uint
Frequency   string // daily, weekly, monthly
CreatedBy   uint
}

func (s *TaskService) CreateRecurringTask(input CreateRecurringTaskInput) (*models.RecurringTask, error) {
// Start transaction
tx := s.db.Begin()
if tx.Error != nil {
return nil, fmt.Errorf("failed to start transaction: %w", tx.Error)
}

// Calculate initial next run based on frequency
nextRun := time.Now()
switch input.Frequency {
case models.RecurringFrequencyDaily:
nextRun = nextRun.Add(24 * time.Hour)
case models.RecurringFrequencyWeekly:
nextRun = nextRun.Add(7 * 24 * time.Hour)
case models.RecurringFrequencyMonthly:
nextRun = nextRun.AddDate(0, 1, 0)
}

// Create recurring task
recurringTask := &models.RecurringTask{
Title:       input.Title,
Description: input.Description,
Priority:    input.Priority,
Frequency:   input.Frequency,
NextRun:     nextRun,
AssignedTo:  input.AssignedTo,
CreatedBy:   input.CreatedBy,
IsActive:    true,
}

if err := tx.Create(recurringTask).Error; err != nil {
tx.Rollback()
return nil, fmt.Errorf("failed to create recurring task: %w", err)
}

if err := tx.Commit().Error; err != nil {
return nil, fmt.Errorf("failed to commit transaction: %w", err)
}

return recurringTask, nil
}

func (s *TaskService) CreateTask(input CreateTaskInput, createdBy uint) (*models.Task, error) {
// Start transaction
tx := s.db.Begin()
if tx.Error != nil {
return nil, fmt.Errorf("failed to start transaction: %w", tx.Error)
}

// Create task
task := &models.Task{
Title:           input.Title,
Description:     input.Description,
Priority:        input.Priority,
Status:          models.TaskStatusTodo,
CreatedBy:       createdBy,
AssignedTo:      input.AssignedTo,
DueDate:         input.DueDate,
RecurringTaskID: input.RecurringID,
}

if err := s.taskRepo.Create(tx, task); err != nil {
tx.Rollback()
return nil, fmt.Errorf("failed to create task: %w", err)
}

// Create history entry
history := &models.TaskHistory{
TaskID:  task.ID,
Action:  models.TaskHistoryActionCreated,
UserID:  createdBy,
Notes:   "Task created",
}

if err := s.taskRepo.CreateHistory(tx, history); err != nil {
tx.Rollback()
return nil, fmt.Errorf("failed to create history: %w", err)
}

if err := tx.Commit().Error; err != nil {
return nil, fmt.Errorf("failed to commit transaction: %w", err)
}

// Reload task with associations
taskWithAssocs, err := s.taskRepo.GetByID(task.ID)
if err != nil {
return nil, fmt.Errorf("failed to reload task: %w", err)
}

return taskWithAssocs, nil
}

type UpdateTaskInput struct {
Title             *string
Description       *string
Priority          *string
Status            *string
AssignedTo        *uint
ReassignmentNotes *string
UpdatedBy         uint
}

func (s *TaskService) UpdateTask(taskID uint, input UpdateTaskInput) (*models.Task, error) {
// Get existing task
task, err := s.taskRepo.GetByID(taskID)
if err != nil {
return nil, fmt.Errorf("failed to fetch task: %w", err)
}

// Start transaction
tx := s.db.Begin()
if tx.Error != nil {
return nil, fmt.Errorf("failed to start transaction: %w", tx.Error)
}

// Track changes and create history entries
if input.Title != nil && *input.Title != task.Title {
oldTitle := task.Title
task.Title = *input.Title
history := &models.TaskHistory{
TaskID:  task.ID,
Action:  models.TaskHistoryActionTitleUpdated,
UserID:  input.UpdatedBy,
Notes:   fmt.Sprintf("Title changed from '%s' to '%s'", oldTitle, *input.Title),
}
if err := s.taskRepo.CreateHistory(tx, history); err != nil {
tx.Rollback()
return nil, fmt.Errorf("failed to create history for title update: %w", err)
}
}

if input.Description != nil && *input.Description != task.Description {
task.Description = *input.Description
history := &models.TaskHistory{
TaskID:  task.ID,
Action:  models.TaskHistoryActionDescUpdated,
UserID:  input.UpdatedBy,
Notes:   "Description updated",
}
if err := s.taskRepo.CreateHistory(tx, history); err != nil {
tx.Rollback()
return nil, fmt.Errorf("failed to create history for description update: %w", err)
}
}

if input.Priority != nil && *input.Priority != task.Priority {
oldPriority := task.Priority
task.Priority = *input.Priority
history := &models.TaskHistory{
TaskID:  task.ID,
Action:  models.TaskHistoryActionPriorityChanged,
UserID:  input.UpdatedBy,
Notes:   fmt.Sprintf("Priority changed from '%s' to '%s'", oldPriority, *input.Priority),
}
if err := s.taskRepo.CreateHistory(tx, history); err != nil {
tx.Rollback()
return nil, fmt.Errorf("failed to create history for priority update: %w", err)
}
}

if input.Status != nil && *input.Status != task.Status {
oldStatus := task.Status
task.Status = *input.Status
history := &models.TaskHistory{
TaskID:  task.ID,
Action:  models.TaskHistoryActionStatusChanged,
UserID:  input.UpdatedBy,
Notes:   fmt.Sprintf("Status changed from '%s' to '%s'", oldStatus, *input.Status),
}
if err := s.taskRepo.CreateHistory(tx, history); err != nil {
tx.Rollback()
return nil, fmt.Errorf("failed to create history for status update: %w", err)
}
}

if input.AssignedTo != nil && (task.AssignedTo == nil || *input.AssignedTo != *task.AssignedTo) {
notes := "Task reassigned"
if input.ReassignmentNotes != nil {
notes = *input.ReassignmentNotes
}

history := &models.TaskHistory{
TaskID:  task.ID,
Action:  models.TaskHistoryActionReassigned,
UserID:  input.UpdatedBy,
Notes:   notes,
}
if err := s.taskRepo.CreateHistory(tx, history); err != nil {
tx.Rollback()
return nil, fmt.Errorf("failed to create history for reassignment: %w", err)
}

task.AssignedTo = input.AssignedTo
}

// Save updated task
if err := s.taskRepo.Update(tx, task); err != nil {
tx.Rollback()
return nil, fmt.Errorf("failed to update task: %w", err)
}

if err := tx.Commit().Error; err != nil {
return nil, fmt.Errorf("failed to commit transaction: %w", err)
}

// Reload task with associations
taskWithAssocs, err := s.taskRepo.GetByID(task.ID)
if err != nil {
return nil, fmt.Errorf("failed to reload task: %w", err)
}

return taskWithAssocs, nil
}

func (s *TaskService) DeleteTask(taskID uint) error {
task, err := s.taskRepo.GetByID(taskID)
if err != nil {
return fmt.Errorf("failed to fetch task: %w", err)
}

tx := s.db.Begin()
if tx.Error != nil {
return fmt.Errorf("failed to start transaction: %w", tx.Error)
}

if err := s.taskRepo.Delete(tx, task); err != nil {
tx.Rollback()
return fmt.Errorf("failed to delete task: %w", err)
}

if err := tx.Commit().Error; err != nil {
return fmt.Errorf("failed to commit transaction: %w", err)
}

return nil
}

func (s *TaskService) GetTask(taskID uint) (*models.Task, error) {
return s.taskRepo.GetByID(taskID)
}

func (s *TaskService) ListTasks(filter repository.TaskFilter) ([]models.Task, error) {
return s.taskRepo.List(filter)
}

func (s *TaskService) GetTaskHistory(taskID uint) ([]models.TaskHistory, error) {
return s.taskRepo.GetHistory(taskID)
}

func (s *TaskService) GetTaskStats(userID uint) (*repository.TaskStats, error) {
return s.taskRepo.GetStats(userID)
}