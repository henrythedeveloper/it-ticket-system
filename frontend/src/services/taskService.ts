// src/services/taskService.ts
// ==========================================================================
// Service functions for handling task-related API calls.
// **REVISED**: Made fetchTaskById consistent with backend APIResponse wrapper.
// ==========================================================================

import api from './api'; // Import the configured Axios instance
// Import APIResponse along with other types
import { Task, PaginatedResponse, User, APIResponse } from '../types';
import { buildQueryString } from '../utils/helpers'; // Helper for query params

/**
 * Represents the parameters for fetching tasks (filtering, pagination).
 */
interface FetchTasksParams {
    page?: number;
    limit?: number;
    status?: string; // e.g., 'Open', 'In Progress'
    assigneeId?: string | 'unassigned' | 'me'; // Allow special filters
    sortBy?: string; // e.g., 'dueDate', 'createdAt'
    sortOrder?: 'asc' | 'desc';
    search?: string; // Search term
}

/**
 * Represents the data structure for creating or updating a task.
 */
// Use Partial for update, ensure required fields for create if needed separately
type TaskInputData = Partial<Omit<Task, 'id' | 'task_number' | 'createdAt' | 'updatedAt' | 'createdBy' | 'assignedTo' | 'updates'>>;


// --- Service Functions ---

/**
 * Fetches a paginated list of tasks based on provided parameters.
 * @param params - Optional parameters for filtering, sorting, and pagination.
 * @returns A Promise resolving with a PaginatedResponse containing tasks.
 */
export const fetchTasks = async (params: FetchTasksParams = {}): Promise<PaginatedResponse<Task>> => {
    try {
        const queryString = buildQueryString(params);
        // Assuming list endpoint returns PaginatedResponse directly
        const response = await api.get<PaginatedResponse<Task>>(`/tasks${queryString}`);
        // Ensure nested data arrays exist (if tasks have nested arrays like tickets do)
        if (response.data && Array.isArray(response.data.data)) {
             response.data.data = response.data.data.map(task => ({
                 ...task,
                 // Example: Ensure updates array exists if Task type includes it
                 // updates: Array.isArray(task.updates) ? task.updates : []
             }));
        } else {
             response.data = { ...response.data, data: [], total: 0, total_pages: 0 };
        }
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
        // ** FIX: Expect the APIResponse wrapper from the backend **
        const response = await api.get<APIResponse<Task>>(`/tasks/${taskId}`);

        // ** FIX: Extract the task data from response.data.data **
        const taskData = response.data.data;

        // Check if task data exists in the response
        if (!taskData) {
            throw new Error("Task data missing in API response.");
        }

        // Ensure nested arrays exist if Task model has them (e.g., updates)
        // taskData.updates = Array.isArray(taskData.updates) ? taskData.updates : [];

        return taskData; // Return the nested Task object
    } catch (error) {
        console.error(`Fetch task by ID (${taskId}) API error:`, error);
        throw error;
    }
};

/**
 * Creates a new task.
 * @param taskData - The data for the new task.
 * @returns A Promise resolving with the newly created Task object (assuming backend returns it wrapped).
 */
export const createTask = async (taskData: TaskInputData): Promise<Task> => {
    try {
        // ** ASSUMPTION: Backend wraps the created task in APIResponse **
        // If backend returns Task directly, change APIResponse<Task> to Task
        const response = await api.post<APIResponse<Task>>('/tasks', taskData);
        if (!response.data.data) {
             throw new Error("Created task data missing in API response.");
        }
        return response.data.data; // Return nested data
    } catch (error) {
        console.error('Create task API error:', error);
        throw error;
    }
};

/**
 * Updates an existing task.
 * @param taskId - The ID of the task to update.
 * @param taskData - The updated data for the task.
 * @returns A Promise resolving with the updated Task object (assuming backend returns it wrapped).
 */
export const updateTask = async (taskId: string, taskData: TaskInputData): Promise<Task> => {
    try {
        // ** ASSUMPTION: Backend wraps the updated task in APIResponse **
        // If backend returns Task directly, change APIResponse<Task> to Task
        const response = await api.put<APIResponse<Task>>(`/tasks/${taskId}`, taskData);
         if (!response.data.data) {
             throw new Error("Updated task data missing in API response.");
        }
        return response.data.data; // Return nested data
    } catch (error) {
        console.error(`Update task (${taskId}) API error:`, error);
        throw error;
    }
};

/**
 * Deletes a task by its ID.
 * @param taskId - The ID of the task to delete.
 * @returns A Promise resolving when the deletion is successful (assuming backend returns simple success/no content).
 */
export const deleteTask = async (taskId: string): Promise<void> => {
    try {
        // ** ASSUMPTION: Backend returns simple success (e.g., 200 OK with APIResponse or 204 No Content) **
        // Adjust if backend returns specific data on delete
        await api.delete(`/tasks/${taskId}`);
    } catch (error) {
        console.error(`Delete task (${taskId}) API error:`, error);
        throw error;
    }
};

// TODO: Add functions for updating task status, adding updates if separate endpoints exist.
// Example:
// export const updateTaskStatus = async (taskId: string, statusData: { status: TaskStatus }): Promise<Task> => { ... }
// export const addTaskUpdate = async (taskId: string, updateData: { comment: string }): Promise<TaskUpdate> => { ... }

