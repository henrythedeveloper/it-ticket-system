export interface Ticket {
  id?: number;
  category: string;
  description: string;
  submitterEmail: string;
  status: 'open' | 'in_progress' | 'resolved';
  assignedTo?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Task {
  id?: number;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  status: 'todo' | 'in_progress' | 'done';
  createdBy: number;
  assignedTo?: number;
  createdAt?: string;
  updatedAt?: string;
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