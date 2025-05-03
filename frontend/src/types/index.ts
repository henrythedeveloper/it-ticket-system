// src/types/index.ts
// ==========================================================================
// Centralized type definitions for the application.
// **SIMPLIFIED**: Removed task-related types to focus on ticket functionality.
// **REVISED**: Updated ticket status model to use Open/In Progress/Closed.
// ==========================================================================

import { ReactNode } from 'react';

// --- User & Auth ---
export interface User {
  id: string;
  name: string;
  email: string;
  role: 'Admin' | 'Staff' | 'User';
  createdAt: string;
  updatedAt: string;
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
  createdAt: string;
}

// --- Ticket ---
export type TicketStatus = 'Open' | 'In Progress' | 'Closed';
export type TicketUrgency = 'Low' | 'Medium' | 'High' | 'Critical';

export interface TicketUpdate {
  id: string;
  ticketId: string;
  comment: string;
  user?: Pick<User, 'id' | 'name'> | null;
  userId?: string | null;
  createdAt: string;
  isInternalNote?: boolean;
  isSystemUpdate?: boolean;
}

export interface TicketAttachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  url: string;
  uploadedAt: string;
  storagePath?: string;
}

export interface Ticket {
  id: string;
  ticketNumber: number;
  submitterName?: string | null;
  endUserEmail: string;
  subject: string;
  description: string;
  status: TicketStatus;
  urgency: TicketUrgency;
  issueType?: string;
  tags?: Tag[];
  submitter?: Pick<User, 'id' | 'name' | 'email'> | null;
  assignedToUserId?: string | null;
  assignedTo?: Pick<User, 'id' | 'name'> | null;
  createdAt: string;
  updatedAt: string;
  closedAt?: string | null;
  resolutionNotes?: string | null;
  updates?: TicketUpdate[];
  attachments?: TicketAttachment[];
  tagNames?: string;
}

// --- Ticket Context Types ---
export type TicketFilter = {
  status?: string;
  urgency?: string;
  assignedTo?: string;
  submitterId?: string;
  tags?: string[];
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  fromDate?: string;
  toDate?: string;
};

export type TicketStatusUpdate = {
  status: string;
  assignedToId?: string | null;
  resolutionNotes?: string;
};

export interface TicketContextType {
  tickets: Ticket[];
  currentTicket: Ticket | null;
  totalTickets: number;
  isLoading: boolean;
  error: string | null;
  filters: TicketFilter;
  notifications: Notification[];
  hasNewNotifications: boolean;
  markNotificationsAsRead: () => void;
  checkForNewNotifications: () => Promise<void>;
  fetchTickets: (newFilters?: Partial<TicketFilter>) => Promise<void>;
  fetchTicketById: (id: string) => Promise<Ticket | null>;
  updateTicket: (id: string, update: TicketStatusUpdate) => Promise<boolean>;
  refreshCurrentTicket: () => Promise<void>;
  setFilters: (newFilters: Partial<TicketFilter>) => void;
  clearError: () => void;
}

// --- Notification ---
export interface Notification {
  id: string;
  type: 'unassigned_ticket' | 'assigned_ticket' | 'comment' | 'status_change' | 'system';
  title: string;
  message: string;
  ticketId?: string;
  ticketNumber?: number;
  isRead: boolean;
  createdAt: string;
}

// Extended user type with notification count
export interface UserWithNotifications extends User {
  unreadNotifications?: number;
}

// --- Dashboard Stats ---
export interface DashboardStats {
  unassigned: number;
  assignedToMe: number;
  inProgress: number;
  myOpenTickets: number;
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
export type SingleTicketResponse = Ticket; // Often wrapped in APIResponse

// --- Forms ---
export interface LoginFormInputs { email: string; password?: string; }
export interface TicketCommentFormInputs { content: string; isInternalNote?: boolean; }
export interface TicketStatusFormInputs { status: TicketStatus; assignedToId?: string | null; resolutionNotes?: string; }

// --- UI Context ---
export interface ThemeState { theme: 'light' | 'dark'; }
export interface ThemeContextType extends ThemeState { toggleTheme: () => void; }
export interface SidebarState { isOpen: boolean; }
export interface SidebarContextType extends SidebarState { 
  toggleSidebar: () => void; 
  openSidebar: () => void; 
  closeSidebar: () => void; 
}
