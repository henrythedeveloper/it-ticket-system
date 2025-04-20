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
  
  // Filter states
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

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Build query parameters
        const params = new URLSearchParams();
        if (statusFilter) params.append('status', statusFilter);
        if (assignedToFilter) params.append('assigned_to', assignedToFilter);
        if (dueDateFilter) params.append('due_date', dueDateFilter);
        if (searchQuery) params.append('search', searchQuery);
        
        // Fetch tasks
        const tasksResponse = await api.get<APIResponse<Task[]>>(`/tasks?${params.toString()}`);
        if (tasksResponse.data.success && tasksResponse.data.data) {
          setTasks(tasksResponse.data.data);
        } else {
          setError('Failed to load tasks');
        }
        
        // Fetch users for filter dropdown
        const usersResponse = await api.get<APIResponse<User[]>>('/users');
        if (usersResponse.data.success && usersResponse.data.data) {
          setUsers(usersResponse.data.data);
        }
        
      } catch (error) {
        console.error('Error fetching tasks:', error);
        setError('Failed to load tasks');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [statusFilter, assignedToFilter, dueDateFilter, searchQuery]);
  
  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    
    if (statusFilter) params.append('status', statusFilter);
    if (assignedToFilter) params.append('assigned_to', assignedToFilter);
    if (dueDateFilter) params.append('due_date', dueDateFilter);
    if (searchQuery) params.append('search', searchQuery);
    
    navigate(`/tasks?${params.toString()}`, { replace: true });
  }, [navigate, statusFilter, assignedToFilter, dueDateFilter, searchQuery]);
  
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // Search is already handled by the useEffect when searchQuery changes
  };
  
  const handleClearFilters = () => {
    setStatusFilter('');
    setAssignedToFilter('');
    setDueDateFilter('');
    setSearchQuery('');
  };
  
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'No due date';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };
  
  // Helper function to determine status badge class
  const getStatusClass = (status: string) => {
    switch (status) {
      case 'Open':
        return 'badge-open';
      case 'In Progress':
        return 'badge-progress';
      case 'Completed':
        return 'badge-completed';
      default:
        return 'badge-open';
    }
  };

  return (
    <div className="tasks-page">
      <div className="page-header">
        <h1>Tasks</h1>
        <div className="header-actions">
          <button 
            className="create-task-btn"
            onClick={() => navigate('/tasks/new')}
          >
            Create New Task
          </button>
        </div>
      </div>
      
      <div className="filter-section">
        <form onSubmit={handleSearch} className="search-form">
          <input
            type="text"
            placeholder="Search tasks..."
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
              <option value="Open">Open</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
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
          
          <div className="filter-group">
            <label>Due Date:</label>
            <select 
              value={dueDateFilter} 
              onChange={(e) => setDueDateFilter(e.target.value)}
              className="filter-select"
            >
              <option value="">All</option>
              <option value="today">Due Today</option>
              <option value="week">Due This Week</option>
              <option value="overdue">Overdue</option>
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
      </div>
      
      {loading ? (
        <div className="loading">
          <div className="loader"></div>
          <p>Loading tasks...</p>
        </div>
      ) : error ? (
        <div className="error-message">{error}</div>
      ) : tasks.length === 0 ? (
        <div className="no-tasks">
          <p>No tasks found matching your filters.</p>
          {Object.values([statusFilter, assignedToFilter, dueDateFilter]).some(Boolean) && (
            <button 
              onClick={handleClearFilters}
              className="clear-filters-btn"
            >
              Clear Filters
            </button>
          )}
        </div>
      ) : (
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
                    <span className={`status-badge ${getStatusClass(task.status)}`}>
                      {task.status}
                    </span>
                  </td>
                  <td>
                    {task.assigned_to_user ? task.assigned_to_user.name : 'Unassigned'}
                  </td>
                  <td className={task.due_date && new Date(task.due_date) < new Date() && task.status !== 'Completed' ? 'overdue' : ''}>
                    {formatDate(task.due_date)}
                  </td>
                  <td>
                    {task.created_by_user ? task.created_by_user.name : 'System'}
                  </td>
                  <td>
                    {formatDate(task.created_at)}
                  </td>
                  <td className="actions-cell">
                    <Link to={`/tasks/${task.id}`} className="view-btn">View</Link>
                    {(isAdmin || task.created_by_user_id === user?.id) && (
                      <button
                        className="delete-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm('Are you sure you want to delete this task?')) {
                            // Handle delete logic here
                            api.delete(`/tasks/${task.id}`)
                              .then(() => {
                                setTasks(tasks.filter(t => t.id !== task.id));
                              })
                              .catch(err => {
                                console.error('Error deleting task:', err);
                                setError('Failed to delete task');
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