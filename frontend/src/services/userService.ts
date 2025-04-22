// src/services/userService.ts
// ==========================================================================
// Service functions for handling user-related API calls (typically admin actions).
// ==========================================================================

import api from './api'; // Import the configured Axios instance
import { User, PaginatedResponse } from '../types'; // Import relevant types
import { buildQueryString } from '../utils/helpers'; // Helper for query params

/**
 * Represents the parameters for fetching users (filtering, pagination).
 */
interface FetchUsersParams {
    page?: number;
    limit?: number;
    role?: string; // Filter by role (e.g., 'Admin', 'Staff')
    search?: string; // Search term (name or email)
    sortBy?: string; // e.g., 'name', 'createdAt'
    sortOrder?: 'asc' | 'desc';
}

/**
 * Represents the data structure for creating or updating a user.
 * Password might be handled separately or only set during creation.
 */
type UserInputData = Partial<Omit<User, 'id' | 'createdAt' | 'updatedAt'>> & {
    password?: string; // Include password only when needed (e.g., creation)
};

// --- Service Functions ---

/**
 * Fetches a paginated list of users based on provided parameters.
 * (Requires Admin privileges)
 * @param params - Optional parameters for filtering, sorting, and pagination.
 * @returns A Promise resolving with a PaginatedResponse containing users.
 */
export const fetchUsers = async (params: FetchUsersParams = {}): Promise<PaginatedResponse<User>> => {
    try {
    const queryString = buildQueryString(params);
    const response = await api.get<PaginatedResponse<User>>(`/users${queryString}`);
    return response.data;
    } catch (error) {
    console.error('Fetch users API error:', error);
    throw error;
    }
};

/**
 * Fetches a single user by their ID.
 * (Requires Admin privileges or fetching own profile via authService)
 * @param userId - The ID of the user to fetch.
 * @returns A Promise resolving with the User object.
 */
export const fetchUserById = async (userId: string): Promise<User> => {
    try {
    const response = await api.get<User>(`/users/${userId}`);
    return response.data;
    } catch (error) {
    console.error(`Fetch user by ID (${userId}) API error:`, error);
    throw error;
    }
};

/**
 * Creates a new user.
 * (Requires Admin privileges)
 * @param userData - The data for the new user (name, email, role, password).
 * @returns A Promise resolving with the newly created User object.
 */
export const createUser = async (userData: UserInputData): Promise<User> => {
    try {
    const response = await api.post<User>('/users', userData);
    return response.data;
    } catch (error) {
    console.error('Create user API error:', error);
    throw error;
    }
};

/**
 * Updates an existing user.
 * (Requires Admin privileges or updating own profile)
 * @param userId - The ID of the user to update.
 * @param userData - The updated data for the user (omitting password unless changing it).
 * @returns A Promise resolving with the updated User object.
 */
export const updateUser = async (userId: string, userData: UserInputData): Promise<User> => {
    try {
    // Ensure password isn't accidentally sent if not intended
    const dataToSend = { ...userData };
    if (!dataToSend.password) {
        delete dataToSend.password;
    }

    const response = await api.put<User>(`/users/${userId}`, dataToSend);
    return response.data;
    } catch (error) {
    console.error(`Update user (${userId}) API error:`, error);
    throw error;
    }
};

/**
 * Deletes a user by their ID.
 * (Requires Admin privileges)
 * @param userId - The ID of the user to delete.
 * @returns A Promise resolving when the deletion is successful.
 */
export const deleteUser = async (userId: string): Promise<void> => {
    try {
    await api.delete(`/users/${userId}`);
    // No data usually returned on successful delete
    } catch (error) {
    console.error(`Delete user (${userId}) API error:`, error);
    throw error;
    }
};
