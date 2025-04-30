// src/types/index.ts
// ==========================================================================
// Centralized type definitions for the application.
// **REVISED**: Added is_system_update to TicketUpdate interface.
// ==========================================================================

import { ReactNode } from 'react';

// --- User & Auth ---
export interface User {
  id: string;
  name: string;
  email: string;
  role: 'Admin' | 'Staff' | 'User';
  created_at: string;
  updated_at: string;
}
export interface AuthState {
  user: User | null;
  token: string | null;
}
export interface AuthContextType extends Omit<AuthState, 'isAuthenticated'> {
  login: (token: string, user: User) => void;
  logout: () => void;
  setUser: (user: User | null) => void;
  loading: boolean;
  isAuthenticated: boolean;
}

// --- Tag ---
export interface Tag {
  id: string;
  name: string;
  created_at: string;
}

// --- Ticket ---
export type TicketStatus = 'Unassigned' | 'Assigned' | 'In Progress' | 'Closed';
export type TicketUrgency = 'Low' | 'Medium' | 'High' | 'Critical';

export interface TicketUpdate {
  id: string;
  ticket_id: string;
  content: string; // Changed from comment for consistency? Check backend model. Assume content based on error.
  author?: Pick<User, 'id' | 'name'> | null; // Keep camelCase for nested user object?
  user_id?: string | null;
  created_at: string;
  is_internal_note?: boolean; // Use snake_case
  is_system_update?: boolean; // <-- Added this field
}

export interface TicketAttachment {
  id: string;
  filename: string;
  mime_type: string;
  size: number;
  url: string;
  uploaded_at: string;
  storage_path?: string;
}

export interface Ticket {
  id: string;
  ticket_number: number;
  subject: string;
  description: string;
  status: TicketStatus;
  urgency: TicketUrgency;
  issue_type?: string;
  tags?: Tag[];
  submitter_email: string;
  submitter?: Pick<User, 'id' | 'name' | 'email'> | null;
  assigned_to_user_id?: string | null;
  assignedTo?: Pick<User, 'id' | 'name'> | null;
  created_at: string;
  updated_at: string;
  closed_at?: string | null;
  resolution_notes?: string | null;
  updates?: TicketUpdate[];
  attachments?: TicketAttachment[];
}

// --- Task ---
export type TaskStatus = 'Open' | 'In Progress' | 'Completed';

// Added TaskUpdate interface
export interface TaskUpdate {
  id: string;
  task_id: string;
  user_id?: string | null;
  author?: Pick<User, 'id' | 'name'> | null; // Keep camelCase for nested user?
  comment: string; // Task updates might use 'comment' field? Check backend
  created_at: string;
}


export interface Task {
  id: string;
  task_number: number;
  title: string;
  description?: string;
  status: TaskStatus;
  due_date?: string | null;
  assigned_to_user_id?: string | null;
  assignedTo?: Pick<User, 'id' | 'name'> | null;
  task_id?: string | null;
  created_by_user_id?: string;
  createdBy?: Pick<User, 'id' | 'name'> | null;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
  is_recurring?: boolean;
  recurrence_rule?: string | null;
  updates?: TaskUpdate[]; // Use TaskUpdate type
}

// --- Settings ---
export interface NotificationSettings {
    emailOnNewTicket: boolean;
    emailOnAssignment: boolean;
    emailOnUpdate: boolean;
}
export interface TicketSettings {
    defaultUrgency: 'Low' | 'Medium' | 'High';
    allowPublicSubmission: boolean;
    issueTypes: string[];
}
export interface AppSettings {
    notifications: NotificationSettings;
    tickets: TicketSettings;
}

// --- API Responses ---
export interface APIResponse<T> {
	success: boolean;
	message?: string;
	data?: T;
	error?: string;
}
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
  hasMore?: boolean;
}
export type TicketsResponse = PaginatedResponse<Ticket>;
export type SingleTicketResponse = Ticket;

// --- Forms ---
export interface LoginFormInputs { email: string; password?: string; }
export interface TicketFormInputs { subject: string; description: string; urgency: TicketUrgency; issueType?: string; tags?: string[]; }
export interface TicketCommentFormInputs { content: string; isInternalNote?: boolean; }
export interface TicketStatusFormInputs { status: TicketStatus; assignedToId?: string | null; resolutionNotes?: string; }

// --- UI Context ---
export interface ThemeState { theme: 'light' | 'dark'; }
export interface ThemeContextType extends ThemeState { toggleTheme: () => void; }
export interface SidebarState { isOpen: boolean; }
export interface SidebarContextType extends SidebarState { toggleSidebar: () => void; openSidebar: () => void; closeSidebar: () => void; }

