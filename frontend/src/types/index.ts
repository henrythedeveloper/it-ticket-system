export interface Ticket {
  id?: number;
  ticketNumber?: string;
  category: string;
  description: string;
  submitterEmail: string;
  status: 'open' | 'in_progress' | 'resolved';
  assignedTo?: number;
  solution?: string;
  resolvedBy?: number;
  resolvedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface TicketHistory {
  id: number;
  ticketId: number;
  action: string;
  userId: number;
  notes: string;
  createdAt: string;
}

export interface TicketSolution {
  id: number;
  title: string;
  description: string;
  category: string;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id?: number;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  status: 'todo' | 'in_progress' | 'done';
  createdBy: number;
  creator?: User;
  assignedTo?: number;
  assignedUser?: User;
  createdAt?: string;
  updatedAt?: string;
  history?: TaskHistory[];
}

export interface TaskHistory {
  id: number;
  taskId: number;
  action: string;
  userId: number;
  user?: User;
  notes: string;
  createdAt: string;
}

export interface User {
  id?: number;
  email: string;
  name: string;
  role: 'admin' | 'staff';
  createdAt?: string;
  updatedAt?: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials extends LoginCredentials {
  name: string;
}