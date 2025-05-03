// File: frontend/src/services/tagService.ts
// ==========================================================================
// Service functions for handling tag-related API calls.
// **CORRECTED**: Removed extraneous code from other files.
// ==========================================================================

import api from './api'; // Import the configured Axios instance
import { Tag, APIResponse } from '../types'; // Import relevant types
import { keysToCamel } from '../utils/helpers'; // Helper for keysToCamel

/**
 * Fetches the list of all available tags.
 * @returns A Promise resolving with an array of Tag objects.
 */
export const fetchTags = async (): Promise<Tag[]> => {
    try {
        // The backend returns an APIResponse structure { success: true, data: [...] }
        const response = await api.get<APIResponse<any[]>>('/tags'); // Use <any[]> initially

        // Check if the response has the expected structure and data
        if (response.data?.success && Array.isArray(response.data.data)) {
            // Map the raw data to Tag objects and convert keys to camelCase
            return response.data.data.map(tag => keysToCamel<Tag>(tag));
        } else {
            console.warn("Received unexpected data structure from /tags:", response.data);
            return []; // Return empty array if data is missing or not an array
        }
    } catch (error) {
        console.error('Fetch tags API error:', error);
        throw error; // Re-throw the error for the calling component/hook to handle
    }
};

/**
 * Creates a new tag. (Requires Admin privileges)
 * @param tagName - The name of the tag to create.
 * @returns A Promise resolving with the newly created Tag object.
 */
export const createTag = async (tagName: string): Promise<Tag> => {
    try {
        const response = await api.post<APIResponse<any>>('/tags', { name: tagName });
        if (!response.data?.success || !response.data.data) {
            throw new Error(response.data?.message || "Failed to create tag.");
        }
        return keysToCamel<Tag>(response.data.data);
    } catch (error) {
        console.error('Create tag API error:', error);
        throw error;
    }
};

/**
 * Deletes a tag by its ID. (Requires Admin privileges)
 * @param tagId - The ID of the tag to delete.
 * @returns A Promise resolving when the deletion is successful.
 */
export const deleteTag = async (tagId: string): Promise<void> => {
    try {
        await api.delete(`/tags/${tagId}`);
        // No data usually returned on successful delete
    } catch (error) {
        console.error(`Delete tag (${tagId}) API error:`, error);
        throw error;
    }
};
