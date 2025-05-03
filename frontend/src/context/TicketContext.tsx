import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { Ticket, Notification, TicketFilter, TicketStatusUpdate, TicketContextType } from '../types';
import { fetchTickets, fetchTicketById, updateTicketStatus } from '../services/ticketService';
import { useAuth } from '../hooks/useAuth';

const defaultFilters: TicketFilter = {
  status: undefined,
  urgency: undefined,
  assignedTo: undefined,
  submitterId: undefined,
  tags: [],
  search: '',
  page: 1,
  limit: 15,
  sortBy: 'updated_at',
  sortOrder: 'desc',
  fromDate: undefined,
  toDate: undefined,
};

// Create the context with a default undefined value
const TicketContext = createContext<TicketContextType | undefined>(undefined);

// Provider component that wraps the app or section that needs ticket data
export const TicketProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [currentTicket, setCurrentTicket] = useState<Ticket | null>(null);
  const [totalTickets, setTotalTickets] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFiltersState] = useState<TicketFilter>(defaultFilters);
  
  // Notification state
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [hasNewNotifications, setHasNewNotifications] = useState(false);

  // Set filters (partial update)
  const setFilters = useCallback((newFilters: Partial<TicketFilter>) => {
    setFiltersState((prev: TicketFilter) => ({
      ...prev,
      ...newFilters,
      page: 'page' in newFilters ? newFilters.page ?? 1 : 1
    }));
  }, []);

  // Clear any error messages
  const clearError = useCallback(() => setError(null), []);

  // Mark all notifications as read
  const markNotificationsAsRead = useCallback(() => {
    setHasNewNotifications(false);
    setNotifications(prev => 
      prev.map(notification => ({ ...notification, isRead: true }))
    );
    // In a real app, you would also call an API to update the read status on the server
  }, []);

  // Check for new notifications
  const checkForNewNotifications = useCallback(async (): Promise<void> => {
    if (!user) return;
    try {
      const tickets = await fetchTickets({
        limit: 5,
        sortBy: 'updated_at',
        sortOrder: 'desc',
        assigned_to: user.id // FIX: use assigned_to
      });
      const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const newTicketNotifications = tickets.data.filter((ticket: Ticket) => new Date(ticket.updatedAt) > hourAgo)
        .map((ticket: Ticket): Notification => ({
          id: `ticket-${ticket.id}-${Date.now()}`,
          type: 'status_change',
          title: ticket.subject, // FIX: add title
          message: `Ticket #${ticket.ticketNumber}: ${ticket.subject} was updated`,
          isRead: false,
          createdAt: new Date().toISOString(),
          ticketId: ticket.id
        }));
      if (newTicketNotifications.length > 0) {
        setNotifications(prev => [...newTicketNotifications, ...prev].slice(0, 20));
        setHasNewNotifications(true);
      }
    } catch (err) {
      console.error('Error checking for notifications:', err);
    }
  }, [user]);

  // Initial fetch of notifications and set up polling
  useEffect(() => {
    if (user) {
      checkForNewNotifications();
      
      // Poll for new notifications
      const intervalId = setInterval(() => {
        checkForNewNotifications();
      }, 60000); // Check every minute
      
      return () => clearInterval(intervalId);
    }
  }, [user, checkForNewNotifications]);

  // Fetch tickets with current filters
  const fetchTicketsHandler = useCallback(async (newFilters?: Partial<TicketFilter>): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);
      const updatedFilters = newFilters ? { ...filters, ...newFilters } : filters;
      // Convert tags array to comma-separated string for API
      const apiFilters = {
        ...updatedFilters,
        tags: Array.isArray(updatedFilters.tags) ? updatedFilters.tags.join(',') : updatedFilters.tags
      };
      const tickets = await fetchTickets(apiFilters);
      setTickets(tickets.data.map((t: any) => ({
        ...t,
        // Fallback for both camelCase and snake_case keys
        ticketNumber: t.ticketNumber ?? t.ticket_number ?? '—',
        submitterName: t.submitterName ?? t.submitter_name ?? '—',
        updatedAt: t.updatedAt ?? t.updated_at ?? '—',
      })));
      setTotalTickets(tickets.data.length); // FIX: use tickets.data.length
      if (newFilters) setFiltersState(updatedFilters);
    } catch (err) {
      setError('Error fetching tickets. Please try again.');
      console.error('Error fetching tickets:', err);
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  // Fetch a single ticket by ID
  const fetchTicketByIdHandler = useCallback(async (id: string): Promise<Ticket | null> => {
    try {
      setIsLoading(true);
      setError(null);
      const ticket = await fetchTicketById(id);
      setCurrentTicket(ticket);
      return ticket;
    } catch (err) {
      setError('Error fetching ticket details. Please try again.');
      console.error('Error fetching ticket details:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Update ticket status or assignment
  const updateTicket = useCallback(async (id: string, update: TicketStatusUpdate): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);
      const ticket = await updateTicketStatus(id, {
        ...update,
        status: update.status as any // FIX: cast to TicketStatus if needed
      });
      if (currentTicket && currentTicket.id === id) {
        setCurrentTicket(ticket);
      }
      setTickets(prev => prev.map((t: Ticket) => t.id === id ? ticket : t));
      return true;
    } catch (err) {
      setError('Error updating ticket. Please try again.');
      console.error('Error updating ticket:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [currentTicket]);

  // Refresh the current ticket data
  const refreshCurrentTicket = useCallback(async (): Promise<void> => {
    if (currentTicket) {
      await fetchTicketByIdHandler(currentTicket.id);
    }
  }, [currentTicket, fetchTicketByIdHandler]);

  // Create the context value object
  const value: TicketContextType = {
    tickets,
    currentTicket,
    totalTickets,
    isLoading,
    error,
    filters,
    notifications,
    hasNewNotifications,
    markNotificationsAsRead,
    checkForNewNotifications,
    fetchTickets: fetchTicketsHandler,
    fetchTicketById: fetchTicketByIdHandler,
    updateTicket,
    refreshCurrentTicket,
    setFilters,
    clearError
  };

  return (
    <TicketContext.Provider value={value}>
      {children}
    </TicketContext.Provider>
  );
};

// Custom hook to use the ticket context
export const useTickets = (): TicketContextType => {
  const context = useContext(TicketContext);
  if (context === undefined) {
    throw new Error('useTickets must be used within a TicketProvider');
  }
  return context;
};