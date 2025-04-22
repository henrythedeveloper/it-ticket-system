// src/pages/dashboard/TicketsPage.tsx
// ==========================================================================
// Component representing the page for listing and managing support tickets.
// Includes filtering, search, tag filtering, and a table of tickets.
// Fixed type errors.
// ==========================================================================

import React, { useState, useEffect, useMemo, useCallback } from 'react';
// FIX: Import useNavigate
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import Loader from '../../components/common/Loader';
import Alert from '../../components/common/Alert';
import Button from '../../components/common/Button';
import Table, { TableColumn } from '../../components/common/Table';
import Badge from '../../components/common/Badge';
import Pagination from '../../components/common/Pagination';
import { useAuth } from '../../hooks/useAuth'; // For default filters
import { fetchTickets } from '../../services/ticketService'; // Ticket API
import { fetchUsers } from '../../services/userService'; // User API for assignee filter
import { Ticket, User, TicketStatus, TicketUrgency } from '../../types'; // Import types
import { formatDate } from '../../utils/helpers'; // Date formatting
import { PlusCircle, Search, X } from 'lucide-react'; // Icons

// --- Constants ---
const DEFAULT_LIMIT = 15; // Number of tickets per page

// --- Component ---

/**
 * Renders the Tickets list page with filtering, search, pagination, and table display.
 */
const TicketsPage: React.FC = () => {
  // --- Hooks ---
  const { user } = useAuth(); // Get current user for 'Assigned to Me' filter
  const [searchParams, setSearchParams] = useSearchParams(); // Manage URL query params
  const navigate = useNavigate(); // FIX: Initialize useNavigate

  // --- State ---
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [assignableUsers, setAssignableUsers] = useState<Pick<User, 'id' | 'name'>[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]); // TODO: Fetch tags from API if dynamic
  const [totalTickets, setTotalTickets] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // --- Filtering/Pagination State (derived from URL search params) ---
  const currentPage = useMemo(() => parseInt(searchParams.get('page') || '1', 10), [searchParams]);
  const currentStatus = useMemo(() => searchParams.get('status') || '', [searchParams]);
  const currentUrgency = useMemo(() => searchParams.get('urgency') || '', [searchParams]);
  const currentAssignee = useMemo(() => searchParams.get('assigneeId') || '', [searchParams]);
  const currentSearch = useMemo(() => searchParams.get('search') || '', [searchParams]);
  const currentTags = useMemo(() => searchParams.get('tags')?.split(',') || [], [searchParams]);
  // Add state for sorting if needed

  // --- Data Fetching ---
  /**
   * Fetches tickets based on current filter/pagination state derived from URL params.
   */
  const loadTickets = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    console.log(`Fetching tickets: Page=${currentPage}, Status=${currentStatus}, Urgency=${currentUrgency}, Assignee=${currentAssignee}, Search=${currentSearch}, Tags=${currentTags.join(',')}`);

    try {
      const params: any = { // Use 'any' temporarily or define specific FetchTicketsParams type
        page: currentPage,
        limit: DEFAULT_LIMIT,
        status: currentStatus || undefined,
        urgency: currentUrgency || undefined,
        assigneeId: currentAssignee || undefined,
        search: currentSearch || undefined,
        tags: currentTags.length > 0 ? currentTags.join(',') : undefined,
        sortBy: 'updatedAt', // Default sort
        sortOrder: 'desc',
      };
      // Handle special 'me' value for assigneeId
      if (params.assigneeId === 'me' && user) {
          params.assigneeId = user.id;
      } else if (params.assigneeId === 'me') {
          params.assigneeId = undefined; // Cannot filter by 'me' if not logged in
      }

      const response = await fetchTickets(params);
      setTickets(response.data);
      setTotalTickets(response.total);
      setTotalPages(response.totalPages);
    } catch (err: any) {
      console.error("Failed to load tickets:", err);
      setError(err.response?.data?.message || err.message || 'Could not load tickets.');
      setTickets([]); setTotalTickets(0); setTotalPages(1); // Reset state on error
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, currentStatus, currentUrgency, currentAssignee, currentSearch, currentTags, user]); // Include user in dependencies

  /**
   * Fetches users for the assignee filter dropdown and potentially available tags.
   */
  const loadFiltersData = useCallback(async () => {
      try {
        // Fetch users (Staff/Admin)
        const usersData = await fetchUsers({ role: 'Admin,Staff', limit: 500 });
        setAssignableUsers(usersData.data.map(u => ({ id: u.id, name: u.name })));
        // TODO: Fetch available tags from an API endpoint if they are dynamic
        // const tagsData = await fetchTags();
        // setAvailableTags(tagsData);
        setAvailableTags(['bug', 'feature', 'urgent', 'billing', 'account', 'ui', 'backend']); // Mock tags
      } catch (err) {
          console.error("Failed to load filter data:", err);
          // Handle error (e.g., show partial filters)
      }
  }, []);

  // --- Effects ---
  // Fetch tickets when filter/pagination params change
  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  // Fetch filter data on initial mount
  useEffect(() => {
    loadFiltersData();
  }, [loadFiltersData]);

  // --- Handlers ---
  /**
   * Updates URL search parameters based on filter changes.
   */
  const handleFilterChange = (param: string, value: string) => {
    setSearchParams(prevParams => {
      const newParams = new URLSearchParams(prevParams);
      if (value) { newParams.set(param, value); }
      else { newParams.delete(param); }
      newParams.set('page', '1'); // Reset page on filter change
      return newParams;
    }, { replace: true });
  };

  /**
   * Handles search input changes.
   */
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      handleFilterChange('search', e.target.value);
      // TODO: Add debounce if needed
  };

  /**
   * Handles tag selection/deselection for filtering.
   */
  const handleTagToggle = (tag: string) => {
      const newTags = currentTags.includes(tag)
          ? currentTags.filter(t => t !== tag)
          : [...currentTags, tag];
      handleFilterChange('tags', newTags.join(',')); // Update 'tags' param
  };

  /**
   * Clears all active filters.
   */
  const handleClearFilters = () => {
    setSearchParams({ page: '1' });
  };

  /**
   * Handles page changes from Pagination component.
   */
  const handlePageChange = (newPage: number) => {
      setSearchParams(prevParams => {
        const newParams = new URLSearchParams(prevParams);
        newParams.set('page', newPage.toString());
        return newParams;
    }, { replace: true });
      window.scrollTo(0, 0); // Scroll to top
  };

  // --- Options for Filters ---
  const statusOptions: { value: TicketStatus | ''; label: string }[] = [
    { value: '', label: 'All Statuses' }, { value: 'Unassigned', label: 'Unassigned' },
    { value: 'Assigned', label: 'Assigned' }, { value: 'In Progress', label: 'In Progress' },
    { value: 'Closed', label: 'Closed' },
  ];
  const urgencyOptions: { value: TicketUrgency | ''; label: string }[] = [
    { value: '', label: 'All Urgencies' }, { value: 'Low', label: 'Low' },
    { value: 'Medium', label: 'Medium' }, { value: 'High', label: 'High' },
    { value: 'Critical', label: 'Critical' },
  ];
  const assigneeOptions = [
    { value: '', label: 'All Assignees' },
    { value: 'unassigned', label: 'Unassigned' }, // Specific value for unassigned
    ...(user ? [{ value: 'me', label: 'Assigned to Me' }] : []), // Special 'me' value
    ...assignableUsers.map(u => ({ value: u.id, label: u.name })),
  ];

  // --- Table Columns ---
  const ticketColumns: TableColumn<Ticket>[] = [
    { key: 'id', header: '#', render: (item) => <Link to={`/tickets/${item.id}`}>{item.id.substring(0, 6)}</Link> },
    { key: 'subject', header: 'Subject', render: (item) => <Link to={`/tickets/${item.id}`}>{item.subject}</Link>, cellClassName: 'subject-cell' },
    { key: 'status', header: 'Status', render: (item) => <Badge type={item.status.toLowerCase() as any}>{item.status}</Badge> },
    { key: 'urgency', header: 'Urgency', render: (item) => <Badge type={item.urgency.toLowerCase() as any}>{item.urgency}</Badge> },
    { key: 'createdAt', header: 'Created', render: (item) => formatDate(item.createdAt) },
    { key: 'submitter', header: 'Submitter', render: (item) => item.submitter.name },
    { key: 'assignedTo', header: 'Assignee', render: (item) => item.assignedTo?.name || '-' },
    { key: 'tags', header: 'Tags', render: (item) => (
        item.tags && item.tags.length > 0
          ? <div className='table-tags'>{item.tags.map(tag => <span key={tag} className='table-tag'>{tag}</span>)}</div>
          : <span className='no-tags'>-</span>
      ), cellClassName: 'tags-cell'
    },
    { key: 'updatedAt', header: 'Last Update', render: (item) => formatDate(item.updatedAt) },
  ];

  // Determine if any filters are active
  const filtersActive = !!currentStatus || !!currentUrgency || !!currentAssignee || !!currentSearch || currentTags.length > 0;

  // --- Render ---
  return (
    <div className="tickets-page">
      {/* Page Header */}
      <div className="page-header">
        <h1>Manage Tickets</h1>
          {/* Optional: Add Create Ticket button if needed in dashboard */}
          {/* <div className="header-actions">
            <Link to="/tickets/new">
              <Button variant="primary" leftIcon={<PlusCircle size={18} />}>New Ticket</Button>
            </Link>
          </div> */}
      </div>

      {/* Filter Section */}
      <section className="filter-section">
          {/* Search Form */}
          <form onSubmit={(e) => e.preventDefault()} className="search-form">
              <input type="search" placeholder="Search by subject, description, ID..." value={currentSearch} onChange={handleSearchChange} className="search-input" aria-label="Search tickets" />
              <Button type="submit" variant="primary" aria-label="Search"><Search size={20}/></Button>
          </form>
          {/* Dropdown Filters */}
          <div className="filters">
              <div className="filter-group"><label htmlFor="status-filter">Status:</label><select id="status-filter" value={currentStatus} onChange={(e) => handleFilterChange('status', e.target.value)} className="filter-select">{statusOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select></div>
              <div className="filter-group"><label htmlFor="urgency-filter">Urgency:</label><select id="urgency-filter" value={currentUrgency} onChange={(e) => handleFilterChange('urgency', e.target.value)} className="filter-select">{urgencyOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select></div>
              <div className="filter-group"><label htmlFor="assignee-filter">Assignee:</label><select id="assignee-filter" value={currentAssignee} onChange={(e) => handleFilterChange('assigneeId', e.target.value)} className="filter-select">{assigneeOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select></div>
              {filtersActive && (<Button variant="outline" onClick={handleClearFilters} leftIcon={<X size={16} />} className='clear-filters-btn'>Clear Filters</Button>)}
          </div>
          {/* Tag Filters */}
          {availableTags.length > 0 && (
            <div className="tag-filter">
                <label className="tag-filter-label">Filter by Tags:</label>
                <div className="tag-list">
                    {availableTags.map(tag => (
                        <button key={tag} type="button" className={`filter-tag ${currentTags.includes(tag) ? 'selected' : ''}`} onClick={() => handleTagToggle(tag)}>
                            {tag}
                        </button>
                    ))}
                </div>
            </div>
          )}
      </section>

      {/* Loading State */}
      {isLoading && <Loader text="Loading tickets..." />}

      {/* Error State */}
      {error && !isLoading && <Alert type="error" message={error} />}

      {/* Tickets Table or No Tickets Message */}
      {!isLoading && !error && (
        tickets.length > 0 ? (
          <>
            <div className="tickets-table-container">
              <Table
                columns={ticketColumns}
                data={tickets}
                tableClassName="tickets-table"
                onRowClick={(ticket) => navigate(`/tickets/${ticket.id}`)} // FIX: Use navigate here
              />
            </div>
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={handlePageChange}
              className="mt-6"
            />
          </>
        ) : (
          // No Tickets Found Message
          <div className="no-tickets">
              <p>No tickets found matching your current filters.</p>
              {filtersActive && (<Button variant="primary" onClick={handleClearFilters}>Clear Filters</Button>)}
          </div>
        )
      )}
    </div>
  );
};

export default TicketsPage;
