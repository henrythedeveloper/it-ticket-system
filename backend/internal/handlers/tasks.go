package handlers

import (
"net/http"
"strconv"
"time"

"github.com/gin-gonic/gin"
"gorm.io/gorm"
"helpdesk/internal/middleware"
"helpdesk/internal/repository"
"helpdesk/internal/service"
)

type TaskHandler struct {
taskService *service.TaskService
}

func NewTaskHandler(db *gorm.DB) *TaskHandler {
return &TaskHandler{
taskService: service.NewTaskService(db),
}
}

type CreateTaskRequest struct {
Title         string     `json:"title" binding:"required"`
Description   string     `json:"description" binding:"required"`
Priority      string     `json:"priority" binding:"required,oneof=low medium high"`
AssignedTo    *uint      `json:"assignedTo"`
DueDate       *time.Time `json:"dueDate,omitempty"`
RecurringTask *CreateRecurringTaskRequest `json:"recurringTask,omitempty"`
}

type CreateRecurringTaskRequest struct {
Frequency   string `json:"frequency" binding:"required,oneof=daily weekly monthly"`
}

func (h *TaskHandler) CreateTask(c *gin.Context) {
var req CreateTaskRequest
if err := c.ShouldBindJSON(&req); err != nil {
c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
return
}

userID := middleware.GetUserID(c)

if req.RecurringTask != nil {
// Create recurring task first
recurringTask, err := h.taskService.CreateRecurringTask(service.CreateRecurringTaskInput{
Title:       req.Title,
Description: req.Description,
Priority:    req.Priority,
AssignedTo:  req.AssignedTo,
Frequency:   req.RecurringTask.Frequency,
CreatedBy:   userID,
})
if err != nil {
c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
return
}

// Create first instance of recurring task
task, err := h.taskService.CreateTask(service.CreateTaskInput{
Title:       req.Title,
Description: req.Description,
Priority:    req.Priority,
AssignedTo:  req.AssignedTo,
DueDate:     req.DueDate,
RecurringID: &recurringTask.ID,
}, userID)
if err != nil {
c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
return
}
c.JSON(http.StatusCreated, task)
return
}

// Create regular task
task, err := h.taskService.CreateTask(service.CreateTaskInput{
Title:       req.Title,
Description: req.Description,
Priority:    req.Priority,
AssignedTo:  req.AssignedTo,
DueDate:     req.DueDate,
}, userID)
if err != nil {
c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
return
}

c.JSON(http.StatusCreated, task)
}

func (h *TaskHandler) ListTasks(c *gin.Context) {
filter := repository.TaskFilter{
Status:   c.Query("status"),
Priority: c.Query("priority"),
}

// Filter by assigned user
if assignedTo := c.Query("assignedTo"); assignedTo != "" {
if assignedTo == "me" {
userID := middleware.GetUserID(c)
filter.AssignedTo = &userID
} else {
if userID, err := strconv.ParseUint(assignedTo, 10, 32); err == nil {
uid := uint(userID)
filter.AssignedTo = &uid
}
}
}

// Filter by creator
if createdBy := c.Query("createdBy"); createdBy != "" {
if createdBy == "me" {
userID := middleware.GetUserID(c)
filter.CreatedBy = &userID
} else {
if userID, err := strconv.ParseUint(createdBy, 10, 32); err == nil {
uid := uint(userID)
filter.CreatedBy = &uid
}
}
}

tasks, err := h.taskService.ListTasks(filter)
if err != nil {
c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch tasks"})
return
}

if len(tasks) == 0 {
c.JSON(http.StatusOK, gin.H{"data": []struct{}{}})
return
}

c.JSON(http.StatusOK, gin.H{"data": tasks})
}

func (h *TaskHandler) GetTask(c *gin.Context) {
id, err := strconv.ParseUint(c.Param("id"), 10, 32)
if err != nil {
c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid task ID"})
return
}

task, err := h.taskService.GetTask(uint(id))
if err != nil {
if err == gorm.ErrRecordNotFound {
c.JSON(http.StatusNotFound, gin.H{"error": "Task not found"})
} else {
c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch task"})
}
return
}

c.JSON(http.StatusOK, task)
}

type UpdateTaskRequest struct {
Title             *string `json:"title,omitempty"`
Description       *string `json:"description,omitempty"`
Priority          *string `json:"priority,omitempty" binding:"omitempty,oneof=low medium high"`
Status            *string `json:"status,omitempty" binding:"omitempty,oneof=todo in_progress done"`
AssignedTo        *uint   `json:"assignedTo,omitempty"`
ReassignmentNotes *string `json:"reassignmentNotes,omitempty"`
}

func (h *TaskHandler) UpdateTask(c *gin.Context) {
id, err := strconv.ParseUint(c.Param("id"), 10, 32)
if err != nil {
c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid task ID"})
return
}

// Check if task exists
task, err := h.taskService.GetTask(uint(id))
if err != nil {
if err == gorm.ErrRecordNotFound {
c.JSON(http.StatusNotFound, gin.H{"error": "Task not found"})
} else {
c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch task"})
}
return
}

// Check if user has permission
if !middleware.IsResourceOwner(c, task.CreatedBy) {
c.JSON(http.StatusForbidden, gin.H{"error": "Permission denied"})
return
}

var req UpdateTaskRequest
if err := c.ShouldBindJSON(&req); err != nil {
c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
return
}

updatedTask, err := h.taskService.UpdateTask(uint(id), service.UpdateTaskInput{
Title:             req.Title,
Description:       req.Description,
Priority:          req.Priority,
Status:            req.Status,
AssignedTo:        req.AssignedTo,
ReassignmentNotes: req.ReassignmentNotes,
UpdatedBy:         middleware.GetUserID(c),
})

if err != nil {
c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
return
}

c.JSON(http.StatusOK, updatedTask)
}

func (h *TaskHandler) DeleteTask(c *gin.Context) {
id, err := strconv.ParseUint(c.Param("id"), 10, 32)
if err != nil {
c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid task ID"})
return
}

// Check if task exists
task, err := h.taskService.GetTask(uint(id))
if err != nil {
if err == gorm.ErrRecordNotFound {
c.JSON(http.StatusNotFound, gin.H{"error": "Task not found"})
} else {
c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch task"})
}
return
}

// Check if user has permission
if !middleware.IsResourceOwner(c, task.CreatedBy) {
c.JSON(http.StatusForbidden, gin.H{"error": "Permission denied"})
return
}

if err := h.taskService.DeleteTask(uint(id)); err != nil {
c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete task"})
return
}

c.JSON(http.StatusOK, gin.H{"message": "Task deleted successfully"})
}

func (h *TaskHandler) GetTaskHistory(c *gin.Context) {
id, err := strconv.ParseUint(c.Param("id"), 10, 32)
if err != nil {
c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid task ID"})
return
}

history, err := h.taskService.GetTaskHistory(uint(id))
if err != nil {
c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch task history"})
return
}

c.JSON(http.StatusOK, gin.H{"data": history})
}

func (h *TaskHandler) GetTaskStats(c *gin.Context) {
userID := middleware.GetUserID(c)

stats, err := h.taskService.GetTaskStats(userID)
if err != nil {
c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch task stats"})
return
}

c.JSON(http.StatusOK, stats)
}