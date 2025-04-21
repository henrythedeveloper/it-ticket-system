import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { Task, User, APIResponse } from '../../types/models';

const TasksPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  // Filter states initialized from URL params or defaults
  const [statusFilter, setStatusFilter] = useState<string>(
    queryParams.get('status') || ''
  );
  const [assignedToFilter, setAssignedToFilter] = useState<string>(
    queryParams.get('assigned_to') || ''
  );
  const [dueDateFilter, setDueDateFilter] = useState<string>(
    queryParams.get('due_date') || ''
  );
  const [searchQuery, setSearchQuery] = useState<string>(
    queryParams.get('search') || ''
  );
  
  const isAdmin = user?.role === 'Admin';

  // Effect to fetch data whenever filters change
  useEffect(() => {
    const fetchData = async () => {
      try {
        // *** FIX: Reset error state at the beginning of each fetch ***
        setError(null); 
        setLoading(true);
        
        // Build query parameters from state
        const params = new URLSearchParams();
        if (statusFilter) params.append('status', statusFilter);
        if (assignedToFilter) params.append('assigned_to', assignedToFilter);
        if (dueDateFilter) params.append('due_date', dueDateFilter);
        if (searchQuery) params.append('search', searchQuery);
        
        // Fetch tasks based on current filters
        const tasksResponse = await api.get<APIResponse<Task[]>>(`/tasks?${params.toString()}`);
        if (tasksResponse.data.success && tasksResponse.data.data) {
          setTasks(tasksResponse.data.data); // Update tasks if successful
        } else {
          // If API indicates failure or no data, set an appropriate error or handle empty state
          setTasks([]); // Clear tasks on failure/no data matching filters
          setError(tasksResponse.data.error || 'No tasks found matching your criteria.'); // Set error or specific message
        }
        
        // Fetch users for filter dropdown (could optimize to fetch only once if users list is static)
        // Consider moving this outside this useEffect if it doesn't need to refetch on filter change
        const usersResponse = await api.get<APIResponse<User[]>>('/users');
        if (usersResponse.data.success && usersResponse.data.data) {
          setUsers(usersResponse.data.data);
        } else {
           console.error("Failed to fetch users for filter:", usersResponse.data.error);
           // Handle error fetching users if necessary
        }
        
      } catch (error: any) {
        // Handle network or other unexpected errors during fetch
        console.error('Error fetching tasks:', error);
        setError(error.response?.data?.error || 'An error occurred while loading tasks.');
        setTasks([]); // Clear tasks on error
      } finally {
        // Ensure loading state is turned off regardless of success or failure
        setLoading(false);
      }
    };
    
    fetchData();
    // Dependencies: This effect runs when any filter state changes
  }, [statusFilter, assignedToFilter, dueDateFilter, searchQuery]); 
  
  // Effect to update the URL when filter state changes
  useEffect(() => {
    const params = new URLSearchParams();
    
    // Add filters to params only if they have a value
    if (statusFilter) params.append('status', statusFilter);
    if (assignedToFilter) params.append('assigned_to', assignedToFilter);
    if (dueDateFilter) params.append('due_date', dueDateFilter);
    if (searchQuery) params.append('search', searchQuery);
    
    // Update URL without full page reload
    navigate(`/tasks?${params.toString()}`, { replace: true }); 
  }, [navigate, statusFilter, assignedToFilter, dueDateFilter, searchQuery]); // Dependencies: This effect runs when filter state changes
  
  // Handler for search form submission (optional, as useEffect handles changes)
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // The fetch is triggered by the state change in searchQuery via useEffect
  };
  
  // Handler to clear all filters and the search query
  const handleClearFilters = () => {
    setStatusFilter('');
    setAssignedToFilter('');
    setDueDateFilter('');
    setSearchQuery('');
    // The useEffect hooks will handle refetching and URL update
  };
  
  // Helper function to format date
  const formatDate = (dateString?: string | null): string => {
     if (!dateString) return 'No due date';
    try {
      const date = new Date(dateString);
      // Check if date is valid after parsing
      if (isNaN(date.getTime())) {
          // Try parsing assuming it might already be YYYY-MM-DD
          const parts = dateString.split('-');
          if (parts.length === 3) {
              const year = parseInt(parts[0], 10);
              const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
              const day = parseInt(parts[2], 10);
              const localDate = new Date(Date.UTC(year, month, day));
               if (!isNaN(localDate.getTime())) {
                   return localDate.toLocaleDateString('en-US', {
                       timeZone: 'UTC', // Specify UTC for consistency
                       month: 'short',
                       day: 'numeric',
                       year: 'numeric'
                   });
               }
          }
          return 'Invalid Date'; // Return if parsing fails
      }
      // If parsed directly as ISO string (e.g., from backend)
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch (e) {
      console.error("Error formatting date:", dateString, e);
      return 'Invalid Date';
    }
  };
  
  // Helper function to get CSS class based on task status
  const getStatusClass = (status: string) => {
    switch (status) {
      case 'Open':
        return 'badge-open';
      case 'In Progress':
        return 'badge-progress';
      case 'Completed':
        return 'badge-completed';
      default:
        return 'badge-open'; // Default class
    }
  };

  // --- Render Logic ---
  return (
    <div className="tasks-page">
      {/* Page Header */}
      <div className="page-header">
        <h1>Tasks</h1>
        <div className="header-actions">
          <button 
            className="create-task-btn btn"
            onClick={() => navigate('/tasks/new')} // Navigate to create task page
          >
            Create New Task
          </button>
        </div>
      </div>
      
      {/* Filter Section */}
      <div className="filter-section">
        {/* Search Form */}
        <form onSubmit={handleSearch} className="search-form">
          <input
            type="text"
            placeholder="Search tasks by title or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)} // Update state on change
            className="search-input"
          />
          <button type="submit" className="search-button btn">Search</button>
        </form>
        
        {/* Filter Dropdowns and Clear Button */}
        <div className="filters">
          {/* Status Filter */}
          <div className="filter-group">
            <label>Status:</label>
            <select 
              value={statusFilter} 
              onChange={(e) => setStatusFilter(e.target.value)} // Update state on change
              className="filter-select"
            >
              <option value="">All Statuses</option>
              <option value="Open">Open</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
            </select>
          </div>
          
          {/* Assigned To Filter */}
          <div className="filter-group">
            <label>Assigned To:</label>
            <select 
              value={assignedToFilter} 
              onChange={(e) => setAssignedToFilter(e.target.value)} // Update state on change
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
          
          {/* Due Date Filter */}
          <div className="filter-group">
            <label>Due Date:</label>
            <select 
              value={dueDateFilter} 
              onChange={(e) => setDueDateFilter(e.target.value)} // Update state on change
              className="filter-select"
            >
              <option value="">All</option>
              <option value="today">Due Today</option>
              <option value="week">Due This Week</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>
          
          {/* Clear Filters Button */}
          <button 
            type="button" 
            onClick={handleClearFilters}
            className="clear-filters-btn btn"
          >
            Clear Filters
          </button>
        </div>
      </div>
      
      {/* Conditional Rendering: Loading, Error, No Tasks, or Task Table */}
      {loading ? (
        // Loading state
        <div className="loading">
          <div className="loader"></div>
          <p>Loading tasks...</p>
        </div>
      ) : error && tasks.length === 0 ? ( 
        // Error state (only show error if there are truly no tasks to display because of it)
         <div className="error-message">{error}</div>
      ) : tasks.length === 0 ? (
        // No tasks found state
        <div className="no-tasks">
          <p>{error || 'No tasks found matching your filters.'}</p> 
          {/* Provide button to clear filters if filters are active */}
          {(statusFilter || assignedToFilter || dueDateFilter || searchQuery) && (
            <button 
              onClick={handleClearFilters}
              className="clear-filters-btn btn"
            >
              Clear Filters
            </button>
          )}
        </div>
      ) : (
        // Task table display
        <div className="tasks-table-container">
          <table className="tasks-table">
            <thead>
              <tr>
                <th>Task #</th>
                <th>Title</th>
                <th>Status</th>
                <th>Assigned To</th>
                <th>Due Date</th>
                <th>Created By</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map(task => (
                <tr key={task.id}>
                  <td>#{task.task_number}</td> 
                  <td className="title-cell">
                    <Link to={`/tasks/${task.id}`}>{task.title}</Link>
                  </td>
                  <td>
                    {/* Status Badge */}
                    <span className={`status-badge ${getStatusClass(task.status)}`}>
                      {task.status}
                    </span>
                  </td>
                  <td>
                    {/* Display assigned user name or 'Unassigned' */}
                    {task.assigned_to_user ? task.assigned_to_user.name : 'Unassigned'}
                  </td>
                  {/* Add 'overdue' class if applicable */}
                  <td className={task.due_date && new Date(task.due_date) < new Date() && task.status !== 'Completed' ? 'overdue' : ''}>
                    {formatDate(task.due_date)}
                  </td>
                  <td>
                    {/* Display creator name or 'System' */}
                    {task.created_by_user ? task.created_by_user.name : 'System'}
                  </td>
                  <td>
                    {formatDate(task.created_at)}
                  </td>
                  {/* Action Buttons */}
                  <td className="actions-cell">
                    <Link to={`/tasks/${task.id}`} className="view-btn btn">View</Link>
                    {/* Delete button (conditional based on permission) */}
                    {(isAdmin || task.created_by_user_id === user?.id) && (
                      <button
                        className="delete-btn btn btn-danger"
                        onClick={(e) => {
                          e.stopPropagation(); // Prevent row click navigation
                          if (window.confirm('Are you sure you want to delete this task?')) {
                            // Call API to delete task
                            api.delete(`/tasks/${task.id}`)
                              .then(() => {
                                // Remove deleted task from local state
                                setTasks(prevTasks => prevTasks.filter(t => t.id !== task.id)); 
                              })
                              .catch(err => {
                                console.error('Error deleting task:', err);
                                setError(err.response?.data?.error || 'Failed to delete task');
                              });
                          }
                        }}
                      >
                        Delete
                      </button>
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

export default TasksPage;
