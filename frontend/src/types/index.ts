// src/types/index.ts
// ==========================================================================
// Centralized type definitions for the application.
// Added ticket_number to Ticket interface.
// ==========================================================================

import { ReactNode } from 'react'; // Added for Context types

// --------------------------------------------------------------------------
// Authentication & User Types
// --------------------------------------------------------------------------

/**
 * Represents the structure of a user object.
 */
export interface User {
  id: string;
  name: string;
  email: string;
  role: 'Admin' | 'Staff' | 'User'; // Define specific roles
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
}

/**
 * Represents the authentication state, including the user and token.
 */
export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
}

/**
 * Represents the context value provided by AuthContext.
 */
export interface AuthContextType extends AuthState {
  login: (token: string, user: User) => void;
  logout: () => void;
  setUser: (user: User | null) => void;
  loading: boolean; // Indicates if auth state is being loaded/verified
}

// --------------------------------------------------------------------------
// Ticket Types
// --------------------------------------------------------------------------

/**
 * Represents the possible statuses for a ticket.
 */
export type TicketStatus = 'Unassigned' | 'Assigned' | 'In Progress' | 'Closed';

/**
 * Represents the possible urgency levels for a ticket.
 */
export type TicketUrgency = 'Low' | 'Medium' | 'High' | 'Critical';

/**
 * Represents a comment or update on a ticket.
 */
export interface TicketUpdate {
  id: string;
  ticketId: string; // Added ticketId for context
  content: string;
  author: Pick<User, 'id' | 'name'>; // Only need author's id and name
  createdAt: string; // ISO date string
  isSystemUpdate?: boolean; // Flag for system-generated updates (e.g., status change)
  isInternalNote?: boolean; // Flag for internal staff notes
}

/**
 * Represents a file attachment associated with a ticket.
 */
export interface TicketAttachment {
  id: string;
  filename: string;
  mimetype: string;
  size: number; // Size in bytes
  url: string; // URL to access/download the file
  createdAt: string; // ISO date string
}

/**
 * Represents the main structure of a ticket object.
 * Added ticket_number field.
 */
export interface Ticket {
  id: string;
  ticket_number: number; // FIX: Added ticket number field (maps to int32)
  subject: string;
  description: string;
  status: TicketStatus;
  urgency: TicketUrgency;
  issueType?: string; // Optional issue type/category
  tags?: string[]; // Optional tags
  submitter: Pick<User, 'id' | 'name' | 'email'>; // Submitter info
  assignedTo?: Pick<User, 'id' | 'name'> | null; // Assigned staff member
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
  closedAt?: string | null; // ISO date string when closed
  resolutionNotes?: string | null; // Notes added upon closing the ticket (nullable)
  updates?: TicketUpdate[]; // Array of comments/updates (potentially loaded separately)
  attachments?: TicketAttachment[]; // Array of attachments (potentially loaded separately)
}

// --------------------------------------------------------------------------
// Task Types
// --------------------------------------------------------------------------

/**
 * Represents the possible statuses for a task.
 */
export type TaskStatus = 'Open' | 'In Progress' | 'Completed';

/**
 * Represents the structure of a task object.
 */
export interface Task {
  id: string;
  title: string;
  description?: string; // Optional description
  status: TaskStatus;
  dueDate?: string | null; // Optional due date (ISO date string)
  assignedTo?: Pick<User, 'id' | 'name'> | null; // Assigned staff member
  ticketId?: string | null; // Optional associated ticket ID
  createdBy: Pick<User, 'id' | 'name'>; // User who created the task
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
  completedAt?: string | null; // ISO date string when completed
}

// --------------------------------------------------------------------------
// Settings Types (Consolidated)
// --------------------------------------------------------------------------

/**
 * Defines the structure for notification settings.
 */
export interface NotificationSettings {
    emailOnNewTicket: boolean;
    emailOnAssignment: boolean;
    emailOnUpdate: boolean;
}

/**
 * Defines the structure for ticket-related settings.
 */
export interface TicketSettings {
    defaultUrgency: 'Low' | 'Medium' | 'High';
    allowPublicSubmission: boolean;
    issueTypes: string[]; // List of available issue types/categories
}

/**
 * Defines the overall application settings structure.
 */
export interface AppSettings {
    notifications: NotificationSettings;
    tickets: TicketSettings;
    // Add other setting categories as needed
}


// --------------------------------------------------------------------------
// API Response Types (Examples)
// --------------------------------------------------------------------------

/**
 * Generic structure for paginated API responses.
 */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Example: Response structure for fetching tickets.
 */
export type TicketsResponse = PaginatedResponse<Ticket>;

/**
 * Example: Response structure for fetching a single ticket.
 */
export type SingleTicketResponse = Ticket; // Assuming full details are returned

// --------------------------------------------------------------------------
// UI State & Context Types
// --------------------------------------------------------------------------

/**
 * Represents the state for the theme context.
 */
export interface ThemeState {
  theme: 'light' | 'dark';
}

/**
 * Represents the context value provided by ThemeContext.
 */
export interface ThemeContextType extends ThemeState {
  toggleTheme: () => void;
}

/**
 * Represents the state for the sidebar context.
 */
export interface SidebarState {
  isOpen: boolean;
}

/**
 * Represents the context value provided by SidebarContext.
 */
export interface SidebarContextType extends SidebarState {
  toggleSidebar: () => void;
  openSidebar: () => void;
  closeSidebar: () => void;
}

// --------------------------------------------------------------------------
// Form Data Types (Examples)
// --------------------------------------------------------------------------

/**
 * Data structure for the login form.
 */
export interface LoginFormInputs {
  email: string;
  password?: string; // Optional if using passwordless or SSO in future
}

/**
 * Data structure for creating/editing a ticket.
 */
export interface TicketFormInputs {
  subject: string;
  description: string;
  urgency: TicketUrgency;
  issueType?: string;
  tags?: string[];
  // Submitter info usually comes from context or backend
  // Status and AssignedTo are typically handled separately
}

/**
 * Data structure for adding a comment/update to a ticket.
 */
export interface TicketCommentFormInputs {
  content: string;
  isInternalNote?: boolean;
}

/**
 * Data structure for updating ticket status/assignment.
 */
export interface TicketStatusFormInputs {
    status: TicketStatus;
    assignedToId?: string | null; // ID of the user to assign to
    resolutionNotes?: string; // Required if closing
}
