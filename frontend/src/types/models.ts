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

// Tag related types
export interface Tag {
  id: string;
  name: string;
  created_at: string;
}

// Attachment related types
export interface Attachment {
  id: string;
  ticket_id: string; // Assuming attachments are only for tickets for now
  filename: string;
  storage_path: string;
  mime_type: string;
  size: number;
  uploaded_at: string;
  url?: string;
}

// Ticket related types
export type TicketStatus = 'Unassigned' | 'Assigned' | 'In Progress' | 'Closed';
export type TicketUrgency = 'Low' | 'Medium' | 'High' | 'Critical';

export interface TicketUpdate { // Renamed from TaskUpdate if you had that temporarily
  id: string;
  ticket_id?: string; // Made optional as it won't exist on task updates
  task_id?: string;   // Made optional as it won't exist on ticket updates
  user_id?: string;
  user?: User;
  comment: string;
  is_internal_note: boolean; 
  created_at: string;
}

// Use a more specific type for creation payload if needed, reusing for now
export interface TicketUpdateCreate {
  comment: string;
  is_internal_note?: boolean; // Optional on create
}


export interface Ticket {
  id: string;
  ticket_number: number;
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
  updates?: TicketUpdate[]; // Uses the TicketUpdate type
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

// --- Task related types ---
export type TaskStatus = 'Open' | 'In Progress' | 'Completed';

// --- NEW: TaskUpdate Type ---
export interface TaskUpdate {
  id: string;
  task_id: string; // Specific to tasks
  user_id?: string;
  user?: User;
  comment: string;
  // is_internal_note: boolean; // Add if needed for tasks
  created_at: string;
}

// --- NEW: TaskUpdateCreate Type ---
export interface TaskUpdateCreate {
  comment: string;
  // is_internal_note?: boolean; // Add if needed for tasks
}

export interface Task {
  id: string;
  task_number: number;
  title: string;
  description?: string;
  status: TaskStatus;
  assigned_to_user_id?: string;
  assigned_to_user?: User;
  created_by_user_id: string; // Changed from optional based on schema
  created_by_user?: User;
  due_date?: string;
  is_recurring: boolean; // Changed from optional based on schema
  recurrence_rule?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  // --- UPDATED: Use TaskUpdate type ---
  updates?: TaskUpdate[]; 
  // tags?: Tag[]; // Removed as tags aren't on tasks in schema
  // attachments?: Attachment[]; // Removed as attachments aren't on tasks in schema
}

export interface TaskCreate {
  title: string;
  description?: string;
  assigned_to_user_id?: string; // Renamed from AssignedToID to match frontend form
  due_date?: string; // Keep as string initially, convert before sending
  is_recurring: boolean;
  recurrence_rule?: string;
}

export interface TaskStatusUpdate {
  status: TaskStatus;
}


// FAQ related types
export interface FAQEntry {
  id: string;
  question: string;
  answer: string;
  category: string;
  created_at: string;
  updated_at: string;
}

// API Response types
export interface APIResponse<T> {
  success: boolean;
  message?: string;
  data?: T; // Data is optional
  error?: string;
}

