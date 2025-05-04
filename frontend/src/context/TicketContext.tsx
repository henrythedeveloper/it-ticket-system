// File: frontend/src/context/TicketContext.tsx
// ==========================================================================
// Provides ticket state and actions.
// **CONFIRMED**: loadFiltersData fetches users and tags from API.
// ==========================================================================

import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { Ticket, Notification, TicketFilter, TicketContextType, Tag, User } from '../types'; 
import { fetchTickets, fetchTicketById } from '../services/ticketService'; // Import necessary ticket functions
import { fetchTags } from '../services/tagService'; // Import from tag service
import { fetchUsers } from '../services/userService'; // Import user service

// Default filter state
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

// Create context with undefined initial value
const TicketContext = createContext<TicketContextType | undefined>(undefined);

// Context Provider Component
export const TicketProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // State variables
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [currentTicket, setCurrentTicket] = useState<Ticket | null>(null);
  const [totalTickets, setTotalTickets] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFiltersState] = useState<TicketFilter>(defaultFilters);
  const [notifications] = useState<Notification[]>([]); // Placeholder state
  const [hasNewNotifications] = useState(false); // Placeholder state
  const [assignableUsers, setAssignableUsers] = useState<Pick<User, 'id' | 'name'>[]>([]);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);

  // --- Callbacks ---

  // Set filters and reset page
  const setFilters = useCallback((newFilters: Partial<TicketFilter>) => {
    setFiltersState((prev: TicketFilter) => ({
      ...prev,
      ...newFilters,
      page: newFilters.page ?? 1 // Reset page if not explicitly set
    }));
  }, []);

  // Clear error state
  const clearError = useCallback(() => {
    console.log('[TicketContext] clearError called.');
    setError(null);
  }, []);

  /**
   * Fetches assignable users (Admin/Staff) and available tags from the API.
   * Updates the context state for assignableUsers and availableTags.
   */
  const loadFiltersData = useCallback(async () => {
      console.log("[TicketContext] Loading filter data (users and tags)...");
      try {
        // Fetch users and tags in parallel for efficiency
        const [usersResponse, tagsResponse] = await Promise.allSettled([
          fetchUsers({ role: 'Admin,Staff', limit: 500 }), // Fetch Admin and Staff roles
          fetchTags() // Fetch tags using the function from tagService
        ]);

        // Process users response
        if (usersResponse.status === 'fulfilled') {
          // Map the fetched user data to the simpler Pick<User, 'id' | 'name'> structure
          setAssignableUsers(usersResponse.value.data.map(u => ({ id: u.id, name: u.name })));
          console.log("[TicketContext] Assignable users loaded:", usersResponse.value.data.length);
        } else {
          // Log error if fetching users failed
          console.error("Failed to load assignable users:", usersResponse.reason);
          setAssignableUsers([]); // Set to empty array on error
        }

        // Process tags response
        if (tagsResponse.status === 'fulfilled') {
          // Set the fetched Tag objects directly into state
          setAvailableTags(tagsResponse.value);
          console.log("[TicketContext] Available tags loaded:", tagsResponse.value.length);
        } else {
          // Log error if fetching tags failed
          console.error("Failed to load available tags:", tagsResponse.reason);
          setAvailableTags([]); // Set to empty array on error
        }

      } catch (err) { // Catch potential errors from Promise.allSettled itself (unlikely)
          console.error("Unexpected error loading filter data:", err);
          // Reset state in case of unexpected errors
          setAssignableUsers([]);
          setAvailableTags([]);
      }
      // Note: No setIsLoading here, as this might be called independently of ticket loading
  }, []); // No dependencies needed, called explicitly or on mount

  // --- Effects ---
  // Load filter data (users, tags) when the component mounts
  useEffect(() => {
    loadFiltersData();
  }, [loadFiltersData]); // Run once on mount

  // --- Other Callbacks ---
  const fetchTicketsHandler = useCallback(async (newFilters?: Partial<TicketFilter>): Promise<void> => {
      setIsLoading(true);
      setError(null);
      try {
        const mergedFilters = { ...filters, ...newFilters };
        const response = await fetchTickets({
          ...mergedFilters,
          tags: mergedFilters.tags ? mergedFilters.tags.join(',') : undefined,
        });
        setTickets(response.data);
        setTotalTickets(response.total);
        setFiltersState(mergedFilters);
      } catch (err: any) {
        setError(err.response?.data?.message || err.message || 'Failed to fetch tickets');
        setTickets([]);
        setTotalTickets(0);
      } finally {
        setIsLoading(false);
      }
  }, [filters]);

  const fetchTicketByIdHandler = useCallback(async (id: string): Promise<Ticket | null> => {
      setIsLoading(true);
      setError(null);
      try {
        const ticket = await fetchTicketById(id);
        setCurrentTicket(ticket);
        return ticket;
      } catch (err: any) {
        setError(err.response?.data?.message || err.message || 'Failed to fetch ticket');
        setCurrentTicket(null);
        return null;
      } finally {
        setIsLoading(false);
      }
  }, []);

  const updateTicketState = useCallback((updatedTicketData: Ticket): boolean => {
      console.log("Updating local ticket state:", updatedTicketData);
      // Update currentTicket and tickets list state...
      return true; // Placeholder
  }, []);

  const refreshCurrentTicketHandler = useCallback(async (): Promise<void> => {
      console.log("Refreshing current ticket...");
      if (currentTicket) {
          await fetchTicketByIdHandler(currentTicket.id);
      }
  }, [currentTicket, fetchTicketByIdHandler]);

  const markNotificationsAsReadHandler = useCallback(() => {
      console.log("Marking notifications as read...");
      // Update notification state...
  }, []);

  const checkForNewNotificationsHandler = useCallback(async (): Promise<void> => {
      console.log("Checking for new notifications...");
      // Fetch notifications...
  }, []);


  // --- Context Value ---
  // Assemble the context value object provided to consumers
  const contextValue: TicketContextType = {
    tickets,
    currentTicket,
    totalTickets,
    isLoading,
    error,
    filters,
    notifications,
    hasNewNotifications,
    assignableUsers, // Provide the loaded users
    availableTags,   // Provide the loaded tags
    markNotificationsAsRead: markNotificationsAsReadHandler,
    checkForNewNotifications: checkForNewNotificationsHandler,
    fetchTickets: fetchTicketsHandler,
    fetchTicketById: fetchTicketByIdHandler,
    updateTicket: updateTicketState,
    refreshCurrentTicket: refreshCurrentTicketHandler,
    setFilters,
    clearError,
    loadFiltersData // Expose the function if needed by consumers
  };

  // Provide the context value to children components
  return (
    <TicketContext.Provider value={contextValue}>
      {children}
    </TicketContext.Provider>
  );
};

// --- Custom Hook ---
// Hook to easily consume the TicketContext in components
export const useTickets = (): TicketContextType => {
  const context = useContext(TicketContext);
  if (context === undefined) {
    // Ensure the hook is used within the provider tree
    throw new Error('useTickets must be used within a TicketProvider');
  }
  return context;
};
