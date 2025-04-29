// src/pages/dashboard/TicketsPage.tsx
// ==========================================================================
// Component representing the page for listing and managing support tickets.
// Includes filtering, search, tag filtering, and a table of tickets.
// Fixed type errors.
// **REVISED**: Fixed tag rendering in table.
// ==========================================================================

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom'; // Import useNavigate
import Loader from '../../components/common/Loader';
import Alert from '../../components/common/Alert';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Table, { TableColumn } from '../../components/common/Table';
import Badge from '../../components/common/Badge';
import Pagination from '../../components/common/Pagination';
import { useAuth } from '../../hooks/useAuth'; // For default filters
import { fetchTickets } from '../../services/ticketService'; // Ticket API
import { fetchUsers } from '../../services/userService'; // User API for assignee filter
// FIX: Import Tag type
import { Ticket, User, TicketStatus, TicketUrgency, Tag } from '../../types'; // Import types
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
  const navigate = useNavigate(); // Initialize useNavigate

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
  const currentTags = useMemo(() => searchParams.get('tags')?.split(',').filter(tag => tag) || [], [searchParams]); // Filter empty strings
  // Add state for sorting if needed

  // --- Data Fetching ---
  const loadTickets = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    console.log(`Fetching tickets: Page=${currentPage}, Status=${currentStatus}, Urgency=${currentUrgency}, Assignee=${currentAssignee}, Search=${currentSearch}, Tags=${currentTags.join(',')}`);

    try {
      const params: any = {
        page: currentPage,
        limit: DEFAULT_LIMIT,
        status: currentStatus || undefined,
        urgency: currentUrgency || undefined,
        assigneeId: currentAssignee || undefined,
        search: currentSearch || undefined,
        tags: currentTags.length > 0 ? currentTags.join(',') : undefined,
        sortBy: 'updatedAt',
        sortOrder: 'desc',
      };
      if (params.assigneeId === 'me' && user) {
          params.assigneeId = user.id;
      } else if (params.assigneeId === 'me') {
          params.assigneeId = undefined;
      }

      const response = await fetchTickets(params);
      // Ensure tags is always an array
      const ticketsWithEnsuredTags = response.data.map(ticket => ({
          ...ticket,
          tags: Array.isArray(ticket.tags) ? ticket.tags : []
      }));
      setTickets(ticketsWithEnsuredTags);
      setTotalTickets(response.total);
      setTotalPages(response.totalPages);
    } catch (err: any) {
      console.error("Failed to load tickets:", err);
      setError(err.response?.data?.message || err.message || 'Could not load tickets.');
      setTickets([]); setTotalTickets(0); setTotalPages(1);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, currentStatus, currentUrgency, currentAssignee, currentSearch, currentTags, user]);

  const loadFiltersData = useCallback(async () => {
      try {
        const usersData = await fetchUsers({ role: 'Admin,Staff', limit: 500 });
        setAssignableUsers(usersData.data.map(u => ({ id: u.id, name: u.name })));
        setAvailableTags(['bug', 'feature', 'urgent', 'billing', 'account', 'ui', 'backend']); // Mock tags
      } catch (err) {
          console.error("Failed to load filter data:", err);
      }
  }, []);

  // --- Effects ---
  useEffect(() => { loadTickets(); }, [loadTickets]);
  useEffect(() => { loadFiltersData(); }, [loadFiltersData]);

  // --- Handlers ---
  const handleFilterChange = (param: string, value: string) => {
    setSearchParams(prevParams => {
      const newParams = new URLSearchParams(prevParams);
      if (value) { newParams.set(param, value); }
      else { newParams.delete(param); }
      newParams.set('page', '1');
      return newParams;
    }, { replace: true });
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      handleFilterChange('search', e.target.value);
  };

  const handleTagToggle = (tag: string) => {
      const newTags = currentTags.includes(tag)
          ? currentTags.filter(t => t !== tag)
          : [...currentTags, tag];
      handleFilterChange('tags', newTags.join(','));
  };

  const handleClearFilters = () => { setSearchParams({ page: '1' }); };

  const handlePageChange = (newPage: number) => {
      setSearchParams(prevParams => {
        const newParams = new URLSearchParams(prevParams);
        newParams.set('page', newPage.toString());
        return newParams;
    }, { replace: true });
      window.scrollTo(0, 0);
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
    { value: 'unassigned', label: 'Unassigned' },
    ...(user ? [{ value: 'me', label: 'Assigned to Me' }] : []),
    ...assignableUsers.map(u => ({ value: u.id, label: u.name })),
  ];

  // --- Table Columns ---
  const ticketColumns: TableColumn<Ticket>[] = [
    { key: 'ticket_number', header: '#', render: (item) => <Link to={`/tickets/${item.id}`}>{item.ticket_number}</Link> },
    { key: 'subject', header: 'Subject', render: (item) => <Link to={`/tickets/${item.id}`}>{item.subject}</Link>, cellClassName: 'subject-cell' },
    { key: 'status', header: 'Status', render: (item) => <Badge type={item.status.toLowerCase() as any}>{item.status}</Badge> },
    { key: 'urgency', header: 'Urgency', render: (item) => <Badge type={item.urgency.toLowerCase() as any}>{item.urgency}</Badge> },
    { key: 'createdAt', header: 'Created', render: (item) => formatDate(item.createdAt) },
    { key: 'assignedTo', header: 'Assignee', render: (item) => item.assignedTo?.name || '-' },
    { key: 'tags', header: 'Tags', render: (item) => (
        // FIX: Check item.tags exists and is an array before mapping
        item.tags && Array.isArray(item.tags) && item.tags.length > 0
          ? <div className='table-tags'>
              {/* FIX: Use tag.id for key and tag.name for content */}
              {item.tags.map((tag: Tag) => <span key={tag.id} className='table-tag'>{tag.name}</span>)}
            </div>
          : <span className='no-tags'>-</span>
      ), cellClassName: 'tags-cell'
    },
    { key: 'updatedAt', header: 'Last Update', render: (item) => formatDate(item.updatedAt) },
  ];

  const filtersActive = !!currentStatus || !!currentUrgency || !!currentAssignee || !!currentSearch || currentTags.length > 0;

  // --- Render ---
  return (
    <div className="tickets-page">
      {/* Page Header */}
      <div className="page-header">
        <h1>Manage Tickets</h1>
      </div>

      {/* Filter Section */}
      <section className="filter-section">
          <div className="search-form">
              <Input
                label=""
                aria-label="Search by subject, description, ID..."
                id="ticket-search"
                type="search"
                placeholder="Search by subject, description, ID..."
                value={currentSearch}
                onChange={handleSearchChange}
                className="search-input"
              />
          </div>
          <div className="filters">
              <div className="filter-group"><label htmlFor="status-filter">Status:</label><select id="status-filter" value={currentStatus} onChange={(e) => handleFilterChange('status', e.target.value)} className="filter-select">{statusOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select></div>
              <div className="filter-group"><label htmlFor="urgency-filter">Urgency:</label><select id="urgency-filter" value={currentUrgency} onChange={(e) => handleFilterChange('urgency', e.target.value)} className="filter-select">{urgencyOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select></div>
              <div className="filter-group"><label htmlFor="assignee-filter">Assignee:</label><select id="assignee-filter" value={currentAssignee} onChange={(e) => handleFilterChange('assigneeId', e.target.value)} className="filter-select">{assigneeOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select></div>
              {filtersActive && (<Button variant="outline" onClick={handleClearFilters} leftIcon={<X size={16} />} className='clear-filters-btn'>Clear Filters</Button>)}
          </div>
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

      {isLoading && <Loader text="Loading tickets..." />}
      {error && !isLoading && <Alert type="error" message={error} />}

      {!isLoading && !error && (
        tickets.length > 0 ? (
          <>
            <div className="tickets-table-container">
              <Table
                columns={ticketColumns}
                data={tickets}
                tableClassName="tickets-table"
                onRowClick={(ticket) => navigate(`/tickets/${ticket.id}`)}
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
