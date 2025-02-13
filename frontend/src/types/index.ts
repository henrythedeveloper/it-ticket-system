export interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'user';
  createdAt: string;
  updatedAt: string;
}

export interface Ticket {
  id: number;
  ticketNumber: string;
  category: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved';
  urgency: 'low' | 'normal' | 'high' | 'critical';
  createdBy: number;
  assignedTo: number | null;
  submitterEmail: string;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  assignedUser?: User;
  type?: 'ticket';
}

export interface Task {
  id: number;
  title: string;
  description: string;
  status: 'todo' | 'in_progress' | 'done';
  priority: 'low' | 'medium' | 'high';
  createdBy: number;
  assignedTo: number | null;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  assignedUser?: User;
  recurrenceType: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
  recurrenceInterval: number;
  recurrenceEndDate: string | null;
  parentTaskId?: number | null;
  nextOccurrence?: string | null;
  type?: 'task';
}

export interface TicketHistory {
  id: number;
  ticketId: number;
  updatedBy: number;
  status: string;
  comment: string;
  createdAt: string;
  updatedByUser?: User;
}

export interface Solution {
  id: number;
  title: string;
  description: string;
  category: string;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  name: string;
  email: string;
  password: string;
}

// Type guard functions
export const isTicket = (item: Ticket | Task): item is Ticket => {
  return (item as Ticket).ticketNumber !== undefined;
};

export const isTask = (item: Ticket | Task): item is Task => {
  return (item as Task).title !== undefined;
};