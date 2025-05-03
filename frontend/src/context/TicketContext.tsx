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

const TicketContext = createContext<TicketContextType | undefined>(undefined);

export const TicketProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [currentTicket, setCurrentTicket] = useState<Ticket | null>(null);
  const [totalTickets, setTotalTickets] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFiltersState] = useState<TicketFilter>(defaultFilters);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [hasNewNotifications, setHasNewNotifications] = useState(false);

  const setFilters = useCallback((newFilters: Partial<TicketFilter>) => {
    setFiltersState((prev: TicketFilter) => ({
      ...prev,
      ...newFilters,
      page: 'page' in newFilters ? newFilters.page ?? 1 : 1
    }));
  }, []);

  const clearError = useCallback(() => {
    console.log('[TicketContext] clearError called.');
    setError(null);
  }, []);

  const markNotificationsAsRead = useCallback(() => {
    setHasNewNotifications(false);
    setNotifications(prev =>
      prev.map(notification => ({ ...notification, isRead: true }))
    );
  }, []);

  const checkForNewNotifications = useCallback(async (): Promise<void> => {
    if (!user) return;
    try {
      const tickets = await fetchTickets({ limit: 5, sortBy: 'updated_at', sortOrder: 'desc', assigned_to: user.id });
      const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const newTicketNotifications = tickets.data.filter((ticket: Ticket) => new Date(ticket.updatedAt) > hourAgo)
        .map((ticket: Ticket): Notification => ({ id: `ticket-${ticket.id}-${Date.now()}`, type: 'status_change', title: ticket.subject, message: `Ticket #${ticket.ticketNumber}: ${ticket.subject} was updated`, isRead: false, createdAt: new Date().toISOString(), ticketId: ticket.id }));
      if (newTicketNotifications.length > 0) {
        setNotifications(prev => [...newTicketNotifications, ...prev].slice(0, 20));
        setHasNewNotifications(true);
      }
    } catch (err) {
      console.error('[TicketContext] Error checking for notifications:', err);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      checkForNewNotifications();
      const intervalId = setInterval(() => { checkForNewNotifications(); }, 60000);
      return () => clearInterval(intervalId);
    }
  }, [user, checkForNewNotifications]);

  const fetchTicketsHandler = useCallback(async (newFilters?: Partial<TicketFilter>): Promise<void> => {
    console.log('[TicketContext] fetchTicketsHandler called with newFilters:', newFilters);
    try {
      console.log('[TicketContext] fetchTicketsHandler: Setting loading=true');
      setIsLoading(true);
      setError(null);
      const updatedFilters = newFilters ? { ...filters, ...newFilters } : filters;
      const apiFilters = { ...updatedFilters, tags: Array.isArray(updatedFilters.tags) ? updatedFilters.tags.join(',') : updatedFilters.tags };
      console.log('[TicketContext] fetchTicketsHandler: Calling service.fetchTickets with filters:', apiFilters);
      const ticketsData = await fetchTickets(apiFilters);
      console.log('[TicketContext] fetchTicketsHandler: Service call successful. Response total:', ticketsData.total);
      setTickets(ticketsData.data.map((t: any) => ({ ...t, ticketNumber: t.ticketNumber ?? t.ticket_number ?? '—', submitterName: t.submitterName ?? t.submitter_name ?? '—', updatedAt: t.updatedAt ?? t.updated_at ?? '—' })));
      setTotalTickets(ticketsData.total); // Use response total
      if (newFilters) setFiltersState(updatedFilters);
    } catch (err: any) {
      const errorMsg = err.message || 'Error fetching tickets. Please try again.';
      console.error('[TicketContext] ERROR in fetchTicketsHandler:', err);
      setError(errorMsg);
    } finally {
      console.log('[TicketContext] fetchTicketsHandler: Setting loading=false');
      setIsLoading(false);
    }
  }, [filters]); // Dependency on filters

  const fetchTicketByIdHandler = useCallback(async (id: string): Promise<Ticket | null> => {
    console.log(`[TicketContext] fetchTicketByIdHandler called with ID: ${id}`);
    if (!id) {
        console.warn('[TicketContext] fetchTicketByIdHandler called with invalid ID.');
        setError("Invalid ticket ID requested.");
        return null;
    }
    try {
      console.log('[TicketContext] fetchTicketByIdHandler: Setting loading=true');
      setIsLoading(true);
      setError(null); // Clear previous errors specific to single fetch
      setCurrentTicket(null); // Clear previous ticket before fetching new one
      console.log(`[TicketContext] fetchTicketByIdHandler: Calling service.fetchTicketById(${id})`);
      const ticket = await fetchTicketById(id); // Service call
      console.log('[TicketContext] fetchTicketByIdHandler: Service call successful. Result:', ticket);
      console.log('[TicketContext] fetchTicketByIdHandler: Setting currentTicket.');
      setCurrentTicket(ticket); // Set state
      return ticket;
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || err.message || 'Error fetching ticket details. Please try again.';
      console.error('[TicketContext] ERROR in fetchTicketByIdHandler:', err);
      setError(errorMsg); // Set error state
      setCurrentTicket(null); // Ensure current ticket is null on error
      return null;
    } finally {
      console.log('[TicketContext] fetchTicketByIdHandler: Setting loading=false');
      setIsLoading(false); // Set loading false in finally
    }
  }, []); // No dependencies needed if it doesn't rely on context state directly

  const updateTicket = useCallback(async (id: string, update: TicketStatusUpdate): Promise<boolean> => {
    console.log(`[TicketContext] updateTicket called for ID: ${id} with update:`, update);
    try {
      console.log('[TicketContext] updateTicket: Setting loading=true');
      setIsLoading(true);
      setError(null);
      const updatedTicket = await updateTicketStatus(id, { ...update, status: update.status as any });
      console.log('[TicketContext] updateTicket: Service call successful. Updated Ticket:', updatedTicket);

      // Update currentTicket if it matches
      if (currentTicket && currentTicket.id === id) {
        console.log('[TicketContext] updateTicket: Updating currentTicket state.');
        setCurrentTicket(updatedTicket);
      }
      // Update the ticket in the main list
      setTickets(prev => prev.map((t: Ticket) => (t.id === id ? updatedTicket : t)));
      return true;
    } catch (err: any) {
      const errorMsg = err.message || 'Error updating ticket. Please try again.';
      console.error('[TicketContext] ERROR in updateTicket:', err);
      setError(errorMsg);
      return false;
    } finally {
      console.log('[TicketContext] updateTicket: Setting loading=false');
      setIsLoading(false);
    }
  }, [currentTicket]); // Depend on currentTicket to update it correctly

  const refreshCurrentTicket = useCallback(async (): Promise<void> => {
    console.log('[TicketContext] refreshCurrentTicket called.');
    if (currentTicket) {
      console.log(`[TicketContext] Refreshing data for current ticket ID: ${currentTicket.id}`);
      // Use fetchTicketByIdHandler which already handles loading and error states
      await fetchTicketByIdHandler(currentTicket.id);
    } else {
        console.warn('[TicketContext] refreshCurrentTicket called but no current ticket is set.');
    }
  }, [currentTicket, fetchTicketByIdHandler]); // Depend on currentTicket and the fetch handler

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

export const useTickets = (): TicketContextType => {
  const context = useContext(TicketContext);
  if (context === undefined) {
    throw new Error('useTickets must be used within a TicketProvider');
  }
  return context;
};