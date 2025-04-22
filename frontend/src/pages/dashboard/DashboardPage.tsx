// src/pages/dashboard/DashboardPage.tsx
// ==========================================================================
// Component representing the main dashboard view for authenticated users.
// Displays key statistics, recent tickets, assigned tickets, tasks, etc.
// ==========================================================================

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Loader from '../../components/common/Loader';
import Alert from '../../components/common/Alert';
import Card from '../../components/common/Card';
import Table, { TableColumn } from '../../components/common/Table'; // Import Table and Column type
import Badge from '../../components/common/Badge'; // Import Badge
import { useAuth } from '../../hooks/useAuth'; // Auth hook for user info
import { fetchTickets } from '../../services/ticketService'; // Ticket API
import { fetchTasks } from '../../services/taskService'; // Task API
import { Ticket, Task } from '../../types'; // Import types
import { formatDate, truncateString } from '../../utils/helpers'; // Utility functions
import { PlusCircle, ListTodo, Ticket as TicketIcon } from 'lucide-react'; // Icons

// --- Types ---
/**
 * Structure for dashboard statistics.
 */
interface DashboardStats {
  unassigned: number;
  assignedToMe: number;
  inProgress: number;
  myOpenTickets: number; // Tickets submitted by the current user that are open
  // Add more stats as needed
}

// --- Component ---

/**
 * Renders the main dashboard page displaying overview information.
 */
const DashboardPage: React.FC = () => {
  // --- Hooks ---
  const { user } = useAuth(); // Get current user info

  // --- State ---
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentTickets, setRecentTickets] = useState<Ticket[]>([]);
  const [myTickets, setMyTickets] = useState<Ticket[]>([]); // Tickets assigned to me
  const [myTasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // --- Data Fetching ---
  useEffect(() => {
    const loadDashboardData = async () => {
      setIsLoading(true);
      setError(null);
      if (!user) {
          setError("User not authenticated.");
          setIsLoading(false);
          return;
      }

      try {
        // --- Fetch Data Concurrently ---
        const [
          // TODO: Replace with a dedicated stats endpoint if available
          unassignedTicketsPromise,
          assignedTicketsPromise,
          inProgressTicketsPromise,
          myOpenTicketsPromise, // Tickets submitted by me
          myTasksPromise
        ] = await Promise.allSettled([
          fetchTickets({ status: 'Unassigned', limit: 5 }), // Fetch 5 for stats count (adjust limit)
          fetchTickets({ assigneeId: user.id, status: 'Assigned', limit: 5 }), // Assigned to me
          fetchTickets({ assigneeId: user.id, status: 'In Progress', limit: 5 }), // In progress by me
          fetchTickets({ submitterId: user.id, status: 'Open,Assigned,In Progress', limit: 5 }), // Submitted by me & open
          fetchTasks({ assigneeId: user.id, status: 'Open,In Progress', limit: 5, sortBy: 'dueDate', sortOrder: 'asc' }) // Tasks assigned to me
        ]);

        // --- Process Results ---
        // Stats Calculation (adjust based on actual API capabilities)
        const calculatedStats: DashboardStats = {
            unassigned: unassignedTicketsPromise.status === 'fulfilled' ? unassignedTicketsPromise.value.total : 0,
            assignedToMe: assignedTicketsPromise.status === 'fulfilled' ? assignedTicketsPromise.value.total : 0,
            inProgress: inProgressTicketsPromise.status === 'fulfilled' ? inProgressTicketsPromise.value.total : 0,
            myOpenTickets: myOpenTicketsPromise.status === 'fulfilled' ? myOpenTicketsPromise.value.total : 0,
        };
        setStats(calculatedStats);

        // Set ticket/task lists (use fetched data if successful)
        setRecentTickets(unassignedTicketsPromise.status === 'fulfilled' ? unassignedTicketsPromise.value.data : []); // Show recent unassigned tickets
        setMyTickets(assignedTicketsPromise.status === 'fulfilled' ? assignedTicketsPromise.value.data : []); // Show tickets assigned to me
        setTasks(myTasksPromise.status === 'fulfilled' ? myTasksPromise.value.data : []);

          // Check for any failed promises and set a general error if needed
          const failedPromises = [unassignedTicketsPromise, assignedTicketsPromise, inProgressTicketsPromise, myOpenTicketsPromise, myTasksPromise].filter(p => p.status === 'rejected');
          if (failedPromises.length > 0) {
              console.error("Some dashboard data failed to load:", failedPromises);
              setError("Could not load all dashboard data. Some sections might be incomplete.");
              // Keep showing data that did load successfully
          }

      } catch (err: any) {
        // Catch errors not handled by Promise.allSettled (e.g., network error before promises)
        console.error("Failed to load dashboard data:", err);
        setError(err.message || 'An error occurred while loading dashboard data.');
      } finally {
        setIsLoading(false);
      }
    };

    loadDashboardData();
  }, [user]); // Refetch if user changes

  // --- Table Columns ---
  // Define columns for the tickets tables
  const ticketColumns: TableColumn<Ticket>[] = [
    { key: 'id', header: 'ID', render: (item) => <Link to={`/tickets/${item.id}`}>#{item.id.substring(0, 6)}...</Link> },
    { key: 'subject', header: 'Subject', render: (item) => <Link to={`/tickets/${item.id}`}>{truncateString(item.subject, 40)}</Link> },
    { key: 'status', header: 'Status', render: (item) => <Badge type={item.status.toLowerCase() as any}>{item.status}</Badge> }, // Type assertion might be needed
    { key: 'urgency', header: 'Urgency', render: (item) => <Badge type={item.urgency.toLowerCase() as any}>{item.urgency}</Badge> },
    { key: 'createdAt', header: 'Created', render: (item) => formatDate(item.createdAt) },
  ];

    // Define columns for the tasks table
    const taskColumns: TableColumn<Task>[] = [
      { key: 'title', header: 'Task', render: (item) => <Link to={`/tasks/${item.id}`}>{truncateString(item.title, 50)}</Link> },
      { key: 'status', header: 'Status', render: (item) => <Badge type={item.status === 'In Progress' ? 'progress' : item.status.toLowerCase() as any}>{item.status}</Badge> },
      { key: 'dueDate', header: 'Due Date', render: (item) => item.dueDate ? formatDate(item.dueDate) : 'N/A' },
    ];

  // --- Render ---
  return (
    <div className="dashboard-page">
      {/* Page Header */}
      <div className="page-header">
        <h1>Dashboard</h1>
        {/* Optional: Add welcome message */}
        {user && <p>Welcome back, {user.name}!</p>}
      </div>

      {/* Loading State */}
      {isLoading && <Loader text="Loading dashboard..." />}

      {/* Error State */}
      {error && !isLoading && <Alert type="error" message={error} />}

      {/* Dashboard Content */}
      {!isLoading && !error && stats && (
        <>
          {/* Statistics Cards */}
          <section className="stats-cards">
            <Link to="/tickets?status=Unassigned" className="stats-card">
                <div className="card-content">
                    <h3>Unassigned</h3>
                    <p className="count">{stats.unassigned}</p>
                </div>
                <div className="card-action">View All</div>
            </Link>
            <Link to="/tickets?assigneeId=me&status=Assigned" className="stats-card">
                  <div className="card-content">
                    <h3>Assigned To Me</h3>
                    <p className="count">{stats.assignedToMe}</p>
                </div>
                <div className="card-action">View All</div>
            </Link>
              <Link to="/tickets?assigneeId=me&status=In Progress" className="stats-card">
                  <div className="card-content">
                    <h3>My In Progress</h3>
                    <p className="count">{stats.inProgress}</p>
                </div>
                <div className="card-action">View All</div>
            </Link>
              <Link to="/tickets?submitterId=me&status=Open,Assigned,In Progress" className="stats-card">
                  <div className="card-content">
                    <h3>My Open Tickets</h3>
                    <p className="count">{stats.myOpenTickets}</p>
                </div>
                <div className="card-action">View All</div>
            </Link>
          </section>

          {/* Main Dashboard Grid */}
          <section className="dashboard-grid">
            {/* Recent Unassigned Tickets Card */}
            <Card className="dashboard-card">
              <div className="card-header">
                <h2>Recent Unassigned Tickets</h2>
                <Link to="/tickets?status=Unassigned" className="view-all">View All</Link>
              </div>
              <div className="card-body">
                <Table
                  columns={ticketColumns}
                  data={recentTickets}
                  emptyStateMessage={<p className="no-data">No unassigned tickets found.</p>}
                  tableClassName="dashboard-table" // Add specific class if needed
                />
              </div>
            </Card>

            {/* My Assigned Tickets Card */}
              <Card className="dashboard-card">
                <div className="card-header">
                  <h2>My Assigned Tickets</h2>
                  <Link to="/tickets?assigneeId=me&status=Assigned,In Progress" className="view-all">View All</Link>
                </div>
                <div className="card-body">
                  <Table
                    columns={ticketColumns}
                    data={myTickets} // Display tickets assigned to me
                    emptyStateMessage={<p className="no-data">No tickets currently assigned to you.</p>}
                    tableClassName="dashboard-table"
                  />
                </div>
              </Card>

            {/* My Tasks Card */}
            <Card className="dashboard-card">
              <div className="card-header">
                <h2>My Tasks</h2>
                <Link to="/tasks?assigneeId=me" className="view-all">View All</Link>
              </div>
              <div className="card-body">
                  <Table
                    columns={taskColumns}
                    data={myTasks}
                    emptyStateMessage={<p className="no-data">You have no assigned tasks.</p>}
                    tableClassName="dashboard-table"
                  />
              </div>
            </Card>

            {/* Quick Actions Card */}
            <Card className="dashboard-card">
              <div className="card-header">
                <h2>Quick Actions</h2>
              </div>
              <div className="card-body">
                <div className="quick-actions">
                    <Link to="/tickets/new" className="action-button"> {/* Assuming /tickets/new exists */}
                        <TicketIcon size={24} className="icon" />
                        <span>Create Ticket</span>
                    </Link>
                    <Link to="/tasks/new" className="action-button"> {/* Assuming /tasks/new exists */}
                        <ListTodo size={24} className="icon" />
                        <span>Create Task</span>
                    </Link>
                    {/* Add more relevant actions */}
                </div>
              </div>
            </Card>
          </section>
        </>
      )}
    </div>
  );
};

export default DashboardPage;
