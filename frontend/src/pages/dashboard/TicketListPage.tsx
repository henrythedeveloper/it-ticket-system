import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTickets } from '../../context/TicketContext';
import { useAuth } from '../../hooks/useAuth';
import Table from '../../components/common/Table';
import Pagination from '../../components/common/Pagination';
import Select from '../../components/common/Select';
import Loader from '../../components/common/Loader';
import Alert from '../../components/common/Alert';
import { TicketStatus, TicketUrgency } from '../../types';


const TicketListPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { 
    tickets, 
    totalTickets, 
    isLoading, 
    error, 
    filters, 
    fetchTickets, 
    setFilters,
    clearError
  } = useTickets();

  useEffect(() => {
    // Load tickets with current filters when component mounts
    fetchTickets();
    return () => {
      clearError();
    };
  }, [fetchTickets, clearError]);

  // Filter change handlers
  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    clearError();
    const value = e.target.value === 'all' ? undefined : e.target.value as TicketStatus;
    setFilters({ status: value, page: 1 });
    fetchTickets({ status: value, page: 1 });
  };

  const handleUrgencyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    clearError();
    const value = e.target.value === 'all' ? undefined : e.target.value as TicketUrgency;
    setFilters({ urgency: value, page: 1 });
    fetchTickets({ urgency: value, page: 1 });
  };

  const handleAssigneeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    clearError();
    let value;
    if (e.target.value === 'all') {
      value = undefined;
    } else if (e.target.value === 'unassigned') {
      value = 'unassigned';
    } else if (e.target.value === 'me' && user) {
      value = 'me';
    } else {
      value = e.target.value;
    }
    
    setFilters({ assignedTo: value, page: 1 });
    fetchTickets({ assignedTo: value, page: 1 });
  };

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    clearError();
    const [sortBy, sortOrder] = e.target.value.split('-');
    setFilters({ sortBy, sortOrder: sortOrder as 'asc' | 'desc' | undefined, page: 1 });
    fetchTickets({ sortBy, sortOrder: sortOrder as 'asc' | 'desc' | undefined, page: 1 });
  };

  // Search handler
  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    clearError();
    const searchInput = e.currentTarget.elements.namedItem('search') as HTMLInputElement;
    setFilters({ search: searchInput.value, page: 1 });
    fetchTickets({ search: searchInput.value, page: 1 });
  };

  // Pagination handler
  const handlePageChange = (page: number) => {
    clearError();
    setFilters({ page });
    fetchTickets({ page });
  };

  // Table row click handler
  const handleRowClick = (ticketId: string) => {
    navigate(`/dashboard/tickets/${ticketId}`);
  };

  // Define table columns
  const columns = [
    { key: 'ticketNumber', header: '#', width: '80px', render: (row: any) => row.ticketNumber != null ? row.ticketNumber : '—' },
    { key: 'subject', header: 'Subject', width: '300px' },
    { key: 'submitterName', header: 'Submitter', width: '150px', render: (row: any) => row.submitterName || row.endUserEmail || '—' },
    { key: 'status', header: 'Status', width: '120px' },
    { key: 'urgency', header: 'Urgency', width: '120px' },
    { key: 'assignedTo', header: 'Assignee', width: '150px', render: (row: any) => row.assignedTo?.name || 'Unassigned' },
    { key: 'tags', header: 'Tags', width: '150px', render: (row: any) => Array.isArray(row.tags) && row.tags.length > 0 ? row.tags.map((tag: any) => tag.name).join(', ') : '—' },
    { key: 'updatedAt', header: 'Last Update', width: '180px', render: (row: any) => row.updatedAt ? new Date(row.updatedAt).toLocaleString() : '—' },
  ];

  if (isLoading && tickets.length === 0) {
    return <Loader />;
  }

  return (
    <div className="ticket-list-page">
      <div className="page-header">
        <h1>Support Tickets</h1>
        <button 
          className="btn btn-primary" 
          onClick={() => navigate('/dashboard/tickets/new')}
        >
          New Ticket
        </button>
      </div>

      {error && <Alert type="error" message={error} />}

      <div className="filters-container">
        <form className="search-form" onSubmit={handleSearch}>
          <input 
            type="text" 
            name="search" 
            placeholder="Search tickets..." 
            defaultValue={filters.search || ''}
          />
          <button type="submit" className="btn btn-secondary">Search</button>
        </form>

        <div className="filter-selects">
          <Select 
            id="status-select"
            label="Status" 
            value={filters.status || 'all'} 
            onChange={handleStatusChange}
            options={[
              { value: 'all', label: 'All Statuses' },
              { value: 'Open', label: 'Open' },
              { value: 'In Progress', label: 'In Progress' },
              { value: 'Closed', label: 'Closed' },
            ]}
          />

          <Select 
            id="urgency-select"
            label="Urgency" 
            value={filters.urgency || 'all'} 
            onChange={handleUrgencyChange}
            options={[
              { value: 'all', label: 'All Urgencies' },
              { value: 'Low', label: 'Low' },
              { value: 'Medium', label: 'Medium' },
              { value: 'High', label: 'High' },
              { value: 'Critical', label: 'Critical' },
            ]}
          />

          <Select 
            id="assignee-select"
            label="Assigned To" 
            value={filters.assignedTo || 'all'} 
            onChange={handleAssigneeChange}
            options={[
              { value: 'all', label: 'All Tickets' },
              { value: 'me', label: 'Assigned to Me' },
              { value: 'unassigned', label: 'Unassigned' },
            ]}
          />

          <Select 
            id="sortby-select"
            label="Sort By" 
            value={`${filters.sortBy || 'updatedAt'}-${filters.sortOrder || 'desc'}`}
            onChange={handleSortChange}
            options={[
              { value: 'updatedAt-desc', label: 'Latest Update' },
              { value: 'createdAt-desc', label: 'Newest First' },
              { value: 'createdAt-asc', label: 'Oldest First' },
              { value: 'urgency-desc', label: 'Highest Urgency' },
              { value: 'urgency-asc', label: 'Lowest Urgency' },
              { value: 'ticketNumber-asc', label: 'Ticket Number' },
            ]}
          />
        </div>
      </div>

      {tickets.length === 0 ? (
        <div className="no-tickets">
          <p>No tickets found matching your criteria.</p>
        </div>
      ) : (
        <>
          <Table 
            columns={columns} 
            data={tickets} 
            onRowClick={(row) => handleRowClick(row.id)}
          />
          
          <Pagination 
            currentPage={filters.page || 1} 
            totalPages={totalTickets} 
            onPageChange={handlePageChange}
          />
        </>
      )}
    </div>
  );
};

export default TicketListPage;