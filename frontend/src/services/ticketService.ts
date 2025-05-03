// src/services/ticketService.ts
// ==========================================================================
// Service functions for handling ticket-related API calls.
// **REVISED AGAIN**: Reverted fetchTickets mapping to expect `tags: Tag[]`
//                    as backend now includes this directly in the list response.
// ==========================================================================

import api from './api'; // Import the configured Axios instance
import { Ticket, PaginatedResponse, TicketUpdate, TicketAttachment, Tag, APIResponse, User } from '../types'; // Import relevant types
import { buildQueryString, keysToCamel } from '../utils/helpers'; // Helper for query params and keysToCamel

// --- Constants ---
const DEFAULT_LIMIT = 15; // Default number of items per page

// --- Interface Definitions ---

/**
 * Represents the parameters for fetching tickets (filtering, pagination).
 * Keys match the backend query parameter names (snake_case).
 */
interface FetchTicketsParams {
    page?: number;
    limit?: number;
    status?: string;
    urgency?: string;
    assigned_to?: string | 'unassigned' | 'me';
    submitter_id?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    search?: string;
    tags?: string;
}

interface AddTicketUpdateInput {
    content: string;
    isInternalNote?: boolean;
}

interface UpdateTicketStatusInput {
    status: Ticket['status'];
    assignedToId?: string | null;
    resolutionNotes?: string;
}

// --- Raw API Response Structures ---
// Define the raw structure expected from the LIST endpoint
// *** REVERTED: Expecting backend to send mapped 'assignedTo' and 'tags' directly ***
interface RawTicketListItem extends Omit<Ticket, 'updates' | 'attachments'> {
    // Assuming backend now sends assignedTo and tags directly in the list view
    // assigned_to_user?: Pick<User, 'id' | 'name'> | null; // No longer needed if backend sends assignedTo
    // tag_names?: string[] | null; // No longer needed if backend sends tags
}

interface RawPaginatedResponse extends Omit<PaginatedResponse<any>, 'data'> {
    // Expecting data to be closer to the final Ticket structure now
    data: RawTicketListItem[];
}

// --- Service Functions ---

/**
 * Fetches a single ticket by its ID, including updates and attachments.
 * Maps backend snake_case fields like assigned_to_user to frontend camelCase assignedTo.
 * @param ticketId - The ID of the ticket to fetch.
 * @returns A Promise resolving with the full Ticket object.
 */
export const fetchTicketById = async (ticketId: string): Promise<Ticket> => {
    try {
        // --- CHANGE HERE ---
        // Expect the response.data *itself* to be the raw ticket object
        const response = await api.get<any>(`/tickets/${ticketId}`); // Use <any> or a specific RawTicket type if defined elsewhere
        const rawData = response.data; // Use response.data directly

        // Check if rawData is actually received
        if (!rawData || typeof rawData !== 'object') { // Add a type check
            console.error('[fetchTicketById] Invalid data received from API:', rawData);
            throw new Error("Invalid ticket data received from API.");
        }
        // --- END CHANGE ---

        // Convert all keys to camelCase
        const ticketData: Ticket = keysToCamel(rawData);

        // Ensure tags/updates/attachments are arrays if they exist, or initialize if needed
        ticketData.tags = Array.isArray(ticketData.tags) ? ticketData.tags.map(tag => ({ ...tag, createdAt: tag.createdAt ?? '' })) : [];
        ticketData.updates = Array.isArray(ticketData.updates) ? ticketData.updates : [];
        ticketData.attachments = Array.isArray(ticketData.attachments) ? ticketData.attachments : [];


        // Specific check if ID is missing after mapping (shouldn't happen if rawData is valid)
        if (!ticketData.id) {
            console.error('[fetchTicketById] Ticket ID missing after mapping:', ticketData);
            throw new Error("Mapped ticket data is missing ID.");
        }

        return ticketData; // Return the mapped data
    } catch (error: any) { // Catch specific AxiosError if needed for response access
        console.error(`Workspace ticket by ID (${ticketId}) API error:`, error);
        // Re-throw a potentially more specific error or the original one
        const errorMessage = error.response?.data?.error || // Check for backend { "error": "..." }
                        error.response?.data?.message ||
                        error.message ||
                        'Failed to fetch ticket details.';
        throw new Error(errorMessage);
    }
};



/**
 * Fetches a paginated list of tickets based on provided parameters.
 * Assumes backend now sends data closer to the frontend Ticket structure.
 * @param params - Optional parameters for filtering, sorting, and pagination. Uses FetchTicketsParams interface.
 * @returns A Promise resolving with a PaginatedResponse containing mapped Ticket objects.
 */
export const fetchTickets = async (params: FetchTicketsParams = {}): Promise<PaginatedResponse<Ticket>> => {
    try {
        const queryString = buildQueryString(params);
        // Fetch expecting PaginatedResponse<Ticket> directly, assuming backend sends mapped data
        const response = await api.get<PaginatedResponse<any>>(`/tickets${queryString}`);

        // Validate the basic structure of the response
        if (!response.data || !Array.isArray(response.data.data)) {
             console.warn("Received invalid paginated response structure from /tickets");
             // Return a default empty paginated response
             return {
                 data: [],
                 total: 0,
                 page: params.page || 1,
                 limit: params.limit || DEFAULT_LIMIT,
                 total_pages: 0,
                 hasMore: false
                };
        }

        // Convert all tickets to camelCase
        const mappedTickets = response.data.data.map(keysToCamel);

        // Return the PaginatedResponse with potentially validated data
        return {
            ...response.data, // Copy pagination fields (total, page, etc.)
            data: mappedTickets, // Use the validated/mapped ticket data
        };

    } catch (error) {
        console.error('Fetch tickets API error:', error);
        throw error; // Re-throw the error for the calling component to handle
    }
};


/**
 * Creates a new ticket, potentially including attachments.
 * @param formData - The FormData object containing ticket details and files.
 * @returns A Promise resolving with the full API response containing the new Ticket object.
 */
export const createTicket = async (formData: FormData): Promise<APIResponse<Ticket>> => {
    try {
        const response = await api.post<APIResponse<any>>('/tickets', formData);

        // Convert all keys to camelCase
        if (response.data?.data) {
            response.data.data = keysToCamel(response.data.data);
        }
        // Return the whole APIResponse structure as expected by useFormSubmit
        return response.data;
    } catch (error: any) {
        console.error('Create ticket API error:', error);
        throw error;
    }
};


/**
 * Adds an update (comment) to a specific ticket.
 * @param ticketId - The ID of the ticket to update.
 * @param updateData - The content of the update and optional flags.
 * @returns A Promise resolving with the newly added TicketUpdate object.
 */
export const addTicketUpdate = async (ticketId: string, updateData: AddTicketUpdateInput): Promise<TicketUpdate> => {
    try {
        const response = await api.post<APIResponse<any>>(`/tickets/${ticketId}/comments`, updateData);
        if (!response.data.data) {
            throw new Error("Ticket update data missing in API response.");
        }
        return keysToCamel(response.data.data);
    } catch (error) {
        console.error(`Add ticket update (${ticketId}) API error:`, error);
        throw error;
    }
};

/**
 * Updates the status and/or assignment of a ticket.
 * @param ticketId - The ID of the ticket to update.
 * @param statusData - The new status, optional assignee ID, and optional resolution notes.
 * @returns A Promise resolving with the updated Ticket object.
 */

export const updateTicketStatus = async (ticketId: string, statusData: UpdateTicketStatusInput): Promise<Ticket> => {
    try {
        console.log(`[updateTicketStatus] Sending PUT request for ID: ${ticketId} with data:`, statusData);

        // Expect the response data itself to be the raw ticket object
        // Use <any> or define a specific RawTicket type if needed for snake_case fields before mapping
        const response = await api.put<any>(`/tickets/${ticketId}`, statusData);

        // Use response.data directly as the raw ticket data
        const rawData = response.data;
        console.log(`[updateTicketStatus] Received response data:`, rawData);

        // Check if rawData is actually received and looks like an object
        if (!rawData || typeof rawData !== 'object') {
            console.error('[updateTicketStatus] Invalid data received from API:', rawData);
            throw new Error("Invalid ticket data received from API update.");
        }

        // Convert keys (assuming backend might still send snake_case here)
        const ticketData: Ticket = keysToCamel(rawData);
        console.log(`[updateTicketStatus] Mapped ticket data:`, ticketData);

        // Basic validation after mapping
        if (!ticketData.id) {
             console.error('[updateTicketStatus] Ticket ID missing after mapping:', ticketData);
             throw new Error("Mapped ticket data is missing ID after update.");
        }

         // Ensure arrays are present (optional, but good practice)
        ticketData.tags = Array.isArray(ticketData.tags) ? ticketData.tags : [];
        ticketData.updates = Array.isArray(ticketData.updates) ? ticketData.updates : [];
        ticketData.attachments = Array.isArray(ticketData.attachments) ? ticketData.attachments : [];


        return ticketData; // Return the mapped data

    } catch (error: any) {
        // Log more context if available from Axios error
        const responseData = error.response?.data;
        console.error(`Update ticket status (${ticketId}) API error:`, {
            message: error.message,
            response: responseData,
            fullError: error
        });
        // Re-throw a potentially more specific error or the original one
        const errorMessage = responseData?.error || responseData?.message || error.message || 'Failed to update ticket status.';
        throw new Error(errorMessage);
    }
};


/**
 * Uploads an attachment file for a specific ticket (alternative way, if not done during creation).
 * Uses FormData for file upload.
 * @param ticketId - The ID of the ticket to attach the file to.
 * @param file - The File object to upload.
 * @param onUploadProgress - Optional callback function to track upload progress.
 * @returns A Promise resolving with the newly created TicketAttachment object.
 */
export const uploadTicketAttachment = async (
    ticketId: string,
    file: File,
    onUploadProgress?: (progressEvent: any) => void
): Promise<TicketAttachment> => {
    try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await api.post<APIResponse<any>>(
            `/tickets/${ticketId}/attachments`,
            formData,
            { onUploadProgress }
        );
        if (!response.data.data) {
            throw new Error("Attachment data missing in API response after upload.");
        }
        return keysToCamel(response.data.data);
    } catch (error) {
        console.error(`Upload ticket attachment (${ticketId}) API error:`, error);
        throw error;
    }
};

/**
 * Deletes a ticket attachment.
 * @param ticketId - The ID of the ticket containing the attachment.
 * @param attachmentId - The ID of the attachment to delete.
 * @returns A Promise resolving when the deletion is successful.
 */
export const deleteTicketAttachment = async (ticketId: string, attachmentId: string): Promise<void> => {
    try {
        await api.delete(`/tickets/${ticketId}/attachments/${attachmentId}`);
    } catch (error) {
        console.error(`Delete ticket attachment (${ticketId}/${attachmentId}) API error:`, error);
        throw error;
    }
};
