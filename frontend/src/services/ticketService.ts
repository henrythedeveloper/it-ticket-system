// src/services/ticketService.ts
// ==========================================================================
// Service functions for handling ticket-related API calls.
// **REVISED**: Fixed fetchTicketById to correctly extract nested data object.
// **REVISED AGAIN**: Updated createTicket to handle FormData for attachments.
// **REVISED AGAIN**: Added checks for optional data in API responses.
// ==========================================================================

import api from './api'; // Import the configured Axios instance
import { Ticket, PaginatedResponse, TicketUpdate, TicketAttachment, Tag, APIResponse } from '../types'; // Import relevant types
import { buildQueryString } from '../utils/helpers'; // Helper for query params

// --- Interface Definitions (FetchTicketsParams, AddTicketUpdateInput, UpdateTicketStatusInput) ---
interface FetchTicketsParams {
    page?: number;
    limit?: number;
    status?: string;
    urgency?: string;
    assigneeId?: string | 'unassigned' | 'me';
    submitterId?: string;
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

// --- Service Functions ---

/**
 * Fetches a paginated list of tickets based on provided parameters.
 * @param params - Optional parameters for filtering, sorting, and pagination.
 * @returns A Promise resolving with a PaginatedResponse containing tickets.
 */
export const fetchTickets = async (params: FetchTicketsParams = {}): Promise<PaginatedResponse<Ticket>> => {
    try {
        const queryString = buildQueryString(params);
        const response = await api.get<PaginatedResponse<Ticket>>(`/tickets${queryString}`);
        // Ensure nested data arrays exist
        if (response.data && Array.isArray(response.data.data)) {
            response.data.data = response.data.data.map(ticket => ({
                ...ticket,
                tags: Array.isArray(ticket.tags) ? ticket.tags : [],
                updates: Array.isArray(ticket.updates) ? ticket.updates : [],
                attachments: Array.isArray(ticket.attachments) ? ticket.attachments : []
            }));
        } else {
            // Handle case where response.data or response.data.data is not as expected
            response.data = { ...response.data, data: [], total: 0, totalPages: 0 }; // Provide default empty structure
        }
        return response.data;
    } catch (error) {
        console.error('Fetch tickets API error:', error);
        throw error;
    }
};

/**
 * Fetches a single ticket by its ID, including updates and attachments.
 * @param ticketId - The ID of the ticket to fetch.
 * @returns A Promise resolving with the full Ticket object.
 */
export const fetchTicketById = async (ticketId: string): Promise<Ticket> => {
    try {
        const response = await api.get<APIResponse<Ticket>>(`/tickets/${ticketId}`);
        const ticketData = response.data.data; // Access nested data

        // FIX: Check if ticketData exists before processing/returning
        if (!ticketData) {
            throw new Error("Ticket data missing in API response.");
        }

        // Ensure nested arrays exist
        ticketData.tags = Array.isArray(ticketData.tags) ? ticketData.tags : [];
        ticketData.updates = Array.isArray(ticketData.updates) ? ticketData.updates : [];
        ticketData.attachments = Array.isArray(ticketData.attachments) ? ticketData.attachments : [];

        return ticketData; // Return the validated data
    } catch (error) {
        console.error(`Fetch ticket by ID (${ticketId}) API error:`, error);
        throw error;
    }
};

/**
 * Creates a new ticket, potentially including attachments.
 * @param formData - The FormData object containing ticket details and files.
 * @returns A Promise resolving with the full API response containing the new Ticket object.
 */
export const createTicket = async (formData: FormData): Promise<APIResponse<Ticket>> => {
    try {
        const response = await api.post<APIResponse<Ticket>>('/tickets', formData);

        // Ensure nested arrays exist in the response data
        if (response.data?.data) {
            response.data.data.tags = Array.isArray(response.data.data.tags) ? response.data.data.tags : [];
            response.data.data.updates = Array.isArray(response.data.data.updates) ? response.data.data.updates : [];
            response.data.data.attachments = Array.isArray(response.data.data.attachments) ? response.data.data.attachments : [];
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
        const response = await api.post<APIResponse<TicketUpdate>>(`/tickets/${ticketId}/comments`, updateData);
        // FIX: Check if data exists before returning
        if (!response.data.data) {
            throw new Error("Ticket update data missing in API response.");
        }
        return response.data.data;
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
        const response = await api.put<APIResponse<Ticket>>(`/tickets/${ticketId}`, statusData);
        // FIX: Check if data exists before processing/returning
        if (!response.data.data) {
            throw new Error("Updated ticket data missing in API response.");
        }
        // Ensure nested arrays exist
        response.data.data.tags = Array.isArray(response.data.data.tags) ? response.data.data.tags : [];
        response.data.data.updates = Array.isArray(response.data.data.updates) ? response.data.data.updates : [];
        response.data.data.attachments = Array.isArray(response.data.data.attachments) ? response.data.data.attachments : [];

        return response.data.data;
    } catch (error) {
        console.error(`Update ticket status (${ticketId}) API error:`, error);
        throw error;
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

        const response = await api.post<APIResponse<TicketAttachment>>(
            `/tickets/${ticketId}/attachments`,
            formData,
            { onUploadProgress }
        );
        // FIX: Check if data exists before returning
        if (!response.data.data) {
            throw new Error("Attachment data missing in API response after upload.");
        }
        return response.data.data;
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
