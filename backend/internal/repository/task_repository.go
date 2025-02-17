package repository

import (
	"gorm.io/gorm"
	"helpdesk/internal/models"
)

type TaskRepository struct {
	db *gorm.DB
}

func NewTaskRepository(db *gorm.DB) *TaskRepository {
	return &TaskRepository{db: db}
}

type TaskFilter struct {
	Status     string
	Priority   string
	AssignedTo *uint
	CreatedBy  *uint
}

func (r *TaskRepository) Create(tx *gorm.DB, task *models.Task) error {
	return tx.Create(task).Error
}

func (r *TaskRepository) CreateHistory(tx *gorm.DB, history *models.TaskHistory) error {
	return tx.Create(history).Error
}

func (r *TaskRepository) GetByID(id uint) (*models.Task, error) {
	var task models.Task
	err := r.db.Preload("Creator").Preload("AssignedUser").First(&task, id).Error
	if err != nil {
		return nil, err
	}
	return &task, nil
}

func (r *TaskRepository) GetHistory(taskID uint) ([]models.TaskHistory, error) {
	var history []models.TaskHistory
	err := r.db.Where("task_id = ?", taskID).
		Preload("User").
		Order("created_at DESC").
		Find(&history).Error
	return history, err
}

func (r *TaskRepository) List(filter TaskFilter) ([]models.Task, error) {
	query := r.db.Model(&models.Task{}).
		Preload("Creator").
		Preload("AssignedUser").
		Order("created_at DESC")

	if filter.Status != "" {
		query = query.Where("status = ?", filter.Status)
	}
	if filter.Priority != "" {
		query = query.Where("priority = ?", filter.Priority)
	}
	if filter.AssignedTo != nil {
		query = query.Where("assigned_to = ?", filter.AssignedTo)
	}
	if filter.CreatedBy != nil {
		query = query.Where("created_by = ?", filter.CreatedBy)
	}

	var tasks []models.Task
	err := query.Find(&tasks).Error
	return tasks, err
}

func (r *TaskRepository) Update(tx *gorm.DB, task *models.Task) error {
	return tx.Save(task).Error
}

func (r *TaskRepository) Delete(tx *gorm.DB, task *models.Task) error {
	return tx.Delete(task).Error
}

type TaskStats struct {
	Total         int64
	Todo          int64
	InProgress    int64
	Done          int64
	AssignedToMe  AssignedStats
}

type AssignedStats struct {
	Todo       int64
	InProgress int64
}

func (r *TaskRepository) GetStats(userID uint) (*TaskStats, error) {
	var stats TaskStats

	if err := r.db.Model(&models.Task{}).Count(&stats.Total).Error; err != nil {
		return nil, err
	}
	
	if err := r.db.Model(&models.Task{}).Where("status = ?", models.TaskStatusTodo).Count(&stats.Todo).Error; err != nil {
		return nil, err
	}
	
	if err := r.db.Model(&models.Task{}).Where("status = ?", models.TaskStatusInProgress).Count(&stats.InProgress).Error; err != nil {
		return nil, err
	}
	
	if err := r.db.Model(&models.Task{}).Where("status = ?", models.TaskStatusDone).Count(&stats.Done).Error; err != nil {
		return nil, err
	}

	if err := r.db.Model(&models.Task{}).
		Where("assigned_to = ? AND status = ?", userID, models.TaskStatusTodo).
		Count(&stats.AssignedToMe.Todo).Error; err != nil {
		return nil, err
	}

	if err := r.db.Model(&models.Task{}).
		Where("assigned_to = ? AND status = ?", userID, models.TaskStatusInProgress).
		Count(&stats.AssignedToMe.InProgress).Error; err != nil {
		return nil, err
	}

	return &stats, nil
}