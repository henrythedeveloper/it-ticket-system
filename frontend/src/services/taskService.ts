// src/services/taskService.ts
// ==========================================================================
// Service functions for handling task-related API calls.
// ==========================================================================

import api from './api'; // Import the configured Axios instance
import { Task, PaginatedResponse } from '../types'; // Import relevant types
import { buildQueryString } from '../utils/helpers'; // Helper for query params

/**
 * Represents the parameters for fetching tasks (filtering, pagination).
 */
interface FetchTasksParams {
    page?: number;
    limit?: number;
    status?: string; // e.g., 'Open', 'In Progress'
    assigneeId?: string; // Filter by assignee
    sortBy?: string; // e.g., 'dueDate', 'createdAt'
    sortOrder?: 'asc' | 'desc';
    search?: string; // Search term
}

/**
 * Represents the data structure for creating or updating a task.
 */
type TaskInputData = Partial<Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>>;

// --- Service Functions ---

/**
 * Fetches a paginated list of tasks based on provided parameters.
 * @param params - Optional parameters for filtering, sorting, and pagination.
 * @returns A Promise resolving with a PaginatedResponse containing tasks.
 */
export const fetchTasks = async (params: FetchTasksParams = {}): Promise<PaginatedResponse<Task>> => {
    try {
    const queryString = buildQueryString(params); // Build query string from params
    const response = await api.get<PaginatedResponse<Task>>(`/tasks${queryString}`);
    return response.data;
    } catch (error) {
    console.error('Fetch tasks API error:', error);
    throw error;
    }
};

/**
 * Fetches a single task by its ID.
 * @param taskId - The ID of the task to fetch.
 * @returns A Promise resolving with the Task object.
 */
export const fetchTaskById = async (taskId: string): Promise<Task> => {
    try {
    const response = await api.get<Task>(`/tasks/${taskId}`);
    return response.data;
    } catch (error) {
    console.error(`Fetch task by ID (${taskId}) API error:`, error);
    throw error;
    }
};

/**
 * Creates a new task.
 * @param taskData - The data for the new task.
 * @returns A Promise resolving with the newly created Task object.
 */
export const createTask = async (taskData: TaskInputData): Promise<Task> => {
    try {
    const response = await api.post<Task>('/tasks', taskData);
    return response.data;
    } catch (error) {
    console.error('Create task API error:', error);
    throw error;
    }
};

/**
 * Updates an existing task.
 * @param taskId - The ID of the task to update.
 * @param taskData - The updated data for the task.
 * @returns A Promise resolving with the updated Task object.
 */
export const updateTask = async (taskId: string, taskData: TaskInputData): Promise<Task> => {
    try {
    const response = await api.put<Task>(`/tasks/${taskId}`, taskData);
    return response.data;
    } catch (error) {
    console.error(`Update task (${taskId}) API error:`, error);
    throw error;
    }
};

/**
 * Deletes a task by its ID.
 * @param taskId - The ID of the task to delete.
 * @returns A Promise resolving when the deletion is successful.
 */
export const deleteTask = async (taskId: string): Promise<void> => {
    try {
    await api.delete(`/tasks/${taskId}`);
    // No data usually returned on successful delete
    } catch (error) {
    console.error(`Delete task (${taskId}) API error:`, error);
    throw error;
    }
};
