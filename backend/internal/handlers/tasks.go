package handlers

import (
"net/http"
"strconv"

"github.com/gin-gonic/gin"
"gorm.io/gorm"
"helpdesk/internal/middleware"
"helpdesk/internal/models"
)

type TaskHandler struct {
db *gorm.DB
}

func NewTaskHandler(db *gorm.DB) *TaskHandler {
return &TaskHandler{db: db}
}

type CreateTaskRequest struct {
Title       string `json:"title" binding:"required"`
Description string `json:"description" binding:"required"`
Priority    string `json:"priority" binding:"required,oneof=low medium high"`
AssignedTo  *uint  `json:"assignedTo"`
}

// CreateTask handles creation of internal tasks
func (h *TaskHandler) CreateTask(c *gin.Context) {
var req CreateTaskRequest
if err := c.ShouldBindJSON(&req); err != nil {
c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
return
}

// Get current user ID from context
createdBy := middleware.GetUserID(c)

// Verify assignee exists if provided
if req.AssignedTo != nil {
var user models.User
if err := h.db.First(&user, req.AssignedTo).Error; err != nil {
c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user assignment"})
return
}
}

task := &models.Task{
Title:       req.Title,
Description: req.Description,
Priority:    req.Priority,
Status:      models.TaskStatusTodo,
CreatedBy:   createdBy,
AssignedTo:  req.AssignedTo,
}

if err := h.db.Create(task).Error; err != nil {
c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create task"})
return
}

// Eager load creator and assignee information
h.db.Preload("Creator").Preload("AssignedUser").First(&task, task.ID)

c.JSON(http.StatusCreated, task)
}

// ListTasks returns all tasks with optional filtering
func (h *TaskHandler) ListTasks(c *gin.Context) {
var tasks []models.Task
query := h.db.Preload("Creator").Preload("AssignedUser").Order("created_at DESC")

// Apply filters
if status := c.Query("status"); status != "" {
query = query.Where("status = ?", status)
}

if priority := c.Query("priority"); priority != "" {
query = query.Where("priority = ?", priority)
}

// Filter by assigned user
if assignedTo := c.Query("assignedTo"); assignedTo != "" {
if assignedTo == "me" {
query = query.Where("assigned_to = ?", middleware.GetUserID(c))
} else {
userID, err := strconv.ParseUint(assignedTo, 10, 32)
if err == nil {
query = query.Where("assigned_to = ?", userID)
}
}
}

// Filter by creator
if createdBy := c.Query("createdBy"); createdBy != "" {
if createdBy == "me" {
query = query.Where("created_by = ?", middleware.GetUserID(c))
} else {
userID, err := strconv.ParseUint(createdBy, 10, 32)
if err == nil {
query = query.Where("created_by = ?", userID)
}
}
}

if err := query.Find(&tasks).Error; err != nil {
c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch tasks"})
return
}

c.JSON(http.StatusOK, tasks)
}

// GetTask retrieves a specific task
func (h *TaskHandler) GetTask(c *gin.Context) {
id, err := strconv.ParseUint(c.Param("id"), 10, 32)
if err != nil {
c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid task ID"})
return
}

var task models.Task
if err := h.db.Preload("Creator").Preload("AssignedUser").First(&task, id).Error; err != nil {
if err == gorm.ErrRecordNotFound {
c.JSON(http.StatusNotFound, gin.H{"error": "Task not found"})
return
}
c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch task"})
return
}

c.JSON(http.StatusOK, task)
}

type UpdateTaskRequest struct {
Title       *string `json:"title,omitempty"`
Description *string `json:"description,omitempty"`
Priority    *string `json:"priority,omitempty" binding:"omitempty,oneof=low medium high"`
Status      *string `json:"status,omitempty" binding:"omitempty,oneof=todo in_progress done"`
AssignedTo  *uint   `json:"assignedTo,omitempty"`
}

// UpdateTask handles task updates
func (h *TaskHandler) UpdateTask(c *gin.Context) {
id, err := strconv.ParseUint(c.Param("id"), 10, 32)
if err != nil {
c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid task ID"})
return
}

var task models.Task
if err := h.db.First(&task, id).Error; err != nil {
if err == gorm.ErrRecordNotFound {
c.JSON(http.StatusNotFound, gin.H{"error": "Task not found"})
return
}
c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch task"})
return
}

// Check if user has permission to update
if !middleware.IsResourceOwner(c, task.CreatedBy) {
c.JSON(http.StatusForbidden, gin.H{"error": "Permission denied"})
return
}

var req UpdateTaskRequest
if err := c.ShouldBindJSON(&req); err != nil {
c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
return
}

// Update fields if provided
if req.Title != nil {
task.Title = *req.Title
}
if req.Description != nil {
task.Description = *req.Description
}
if req.Priority != nil {
task.Priority = *req.Priority
}
if req.Status != nil {
task.Status = *req.Status
}
if req.AssignedTo != nil {
// Verify assignee exists
if *req.AssignedTo != 0 {
var user models.User
if err := h.db.First(&user, req.AssignedTo).Error; err != nil {
c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user assignment"})
return
}
}
task.AssignedTo = req.AssignedTo
}

if err := h.db.Save(&task).Error; err != nil {
c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update task"})
return
}

// Reload task with associations
h.db.Preload("Creator").Preload("AssignedUser").First(&task, task.ID)

c.JSON(http.StatusOK, task)
}

// DeleteTask handles task deletion (soft delete)
func (h *TaskHandler) DeleteTask(c *gin.Context) {
id, err := strconv.ParseUint(c.Param("id"), 10, 32)
if err != nil {
c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid task ID"})
return
}

var task models.Task
if err := h.db.First(&task, id).Error; err != nil {
if err == gorm.ErrRecordNotFound {
c.JSON(http.StatusNotFound, gin.H{"error": "Task not found"})
return
}
c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch task"})
return
}

// Check if user has permission to delete
if !middleware.IsResourceOwner(c, task.CreatedBy) {
c.JSON(http.StatusForbidden, gin.H{"error": "Permission denied"})
return
}

if err := h.db.Delete(&task).Error; err != nil {
c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete task"})
return
}

c.JSON(http.StatusOK, gin.H{"message": "Task deleted successfully"})
}

// GetTaskStats returns task statistics
func (h *TaskHandler) GetTaskStats(c *gin.Context) {
userID := middleware.GetUserID(c)

var stats struct {
Total      int64 `json:"total"`
Todo       int64 `json:"todo"`
InProgress int64 `json:"inProgress"`
Done       int64 `json:"done"`
AssignedToMe struct {
Todo       int64 `json:"todo"`
InProgress int64 `json:"inProgress"`
} `json:"assignedToMe"`
}

h.db.Model(&models.Task{}).Count(&stats.Total)
h.db.Model(&models.Task{}).Where("status = ?", models.TaskStatusTodo).Count(&stats.Todo)
h.db.Model(&models.Task{}).Where("status = ?", models.TaskStatusInProgress).Count(&stats.InProgress)
h.db.Model(&models.Task{}).Where("status = ?", models.TaskStatusDone).Count(&stats.Done)

// Get stats for tasks assigned to current user
h.db.Model(&models.Task{}).
Where("assigned_to = ? AND status = ?", userID, models.TaskStatusTodo).
Count(&stats.AssignedToMe.Todo)

h.db.Model(&models.Task{}).
Where("assigned_to = ? AND status = ?", userID, models.TaskStatusInProgress).
Count(&stats.AssignedToMe.InProgress)

c.JSON(http.StatusOK, stats)
}