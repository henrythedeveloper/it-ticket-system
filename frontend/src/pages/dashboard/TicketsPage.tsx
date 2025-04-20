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
        setError(null); // Clear previous errors
        
        // Build query parameters
        const params = new URLSearchParams();
        if (statusFilter) params.append('status', statusFilter);
        if (urgencyFilter) params.append('urgency', urgencyFilter);
        if (assignedToFilter) params.append('assigned_to', assignedToFilter);
        if (searchQuery) params.append('search', searchQuery); // Assuming backend handles search query
        selectedTags.forEach(tag => params.append('tags', tag)); // Assuming backend handles tags query param
        
        // Fetch tickets
        const ticketsResponse = await api.get<APIResponse<Ticket[]>>(`/tickets?${params.toString()}`);
        if (ticketsResponse.data.success && ticketsResponse.data.data) {
          setTickets(ticketsResponse.data.data);
        } else {
          setError(ticketsResponse.data.error || 'Failed to load tickets');
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
        
      } catch (error: any) {
        console.error('Error fetching tickets page data:', error);
        setError(error.response?.data?.error || 'An error occurred while loading data.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
    // Only refetch when filters change, not navigate
  }, [statusFilter, urgencyFilter, assignedToFilter, searchQuery, selectedTags]);
  
  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    
    if (statusFilter) params.append('status', statusFilter);
    if (urgencyFilter) params.append('urgency', urgencyFilter);
    if (assignedToFilter) params.append('assigned_to', assignedToFilter);
    if (searchQuery) params.append('search', searchQuery);
    selectedTags.forEach(tag => params.append('tags', tag));
    
    // Use replace to avoid polluting browser history on filter changes
    navigate(`/tickets?${params.toString()}`, { replace: true }); 
  }, [navigate, statusFilter, urgencyFilter, assignedToFilter, searchQuery, selectedTags]);
  
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // Triggered by form submit, but useEffect handles the actual data fetching on searchQuery change
  };
  
  const handleClearFilters = () => {
    setStatusFilter('');
    setUrgencyFilter('');
    setAssignedToFilter('');
    setSearchQuery('');
    setSelectedTags([]);
  };
  
  const handleTagToggle = (tagName: string) => {
    setSelectedTags(prev => 
        prev.includes(tagName) 
        ? prev.filter(tag => tag !== tagName) 
        : [...prev, tagName]
    );
  };
  
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };
  
  // Helper functions for badge classes (getUrgencyClass, getStatusClass) remain the same...
  const getUrgencyClass = (urgency: string) => { /* ... */ };
  const getStatusClass = (status: string) => { /* ... */ };

  return (
    <div className="tickets-page">
      {/* Page Header and Filter Section remain mostly the same... */}
      <div className="page-header">
        <h1>Tickets</h1>
        {/* ... */}
      </div>
      <div className="filter-section">
        {/* ... Search form, filters, tag filter ... */}
      </div>
      
      {loading ? (
        <div className="loading">/* ... */</div>
      ) : error ? (
        <div className="error-message">{error}</div>
      ) : tickets.length === 0 ? (
        <div className="no-tickets">/* ... */</div>
      ) : (
        <div className="tickets-table-container">
          <table className="tickets-table">
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
            <tbody>
              {tickets.map(ticket => (
                // Use UUID 'id' for key and navigation
                <tr key={ticket.id} onClick={() => navigate(`/tickets/${ticket.id}`)}> 
                  {/* Display 'ticket_number' */}
                  <td>#{ticket.ticket_number}</td> 
                  <td className="subject-cell">
                    {/* Link still uses UUID 'id' */}
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