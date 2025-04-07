// User related types
export type UserRole = 'Staff' | 'Admin';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface UserCreate {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}

export interface UserUpdate {
  name?: string;
  email?: string;
  password?: string;
  role?: UserRole;
}

export interface UserLogin {
  email: string;
  password: string;
}

// Ticket related types
export type TicketStatus = 'Unassigned' | 'Assigned' | 'In Progress' | 'Closed';
export type TicketUrgency = 'Low' | 'Medium' | 'High' | 'Critical';

export interface Ticket {
  id: string;
  end_user_email: string;
  issue_type: string;
  urgency: TicketUrgency;
  subject: string;
  body: string;
  status: TicketStatus;
  assigned_to_user_id?: string;
  assigned_to_user?: User;
  created_at: string;
  updated_at: string;
  closed_at?: string;
  resolution_notes?: string;
  tags?: Tag[];
  updates?: TicketUpdate[];
  attachments?: Attachment[];
}

export interface TicketCreate {
  end_user_email: string;
  issue_type: string;
  urgency: TicketUrgency;
  subject: string;
  body: string;
  tags?: string[];
}

export interface TicketStatusUpdate {
  status: TicketStatus;
  assigned_to_user_id?: string;
  resolution_notes?: string;
}

export interface TicketUpdate {
  id: string;
  ticket_id: string;
  user_id?: string;
  user?: User;
  comment: string;
  is_internal_note: boolean;
  created_at: string;
}

export interface TicketUpdateCreate {
  comment: string;
  is_internal_note: boolean;
}

export interface TicketFilter {
  status?: TicketStatus;
  urgency?: TicketUrgency;
  assigned_to?: string;
  end_user_email?: string;
  from_date?: string;
  to_date?: string;
  tags?: string[];
  search?: string;
  page?: number;
  limit?: number;
}

// Task related types
export type TaskStatus = 'Open' | 'In Progress' | 'Completed';

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  assigned_to_user_id?: string;
  assigned_to_user