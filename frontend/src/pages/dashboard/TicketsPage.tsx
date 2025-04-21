import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import api from '../../services/api'; // Assuming this is correctly configured
import { useAuth } from '../../contexts/AuthContext'; // Assuming this provides user info
import { Ticket, User, Tag, APIResponse, TicketStatus, TicketUrgency } from '../../types/models'; // Import TS types

const TicketsPage: React.FC = () => {
  // --- Hooks ---
  const { user } = useAuth(); // Get current user info
  const navigate = useNavigate(); // For updating URL
  const location = useLocation(); // For reading URL params
  const queryParams = new URLSearchParams(location.search); // Helper for URL params

  // --- Component State ---
  const [loading, setLoading] = useState(true); // Loading indicator for API calls
  const [tickets, setTickets] = useState<Ticket[]>([]); // Stores the fetched/filtered tickets
  const [users, setUsers] = useState<User[]>([]); // Stores users for the assignee filter
  const [tags, setTags] = useState<Tag[]>([]); // Stores tags for the tag filter
  const [error, setError] = useState<string | null>(null); // Stores potential errors

  // --- Filter State Variables ---
  // Initialize filter state from URL query parameters or defaults
  const [statusFilter, setStatusFilter] = useState<string>(queryParams.get('status') || '');
  const [urgencyFilter, setUrgencyFilter] = useState<string>(queryParams.get('urgency') || '');
  const [assignedToFilter, setAssignedToFilter] = useState<string>(queryParams.get('assigned_to') || '');
  const [searchQuery, setSearchQuery] = useState<string>(queryParams.get('search') || '');
  const [selectedTags, setSelectedTags] = useState<string[]>(queryParams.getAll('tags') || []);

  // --- Derived State / Permissions ---
  const isAdmin = user?.role === 'Admin';

  // --- Effect for Fetching Data based on Filters ---
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null); // Clear previous errors

        // 1. Build API Query Parameters from State
        const params = new URLSearchParams();
        if (statusFilter) params.append('status', statusFilter);
        if (urgencyFilter) params.append('urgency', urgencyFilter);
        if (assignedToFilter) params.append('assigned_to', assignedToFilter);
        if (searchQuery) params.append('search', searchQuery);
        selectedTags.forEach(tag => params.append('tags', tag));

        // 2. Fetch Filtered Tickets
        const ticketsResponse = await api.get<APIResponse<Ticket[]>>(`/tickets?${params.toString()}`);
        if (ticketsResponse.data.success && ticketsResponse.data.data) {
          setTickets(ticketsResponse.data.data); // Update tickets state
        } else {
          setError(ticketsResponse.data.error || 'Failed to load tickets');
        }

        // 3. Fetch Users (for Assignee Dropdown) - Could be optimized to fetch only once
        const usersResponse = await api.get<APIResponse<User[]>>('/users');
        if (usersResponse.data.success && usersResponse.data.data) {
          setUsers(usersResponse.data.data);
        }

        // 4. Fetch Tags (for Tag Filter) - Could be optimized to fetch only once
        const tagsResponse = await api.get<APIResponse<Tag[]>>('/tags');
        if (tagsResponse.data.success && tagsResponse.data.data) {
          setTags(tagsResponse.data.data);
        }

      } catch (error: any) {
        console.error('Error fetching tickets page data:', error);
        setError(error.response?.data?.error || 'An error occurred while loading data.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    // This effect re-runs whenever any of the filter state variables change
  }, [statusFilter, urgencyFilter, assignedToFilter, searchQuery, selectedTags]);

  // --- Effect for Updating Browser URL ---
  useEffect(() => {
    const params = new URLSearchParams();
    // Build query params from state (same as above)
    if (statusFilter) params.append('status', statusFilter);
    if (urgencyFilter) params.append('urgency', urgencyFilter);
    if (assignedToFilter) params.append('assigned_to', assignedToFilter);
    if (searchQuery) params.append('search', searchQuery);
    selectedTags.forEach(tag => params.append('tags', tag));

    // Update the URL in the browser without a full page reload
    navigate(`/tickets?${params.toString()}`, { replace: true });
    // This effect re-runs whenever any filter state changes
  }, [navigate, statusFilter, urgencyFilter, assignedToFilter, searchQuery, selectedTags]);

  // --- Event Handlers ---

  // Handles the search form submission (though filtering is triggered by state change)
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // Actual fetch is handled by the useEffect watching `searchQuery`
  };

  // Resets all filter states to their default values
  const handleClearFilters = () => {
    setStatusFilter('');
    setUrgencyFilter('');
    setAssignedToFilter('');
    setSearchQuery('');
    setSelectedTags([]);
  };

  // Adds or removes a tag from the selectedTags array state
  const handleTagToggle = (tagName: string) => {
    setSelectedTags(prev =>
      prev.includes(tagName)
        ? prev.filter(tag => tag !== tagName)
        : [...prev, tagName]
    );
  };

  // --- Helper Functions ---
  const formatDate = (dateString: string) => {
    // ... (date formatting logic) ...
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Invalid Date';
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
  };
  const getUrgencyClass = (urgency: string) => { 
     switch (urgency) {
      case 'Low': return 'badge-low';
      case 'Medium': return 'badge-medium';
      case 'High': return 'badge-high';
      case 'Critical': return 'badge-critical';
      default: return 'badge-medium';
    }
   };
  const getStatusClass = (status: string) => { 
    switch (status) {
      case 'Unassigned': return 'badge-unassigned';
      case 'Assigned': return 'badge-assigned';
      case 'In Progress': return 'badge-progress';
      case 'Closed': return 'badge-closed';
      default: return 'badge-assigned';
    }
  };

  // --- Render Logic ---
  return (
    <div className="tickets-page">
      <div className="page-header">
        <h1>Tickets</h1>
        {/* Potential Add Ticket Button could go here */}
      </div>

      {/* === START OF FILTER SECTION === */}
      <div className="filter-section">

        {/* Search Form */}
        <form onSubmit={handleSearch} className="search-form">
          <input
            type="text"
            placeholder="Search tickets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
          <button type="submit" className="search-button">Search</button>
        </form>

        {/* Filter Dropdowns & Clear Button */}
        <div className="filters">
          <div className="filter-group">
            <label>Status:</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="filter-select"
            >
              <option value="">All Statuses</option>
              <option value="Unassigned">Unassigned</option>
              <option value="Assigned">Assigned</option>
              <option value="In Progress">In Progress</option>
              <option value="Closed">Closed</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Urgency:</label>
            <select
              value={urgencyFilter}
              onChange={(e) => setUrgencyFilter(e.target.value)}
              className="filter-select"
            >
              <option value="">All Urgencies</option>
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
              <option value="Critical">Critical</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Assigned To:</label>
            <select
              value={assignedToFilter}
              onChange={(e) => setAssignedToFilter(e.target.value)}
              className="filter-select"
            >
              <option value="">All</option>
              <option value="unassigned">Unassigned</option>
              <option value="me">Assigned to Me</option>
              {/* Only show user list if admin */}
              {isAdmin && users.map(staff => (
                <option key={staff.id} value={staff.id}>{staff.name}</option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={handleClearFilters}
            className="clear-filters-btn"
          >
            Clear Filters
          </button>
        </div>

        {/* Tag Filters (Conditional) */}
        {tags.length > 0 && (
          <div className="tag-filter">
            <span className="tag-filter-label">Filter by Tags:</span>
            <div className="tag-list">
              {tags.map(tag => (
                <div
                  key={tag.id} // Use unique tag id
                  className={`filter-tag ${selectedTags.includes(tag.name) ? 'selected' : ''}`}
                  onClick={() => handleTagToggle(tag.name)}
                >
                  {tag.name}
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
      {/* === END OF FILTER SECTION === */}

      {/* --- Loading / Error / Table Display --- */}
      {loading ? (
        <div className="loading">
            <div className="loader"></div>
            <p>Loading tickets...</p>
        </div>
      ) : error ? (
        <div className="error-message">{error}</div>
      ) : tickets.length === 0 ? (
        <div className="no-tickets">
             <p>No tickets found matching your filters.</p>
             {/* Show clear button only if filters are active */}
             {(statusFilter || urgencyFilter || assignedToFilter || searchQuery || selectedTags.length > 0) && (
                <button 
                onClick={handleClearFilters}
                className="clear-filters-btn" // Reuse class or create new
                >
                Clear Filters to See All Tickets
                </button>
             )}
        </div>
      ) : (
        <div className="tickets-table-container">
          <table className="tickets-table">
            {/* Table Header */}
            <thead>
              <tr>
                <th>Ticket #</th>
                <th>Subject</th>
                <th>Status</th>
                <th>Urgency</th>
                <th>Created</th>
                <th>Submitter</th>
                <th>Assigned To</th>
                <th>Tags</th>
              </tr>
            </thead>
            {/* Table Body */}
            <tbody>
              {tickets.map(ticket => (
                <tr key={ticket.id} onClick={() => navigate(`/tickets/${ticket.id}`)}>
                  <td>#{ticket.ticket_number}</td>
                  <td className="subject-cell">
                    <Link to={`/tickets/${ticket.id}`}>{ticket.subject}</Link>
                  </td>
                  <td><span className={`status-badge ${getStatusClass(ticket.status)}`}>{ticket.status}</span></td>
                  <td><span className={`urgency-badge ${getUrgencyClass(ticket.urgency)}`}>{ticket.urgency}</span></td>
                  <td>{formatDate(ticket.created_at)}</td>
                  <td>{ticket.end_user_email}</td>
                  <td>{ticket.assigned_to_user ? ticket.assigned_to_user.name : 'Unassigned'}</td>
                  <td className="tags-cell">
                    {/* Tag display logic */}
                    {ticket.tags && ticket.tags.length > 0 ? (
                      <div className="table-tags">
                        {ticket.tags.map(tag => (
                          <span key={tag.id} className="table-tag">{tag.name}</span>
                        ))}
                      </div>
                    ) : <span className="no-tags">-</span> }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default TicketsPage;