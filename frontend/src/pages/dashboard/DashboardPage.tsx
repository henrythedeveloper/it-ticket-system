// src/pages/dashboard/DashboardPage.tsx
// ==========================================================================
// Component representing the main dashboard view for authenticated users.
// Displays key statistics, recent tickets, assigned tickets, tasks, etc.
// **REVISED**: Added stricter check for user and user.name before access.
// ==========================================================================

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Loader from '../../components/common/Loader';
import Alert from '../../components/common/Alert';
import Card from '../../components/common/Card';
import Table, { TableColumn } from '../../components/common/Table';
import Badge from '../../components/common/Badge';
import { useAuth } from '../../hooks/useAuth';
import { fetchTickets } from '../../services/ticketService';
import { fetchTasks } from '../../services/taskService';
import { Ticket, Task } from '../../types';
import { formatDate, truncateString } from '../../utils/helpers';
import { PlusCircle, ListTodo, Ticket as TicketIcon } from 'lucide-react';

// --- Types ---
interface DashboardStats {
  unassigned: number;
  assignedToMe: number;
  inProgress: number;
  myOpenTickets: number;
}

// --- Component ---
const DashboardPage: React.FC = () => {
  // --- Hooks ---
  const { user, loading: authLoading } = useAuth(); // Get user info and auth loading state

  // --- State ---
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentTickets, setRecentTickets] = useState<Ticket[]>([]);
  const [myTickets, setMyTickets] = useState<Ticket[]>([]);
  const [myTasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true); // Separate loading state for dashboard data
  const [error, setError] = useState<string | null>(null);

  // --- Data Fetching ---
  useEffect(() => {
    const loadDashboardData = async () => {
      // Ensure user object is fully loaded before proceeding
      if (!user || !user.id) {
          console.warn("[DashboardPage] User data not ready for fetching dashboard stats.");
          setIsLoading(false); // Stop loading if user isn't ready
          return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const [
          unassignedTicketsPromise,
          assignedTicketsPromise,
          inProgressTicketsPromise,
          myOpenTicketsPromise,
          myTasksPromise
        ] = await Promise.allSettled([
          fetchTickets({ status: 'Unassigned', limit: 5 }),
          fetchTickets({ assigneeId: user.id, status: 'Assigned', limit: 5 }),
          fetchTickets({ assigneeId: user.id, status: 'In Progress', limit: 5 }),
          fetchTickets({ submitterId: user.id, status: 'Open,Assigned,In Progress', limit: 5 }),
          fetchTasks({ assigneeId: user.id, status: 'Open,In Progress', limit: 5, sortBy: 'dueDate', sortOrder: 'asc' })
        ]);

        // Process Results (Stats Calculation)
        const calculatedStats: DashboardStats = {
            unassigned: unassignedTicketsPromise.status === 'fulfilled' ? unassignedTicketsPromise.value.total : 0,
            assignedToMe: assignedTicketsPromise.status === 'fulfilled' ? assignedTicketsPromise.value.total : 0,
            inProgress: inProgressTicketsPromise.status === 'fulfilled' ? inProgressTicketsPromise.value.total : 0,
            myOpenTickets: myOpenTicketsPromise.status === 'fulfilled' ? myOpenTicketsPromise.value.total : 0,
        };
        setStats(calculatedStats);

        // Set ticket/task lists
        setRecentTickets(unassignedTicketsPromise.status === 'fulfilled' ? unassignedTicketsPromise.value.data : []);
        setMyTickets(assignedTicketsPromise.status === 'fulfilled' ? assignedTicketsPromise.value.data : []);
        setTasks(myTasksPromise.status === 'fulfilled' ? myTasksPromise.value.data : []);

        const failedPromises = [unassignedTicketsPromise, assignedTicketsPromise, inProgressTicketsPromise, myOpenTicketsPromise, myTasksPromise].filter(p => p.status === 'rejected');
        if (failedPromises.length > 0) {
            console.error("Some dashboard data failed to load:", failedPromises);
            setError("Could not load all dashboard data.");
        }

      } catch (err: any) {
        console.error("Failed to load dashboard data:", err);
        setError(err.message || 'An error occurred while loading dashboard data.');
      } finally {
        setIsLoading(false);
      }
    };

    // Trigger fetch only when auth loading is done AND user object is available
    if (!authLoading && user) {
        loadDashboardData();
    } else if (!authLoading && !user) {
        // If auth is done loading but there's no user (e.g., token invalid)
        setIsLoading(false); // Stop dashboard loading
        setError("User session not found. Please log in."); // Optional: Set an error
    }
    // If authLoading is true, we wait for it to finish
  }, [user, authLoading]); // Depend on user and authLoading

  // --- Table Columns ---
  const ticketColumns: TableColumn<Ticket>[] = [
    { key: 'id', header: 'ID', render: (item) => <Link to={`/tickets/${item.id}`}>#{item.id.substring(0, 6)}...</Link> },
    { key: 'subject', header: 'Subject', render: (item) => <Link to={`/tickets/${item.id}`}>{truncateString(item.subject, 40)}</Link> },
    { key: 'status', header: 'Status', render: (item) => <Badge type={item.status.toLowerCase() as any}>{item.status}</Badge> },
    { key: 'urgency', header: 'Urgency', render: (item) => <Badge type={item.urgency.toLowerCase() as any}>{item.urgency}</Badge> },
    { key: 'createdAt', header: 'Created', render: (item) => formatDate(item.createdAt) },
  ];

  const taskColumns: TableColumn<Task>[] = [
      { key: 'title', header: 'Task', render: (item) => <Link to={`/tasks/${item.id}`}>{truncateString(item.title, 50)}</Link> },
      { key: 'status', header: 'Status', render: (item) => <Badge type={item.status === 'In Progress' ? 'progress' : item.status.toLowerCase() as any}>{item.status}</Badge> },
      { key: 'dueDate', header: 'Due Date', render: (item) => item.dueDate ? formatDate(item.dueDate) : 'N/A' },
    ];

  // --- Render ---
  // Show loader if either auth check OR dashboard data fetch is in progress
  if (authLoading || isLoading) {
    return <Loader text="Loading dashboard..." />;
  }

  // Show error if dashboard data fetch failed
  if (error) {
    return <Alert type="error" message={error} />;
  }

  // If not loading and no error, but stats are still null (could happen if user became null just before fetch)
  if (!stats) {
      return <Alert type="info" message="No dashboard data to display." />;
  }

  return (
    <div className="dashboard-page">
      {/* Page Header */}
      <div className="page-header">
        <h1>Dashboard</h1>
        {/* ** Stricter check: Ensure user AND user.name exist ** */}
        {user && user.name && <p>Welcome back, {user.name}!</p>}
      </div>

      {/* Dashboard Content */}
      <> {/* Fragment is fine here as stats check is done above */}
          {/* Statistics Cards */}
          <section className="stats-cards">
            <Link to="/tickets?status=Unassigned" className="stats-card">
                <div className="card-content"><h3>Unassigned</h3><p className="count">{stats.unassigned}</p></div><div className="card-action">View All</div>
            </Link>
            <Link to="/tickets?assigneeId=me&status=Assigned" className="stats-card">
                  <div className="card-content"><h3>Assigned To Me</h3><p className="count">{stats.assignedToMe}</p></div><div className="card-action">View All</div>
            </Link>
              <Link to="/tickets?assigneeId=me&status=In Progress" className="stats-card">
                  <div className="card-content"><h3>My In Progress</h3><p className="count">{stats.inProgress}</p></div><div className="card-action">View All</div>
            </Link>
              <Link to="/tickets?submitterId=me&status=Open,Assigned,In Progress" className="stats-card">
                  <div className="card-content"><h3>My Open Tickets</h3><p className="count">{stats.myOpenTickets}</p></div><div className="card-action">View All</div>
            </Link>
          </section>

          {/* Main Dashboard Grid */}
          <section className="dashboard-grid">
            {/* Recent Unassigned Tickets Card */}
            <Card className="dashboard-card">
              <div className="card-header"><h2>Recent Unassigned Tickets</h2><Link to="/tickets?status=Unassigned" className="view-all">View All</Link></div>
              <div className="card-body">
                <Table columns={ticketColumns} data={recentTickets} emptyStateMessage={<p className="no-data">No unassigned tickets found.</p>} tableClassName="dashboard-table" />
              </div>
            </Card>

            {/* My Assigned Tickets Card */}
              <Card className="dashboard-card">
                <div className="card-header"><h2>My Assigned Tickets</h2><Link to="/tickets?assigneeId=me&status=Assigned,In Progress" className="view-all">View All</Link></div>
                <div className="card-body">
                  <Table columns={ticketColumns} data={myTickets} emptyStateMessage={<p className="no-data">No tickets currently assigned to you.</p>} tableClassName="dashboard-table" />
                </div>
              </Card>

            {/* My Tasks Card */}
            <Card className="dashboard-card">
              <div className="card-header"><h2>My Tasks</h2><Link to="/tasks?assigneeId=me" className="view-all">View All</Link></div>
              <div className="card-body">
                  <Table columns={taskColumns} data={myTasks} emptyStateMessage={<p className="no-data">You have no assigned tasks.</p>} tableClassName="dashboard-table" />
              </div>
            </Card>

            {/* Quick Actions Card */}
            <Card className="dashboard-card">
              <div className="card-header"><h2>Quick Actions</h2></div>
              <div className="card-body">
                <div className="quick-actions">
                    <Link to="/tickets/new" className="action-button"> <TicketIcon size={24} className="icon" /><span>Create Ticket</span></Link>
                    <Link to="/tasks/new" className="action-button"> <ListTodo size={24} className="icon" /><span>Create Task</span></Link>
                </div>
              </div>
            </Card>
          </section>
        </>
    </div>
  );
};

export default DashboardPage;
