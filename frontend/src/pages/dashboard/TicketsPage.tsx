// src/pages/dashboard/TicketsPage.tsx
// ==========================================================================
// Component representing the page for listing and managing support tickets.
// Includes filtering, search, tag filtering, and a table of tickets.
// **REVISED**: Removed local filter data loading; uses TicketContext now.
// **REVISED**: Cleaned up unused imports and added TicketFilter import.
// **REVISED**: Added Search icon to search input area.
// ==========================================================================

import React, { useEffect, useMemo } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import Loader from '../../components/common/Loader';
import Alert from '../../components/common/Alert';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Table, { TableColumn } from '../../components/common/Table';
import Badge from '../../components/common/Badge';
import Pagination from '../../components/common/Pagination';
import { useAuth } from '../../hooks/useAuth';
import { useTickets } from '../../context/TicketContext';

import { Ticket, TicketStatus, TicketUrgency, Tag, TicketFilter } from '../../types';
import { formatDate } from '../../utils/helpers';
import { Search, X } from 'lucide-react';

// --- Constants ---
const DEFAULT_LIMIT = 15; // Number of tickets per page

// --- Component ---

/**
 * Renders the Tickets list page with filtering, search, pagination, and table display.
 * Fetches tickets and filter options (users, tags) via TicketContext.
 */
const TicketsPage: React.FC = () => {
  // --- Hooks ---
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // --- Consume Ticket Context ---
  const {
    tickets,
    totalTickets,
    isLoading,
    error,
    assignableUsers,
    availableTags,
    fetchTickets,
    clearError,
  } = useTickets();

  // --- Filtering/Pagination State (derived from URL search params) ---
  const currentPage = useMemo(() => parseInt(searchParams.get('page') || '1', 10), [searchParams]);
  const currentStatus = useMemo(() => searchParams.get('status') || '', [searchParams]);
  const currentUrgency = useMemo(() => searchParams.get('urgency') || '', [searchParams]);
  const currentAssignee = useMemo(() => searchParams.get('assigned_to') || '', [searchParams]);
  const currentSearch = useMemo(() => searchParams.get('search') || '', [searchParams]);
  const currentTags = useMemo(() => searchParams.get('tags')?.split(',').filter(tag => tag) || [], [searchParams]);

  // --- Data Fetching ---
  useEffect(() => {
    const filtersFromUrl: Partial<TicketFilter> = {
        page: currentPage,
        status: currentStatus || undefined,
        urgency: currentUrgency || undefined,
        assignedTo: currentAssignee || undefined,
        search: currentSearch || undefined,
        tags: currentTags.length > 0 ? currentTags : undefined,
    };
    fetchTickets(filtersFromUrl);
    return () => { clearError(); };
  }, [currentPage, currentStatus, currentUrgency, currentAssignee, currentSearch, currentTags, fetchTickets, clearError]);

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

  const handleClearFilters = () => {
    setSearchParams({ page: '1' });
  };

  const handlePageChange = (newPage: number) => {
      setSearchParams(prevParams => {
        const newParams = new URLSearchParams(prevParams);
        newParams.set('page', newPage.toString());
        return newParams;
    }, { replace: true });
      window.scrollTo(0, 0);
  };

  // --- Options for Filters ---
  const assigneeOptions = [
    { value: '', label: 'All Assignees' },
    { value: 'unassigned', label: 'Unassigned' },
    ...(user ? [{ value: 'me', label: 'Assigned to Me' }] : []),
    ...assignableUsers.map(u => ({ value: u.id, label: u.name })),
  ];
  const statusOptions: { value: TicketStatus | ''; label: string }[] = [
    { value: '', label: 'All Statuses' }, { value: 'Open', label: 'Open' },
    { value: 'In Progress', label: 'In Progress' }, { value: 'Closed', label: 'Closed' },
  ];
  const urgencyOptions: { value: TicketUrgency | ''; label: string }[] = [
    { value: '', label: 'All Urgencies' }, { value: 'Low', label: 'Low' },
    { value: 'Medium', label: 'Medium' }, { value: 'High', label: 'High' },
    { value: 'Critical', label: 'Critical' },
  ];

  // --- Table Columns ---
  const ticketColumns: TableColumn<Ticket>[] = [
    { key: 'ticket_number', header: '#', render: (item) => <Link to={`/tickets/${item.id}`}>{item.ticketNumber}</Link> },
    { key: 'subject', header: 'Subject', render: (item) => <Link to={`/tickets/${item.id}`}>{item.subject}</Link>, cellClassName: 'subject-cell' },
    { key: 'submitter_name', header: 'Submitter', render: (item) => item.submitterName || item.endUserEmail },
    { key: 'status', header: 'Status', render: (item) => <Badge type={item.status.toLowerCase() as any}>{item.status}</Badge> },
    { key: 'urgency', header: 'Urgency', render: (item) => <Badge type={item.urgency.toLowerCase() as any}>{item.urgency}</Badge> },
    { key: 'assignedTo', header: 'Assignee', render: (item) => item.assignedTo?.name || '-' },
    { key: 'tags', header: 'Tags', render: (item) => (
        item.tags && Array.isArray(item.tags) && item.tags.length > 0
          ? <div className='table-tags'>
              {item.tags.map((tag: Tag) => <span key={tag.id || tag.name} className='table-tag'>{tag.name}</span>)}
            </div>
          : <span className='no-tags'>-</span>
      ), cellClassName: 'tags-cell'
    },
    { key: 'updatedAt', header: 'Last Update', render: (item) => formatDate(item.updatedAt) },
  ];

  const filtersActive = !!currentStatus || !!currentUrgency || !!currentAssignee || !!currentSearch || currentTags.length > 0;
  const totalPages = Math.ceil(totalTickets / DEFAULT_LIMIT);

  // --- Render ---
  return (
    <div className="tickets-page">
      <div className="page-header">
        <h1>Manage Tickets</h1>
      </div>

      <section className="filter-section">
          {/* Search Form - Now includes a button with icon */}
          <form className="search-form" onSubmit={(e) => e.preventDefault()}>
              <Input
                label="" aria-label="Search by subject, description, ID, submitter..."
                id="ticket-search" type="search"
                placeholder="Search by subject, description, ID, submitter..."
                value={currentSearch}
                onChange={handleSearchChange}
                className="search-input" // Ensure this class applies necessary styles
              />
              {/* Add Button with Search Icon */}
              <Button
                type="button" // Type is button as search happens on change
                variant="secondary" // Or primary, depending on desired style
                className="search-button" // Add class for specific styling if needed
                aria-label="Search"
              >
                <Search size={18} /> {/* Use Search Icon */}
              </Button>
          </form>
          {/* Dropdown Filters */}
          <div className="filters">
              <div className="filter-group">
                  <label htmlFor="status-filter">Status:</label>
                  <select id="status-filter" value={currentStatus} onChange={(e) => handleFilterChange('status', e.target.value)} className="filter-select">
                      {statusOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
              </div>
              <div className="filter-group">
                  <label htmlFor="urgency-filter">Urgency:</label>
                  <select id="urgency-filter" value={currentUrgency} onChange={(e) => handleFilterChange('urgency', e.target.value)} className="filter-select">
                      {urgencyOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
              </div>
              <div className="filter-group">
                  <label htmlFor="assignee-filter">Assignee:</label>
                  <select id="assignee-filter" value={currentAssignee} onChange={(e) => handleFilterChange('assigned_to', e.target.value)} className="filter-select">
                      {assigneeOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
              </div>
              {filtersActive && (
                <Button variant="outline" onClick={handleClearFilters} leftIcon={<X size={16} />} className='clear-filters-btn'>
                  Clear Filters
                </Button>
              )}
          </div>
          {/* Tag Filters */}
          {availableTags.length > 0 && (
            <div className="tag-filter">
                <label className="tag-filter-label">Filter by Tags:</label>
                <div className="tag-list">
                    {availableTags.map(tag => (
                        <button
                            key={tag.id}
                            type="button"
                            className={`filter-tag ${currentTags.includes(tag.name) ? 'selected' : ''}`}
                            onClick={() => handleTagToggle(tag.name)}
                        >
                            {tag.name}
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
              {filtersActive && (
                <Button variant="primary" onClick={handleClearFilters}>Clear Filters</Button>
              )}
          </div>
        )
      )}
    </div>
  );
};

export default TicketsPage;
