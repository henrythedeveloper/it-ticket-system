// src/services/ticketService.ts
// ==========================================================================
// Service functions for handling ticket-related API calls.
// ==========================================================================

import api from './api'; // Import the configured Axios instance
import { Ticket, PaginatedResponse, TicketUpdate, TicketAttachment } from '../types'; // Import relevant types
import { buildQueryString } from '../utils/helpers'; // Helper for query params

/**
 * Represents the parameters for fetching tickets (filtering, pagination, sorting).
 */
interface FetchTicketsParams {
page?: number;
limit?: number;
status?: string; // e.g., 'Unassigned', 'Closed'
urgency?: string; // e.g., 'High', 'Low'
assigneeId?: string | 'unassigned'; // Filter by assignee or specifically unassigned
submitterId?: string; // Filter by submitter
sortBy?: string; // e.g., 'createdAt', 'updatedAt', 'urgency'
sortOrder?: 'asc' | 'desc';
search?: string; // Search term
tags?: string; // Comma-separated list of tags to filter by
}

/**
 * Represents the data structure for creating a new ticket.
 */
type CreateTicketInputData = Pick<Ticket, 'subject' | 'description' | 'urgency' | 'issueType' | 'tags'> & {
// Submitter info might be inferred backend-side or added explicitly if needed
submitterEmail?: string; // Example if email is collected for public submissions
submitterName?: string;
};

/**
 * Represents the data structure for adding an update/comment.
 */
interface AddTicketUpdateInput {
content: string;
isInternalNote?: boolean;
}

/**
 * Represents the data structure for updating ticket status/assignment.
 */
interface UpdateTicketStatusInput {
status: Ticket['status'];
assignedToId?: string | null;
resolutionNotes?: string; // Required if status is 'Closed'
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
// Assuming the backend returns the full ticket details, including updates/attachments
const response = await api.get<Ticket>(`/tickets/${ticketId}`);
return response.data;
} catch (error) {
console.error(`Fetch ticket by ID (${ticketId}) API error:`, error);
throw error;
}
};

/**
 * Creates a new ticket.
 * @param ticketData - The data for the new ticket.
 * @returns A Promise resolving with the newly created Ticket object.
 */
export const createTicket = async (ticketData: CreateTicketInputData): Promise<Ticket> => {
try {
const response = await api.post<Ticket>('/tickets', ticketData);
return response.data;
} catch (error) {
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
    const response = await api.post<TicketUpdate>(`/tickets/${ticketId}/updates`, updateData);
    return response.data;
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
    const response = await api.put<Ticket>(`/tickets/${ticketId}/status`, statusData);
    return response.data;
} catch (error) {
    console.error(`Update ticket status (${ticketId}) API error:`, error);
    throw error;
}
};

/**
 * Uploads an attachment file for a specific ticket.
 * Uses FormData for file upload.
 * @param ticketId - The ID of the ticket to attach the file to.
 * @param file - The File object to upload.
 * @param onUploadProgress - Optional callback function to track upload progress.
 * @returns A Promise resolving with the newly created TicketAttachment object.
 */
export const uploadTicketAttachment = async (
ticketId: string,
file: File,
onUploadProgress?: (progressEvent: any) => void // Use appropriate progress event type if needed
): Promise<TicketAttachment> => {
try {
    const formData = new FormData();
    formData.append('file', file); // Backend expects the file under the 'file' key

    const response = await api.post<TicketAttachment>(
    `/tickets/${ticketId}/attachments`,
    formData,
    {
        headers: {
        'Content-Type': 'multipart/form-data', // Important for file uploads
        },
        onUploadProgress, // Pass the progress callback to Axios
    }
    );
    return response.data;
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


//TODO --- Potentially add other ticket actions ---
// - updateTicketDetails (for subject, description, urgency etc.)
// - assignTicketToSelf
// - deleteTicket
