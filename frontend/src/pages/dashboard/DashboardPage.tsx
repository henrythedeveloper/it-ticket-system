import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { Ticket, Task, APIResponse } from '../../types/models';

type TicketCounts = {
  unassigned: number;
  assigned: number;
  inProgress: number;
  closed: number;
  total: number;
};

type TicketGroup = {
  id: string;
  subject: string;
  createdAt: string;
  status: string;
  urgency: string;
};

const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [ticketCounts, setTicketCounts] = useState<TicketCounts>({
    unassigned: 0,
    assigned: 0,
    inProgress: 0,
    closed: 0,
    total: 0
  });
  const [recentTickets, setRecentTickets] = useState<TicketGroup[]>([]);
  const [myTickets, setMyTickets] = useState<TicketGroup[]>([]);
  const [upcomingTasks, setUpcomingTasks] = useState<Task[]>([]);
  
  const isAdmin = user?.role === 'Admin';

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        
        // Fetch ticket counts
        const countsResponse = await api.get<APIResponse<TicketCounts>>('/tickets/counts');
        if (countsResponse.data.success && countsResponse.data.data) {
          setTicketCounts(countsResponse.data.data);
        }
        
        // Fetch recent tickets
        const recentResponse = await api.get<APIResponse<Ticket[]>>('/tickets?limit=5');
        if (recentResponse.data.success && recentResponse.data.data) {
          setRecentTickets(
            recentResponse.data.data.map(ticket => ({
              id: ticket.id,
              subject: ticket.subject,
              createdAt: ticket.created_at,
              status: ticket.status,
              urgency: ticket.urgency
            }))
          );
        }
        
        // Fetch my assigned tickets
        const myTicketsResponse = await api.get<APIResponse<Ticket[]>>('/tickets?assigned_to=me&limit=5');
        if (myTicketsResponse.data.success && myTicketsResponse.data.data) {
          setMyTickets(
            myTicketsResponse.data.data.map(ticket => ({
              id: ticket.id,
              subject: ticket.subject,
              createdAt: ticket.created_at,
              status: ticket.status,
              urgency: ticket.urgency
            }))
          );
        }
        
        // Fetch upcoming tasks
        const tasksResponse = await api.get<APIResponse<Task[]>>('/tasks?assigned_to=me&status=Open&limit=5');
        if (tasksResponse.data.success && tasksResponse.data.data) {
          setUpcomingTasks(tasksResponse.data.data);
        }
        
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchDashboardData();
  }, []);
  
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
  
  if (loading) {
    return (
      <div className="dashboard-page loading">
        <div className="loader"></div>
        <p>Loading dashboard data...</p>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <div className="page-header">
        <h1>Dashboard</h1>
        <p>Welcome back, {user?.name}!</p>
      </div>
      
      <div className="stats-cards">
        <div className="stats-card">
          <div className="card-content">
            <h3>Unassigned</h3>
            <p className="count">{ticketCounts.unassigned}</p>
          </div>
          <Link to="/tickets?status=Unassigned" className="card-action">View All</Link>
        </div>
        
        <div className="stats-card">
          <div className="card-content">
            <h3>Assigned</h3>
            <p className="count">{ticketCounts.assigned}</p>
          </div>
          <Link to="/tickets?status=Assigned" className="card-action">View All</Link>
        </div>
        
        <div className="stats-card">
          <div className="card-content">
            <h3>In Progress</h3>
            <p className="count">{ticketCounts.inProgress}</p>
          </div>
          <Link to="/tickets?status=In%20Progress" className="card-action">View All</Link>
        </div>
        
        <div className="stats-card">
          <div className="card-content">
            <h3>Total Open</h3>
            <p className="count">{ticketCounts.unassigned + ticketCounts.assigned + ticketCounts.inProgress}</p>
          </div>
          <Link to="/tickets" className="card-action">View All</Link>
        </div>
      </div>
      
      <div className="dashboard-grid">
        <div className="dashboard-card">
          <div className="card-header">
            <h2>Recent Tickets</h2>
            <Link to="/tickets" className="view-all">View All</Link>
          </div>
          <div className="card-body">
            {recentTickets.length > 0 ? (
              <table className="dashboard-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Subject</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Urgency</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTickets.map(ticket => (
                    <tr key={ticket.id}>
                      <td><Link to={`/tickets/${ticket.id}`}>#{ticket.id.substring(0, 8)}</Link></td>
                      <td><Link to={`/tickets/${ticket.id}`}>{ticket.subject}</Link></td>
                      <td>{formatDate(ticket.createdAt)}</td>
                      <td><span className={`status-badge ${getStatusClass(ticket.status)}`}>{ticket.status}</span></td>
                      <td><span className={`urgency-badge ${getUrgencyClass(ticket.urgency)}`}>{ticket.urgency}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="no-data">No recent tickets found</p>
            )}
          </div>
        </div>
        
        <div className="dashboard-card">
          <div className="card-header">
            <h2>My Assigned Tickets</h2>
            <Link to="/tickets?assigned_to=me" className="view-all">View All</Link>
          </div>
          <div className="card-body">
            {myTickets.length > 0 ? (
              <table className="dashboard-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Subject</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Urgency</th>
                  </tr>
                </thead>
                <tbody>
                  {myTickets.map(ticket => (
                    <tr key={ticket.id}>
                      <td><Link to={`/tickets/${ticket.id}`}>#{ticket.id.substring(0, 8)}</Link></td>
                      <td><Link to={`/tickets/${ticket.id}`}>{ticket.subject}</Link></td>
                      <td>{formatDate(ticket.createdAt)}</td>
                      <td><span className={`status-badge ${getStatusClass(ticket.status)}`}>{ticket.status}</span></td>
                      <td><span className={`urgency-badge ${getUrgencyClass(ticket.urgency)}`}>{ticket.urgency}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="no-data">No tickets assigned to you</p>
            )}
          </div>
        </div>
        
        <div className="dashboard-card">
          <div className="card-header">
            <h2>Upcoming Tasks</h2>
            <Link to="/tasks?assigned_to=me" className="view-all">View All</Link>
          </div>
          <div className="card-body">
            {upcomingTasks.length > 0 ? (
              <ul className="task-list">
                {upcomingTasks.map(task => (
                  <li key={task.id} className="task-item">
                    <Link to={`/tasks/${task.id}`} className="task-link">
                      <span className="task-title">{task.title}</span>
                      {task.due_date && (
                        <span className="task-due">Due: {formatDate(task.due_date)}</span>
                      )}
                      <span className={`task-status status-${task.status.toLowerCase()}`}>{task.status}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="no-data">No upcoming tasks</p>
            )}
          </div>
        </div>
        
        <div className="dashboard-card">
          <div className="card-header">
            <h2>Quick Actions</h2>
          </div>
          <div className="card-body">
            <div className="quick-actions">
              <Link to="/tickets?status=Unassigned" className="action-button">
                <i className="icon">🔍</i>
                <span>View Unassigned Tickets</span>
              </Link>
              
              <Link to="/tasks/new" className="action-button">
                <i className="icon">➕</i>
                <span>Create New Task</span>
              </Link>
              
              {isAdmin && (
                <Link to="/users/new" className="action-button">
                  <i className="icon">👤</i>
                  <span>Add New User</span>
                </Link>
              )}
              
              <Link to="/tickets?assigned_to=me&status=In%20Progress" className="action-button">
                <i className="icon">🔧</i>
                <span>My In Progress Tickets</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;