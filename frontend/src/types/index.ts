export interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'staff';
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
  role: 'admin' | 'staff';
}

export interface Task {
  id: number;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  status: 'todo' | 'in_progress' | 'done';
  createdBy: number;
  creator: User;
  assignedTo?: number | null;
  assignedUser?: User;
  dueDate?: string | null;
  recurringTaskId?: number | null;
  recurringTask?: RecurringTask;
  history?: TaskHistory[];
  createdAt: string;
  updatedAt: string;
}

export interface RecurringTask {
  id: number;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  frequency: 'daily' | 'weekly' | 'monthly';
  nextRun: string;
  assignedTo?: number | null;
  createdBy: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TaskHistory {
  id: number;
  taskId: number;
  action: string;
  userId: number;
  user: User;
  notes: string;
  createdAt: string;
}

export interface Ticket {
  id: number;
  ticketNumber: string;
  category: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved';
  submitterEmail: string;
  assignedTo?: number | null;
  assignedUser?: User;
  solution?: string | null;
  resolvedBy?: number | null;
  resolvedUser?: User;
  resolvedAt?: string | null;
  urgency: 'low' | 'normal' | 'high' | 'critical';
  dueDate?: string | null;
  history?: TicketHistory[];
  solutions?: Solution[];
  createdAt: string;
  updatedAt: string;
}

export interface TicketHistory {
  id: number;
  ticketId: number;
  action: string;
  userId?: number;
  user?: User;
  notes: string;
  createdAt: string;
}

export interface Solution {
  id: number;
  title: string;
  description: string;
  category: string;
  previouslyUsed?: boolean;
  tickets?: Ticket[];
  createdAt: string;
  updatedAt: string;
}

export type Theme = {
  colors: {
    primaryBlue: string;
    secondaryGray: string;
    successGreen: string;
    warningYellow: string;
    errorRed: string;
    background: string;
    surfaceLight: string;
    divider: string;
  };
  typography: {
    subtle: string;
    medium: string;
    large: string;
    strong: string;
  };
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
  };
  shadows: {
    sm: string;
    md: string;
    lg: string;
  };
  borderRadius: {
    sm: number;
    md: number;
    lg: number;
  };
};

export type Nullable<T> = T | null;

export const isTicket = (item: Task | Ticket): item is Ticket => {
  return 'ticketNumber' in item;
};