import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { Ticket, User, Tag, APIResponse } from '../../types/models';

const TicketsPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  // Filter states
  const [statusFilter, setStatusFilter] = useState<string>(queryParams.get('status') || '');
  const [urgencyFilter, setUrgencyFilter] = useState<string>(queryParams.get('urgency') || '');
  const [assignedToFilter, setAssignedToFilter] = useState<string>(
    queryParams.get('assigned_to') || ''
  );
  const [searchQuery, setSearchQuery] = useState<string>(queryParams.get('search') || '');
  const [selectedTags, setSelectedTags] = useState<string[]>(
    queryParams.getAll('tags') || []
  );
  
  const isAdmin = user?.role === 'Admin';

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Build query parameters
        const params = new URLSearchParams();
        if (statusFilter) params.append('status', statusFilter);
        if (urgencyFilter) params.append('urgency', urgencyFilter);
        if (assignedToFilter) params.append('assigned_to', assignedToFilter);
        if (searchQuery) params.append('search', searchQuery);
        selectedTags.forEach(tag => params.append('tags', tag));
        
        // Fetch tickets
        const ticketsResponse = await api.get<APIResponse<Ticket[]>>(`/tickets?${params.toString()}`);
        if (ticketsResponse.data.success && ticketsResponse.data.data) {
          setTickets(ticketsResponse.data.data);
        } else {
          setError('Failed to load tickets');
        }
        
        // Fetch users for filter dropdown
        const usersResponse = await api.get<APIResponse<User[]>>('/users');
        if (usersResponse.data.success && usersResponse.data.data) {
          setUsers(usersResponse.data.data);
        }
        
        // Fetch tags for filter
        const tagsResponse = await api.get<APIResponse<Tag[]>>('/tags');
        if (tagsResponse.data.success && tagsResponse.data.data) {
          setTags(tagsResponse.data.data);
        }
        
      } catch (error) {
        console.error('Error fetching tickets:', error);
        setError('Failed to load tickets');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [statusFilter, urgencyFilter, assignedToFilter, searchQuery, selectedTags]);
  
  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    
    if (statusFilter) params.append('status', statusFilter);
    if (urgencyFilter) params.append('urgency', urgencyFilter);
    if (assignedToFilter) params.append('assigned_to', assignedToFilter);
    if (searchQuery) params.append('search', searchQuery);
    selectedTags.forEach(tag => params.append('tags', tag));
    
    navigate(`/tickets?${params.toString()}`, { replace: true });
  }, [navigate, statusFilter, urgencyFilter, assignedToFilter, searchQuery, selectedTags]);
  
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // Search is already handled by the useEffect when searchQuery changes
  };
  
  const handleClearFilters = () => {
    setStatusFilter('');
    setUrgencyFilter('');
    setAssignedToFilter('');
    setSearchQuery('');
    setSelectedTags([]);
  };
  
  const handleTagToggle = (tagName: string) => {
    if (selectedTags.includes(tagName)) {
      setSelectedTags(selectedTags.filter(tag => tag !== tagName));
    } else {
      setSelectedTags([...selectedTags, tagName]);
    }
  };
  
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };
  
  // Helper function to determine urgency badge class
  const getUrgencyClass = (urgency: string) => {
    switch (urgency) {
      case 'Low':
        return 'badge-low';
      case 'Medium':
        return 'badge-medium';
      case 'High':
        return 'badge-high';
      case 'Critical':
        return 'badge-critical';
      default:
        return 'badge-medium';
    }
  };
  
  // Helper function to determine status badge class
  const getStatusClass = (status: string) => {
    switch (status) {
      case 'Unassigned':
        return 'badge-unassigned';
      case 'Assigned':
        return 'badge-assigned';
      case 'In Progress':
        return 'badge-progress';
      case 'Closed':
        return 'badge-closed';
      default:
        return 'badge-assigned';
    }
  };

  return (
    <div className="tickets-page">
      <div className="page-header">
        <h1>Tickets</h1>
        <div className="header-actions">
          {/* Add action buttons here if needed */}
        </div>
      </div>
      
      <div className="filter-section">
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
        
        {tags.length > 0 && (
          <div className="tag-filter">
            <span className="tag-filter-label">Filter by Tags:</span>
            <div className="tag-list">
              {tags.map(tag => (
                <div
                  key={tag.id}
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
          {Object.values([statusFilter, urgencyFilter, assignedToFilter, ...selectedTags]).some(Boolean) && (
            <button 
              onClick={handleClearFilters}
              className="clear-filters-btn"
            >
              Clear Filters
            </button>
          )}
        </div>
      ) : (
        <div className="tickets-table-container">
          <table className="tickets-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Subject</th>
                <th>Status</th>
                <th>Urgency</th>
                <th>Created</th>
                <th>Submitter</th>
                <th>Assigned To</th>
                <th>Tags</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map(ticket => (
                <tr key={ticket.id} onClick={() => navigate(`/tickets/${ticket.id}`)}>
                  <td>#{ticket.id}</td>
                  <td className="subject-cell">
                    <Link to={`/tickets/${ticket.id}`}>{ticket.subject}</Link>
                  </td>
                  <td>
                    <span className={`status-badge ${getStatusClass(ticket.status)}`}>
                      {ticket.status}
                    </span>
                  </td>
                  <td>
                    <span className={`urgency-badge ${getUrgencyClass(ticket.urgency)}`}>
                      {ticket.urgency}
                    </span>
                  </td>
                  <td>{formatDate(ticket.created_at)}</td>
                  <td>{ticket.end_user_email}</td>
                  <td>
                    {ticket.assigned_to_user ? ticket.assigned_to_user.name : 'Unassigned'}
                  </td>
                  <td className="tags-cell">
                    {ticket.tags && ticket.tags.length > 0 ? (
                      <div className="table-tags">
                        {ticket.tags.map(tag => (
                          <span key={tag.id} className="table-tag">{tag.name}</span>
                        ))}
                      </div>
                    ) : (
                      <span className="no-tags">-</span>
                    )}
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