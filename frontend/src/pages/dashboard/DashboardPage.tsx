// src/pages/dashboard/DashboardPage.tsx
// ==========================================================================
// Component representing the main dashboard view for authenticated users.
// Displays key statistics, recent tickets, assigned tickets, tasks, etc.
// **REVISED**: Use correct snake_case properties (created_at, due_date) in table columns.
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
  const { user, loading: authLoading } = useAuth();

  // --- State ---
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentTickets, setRecentTickets] = useState<Ticket[]>([]);
  const [myTickets, setMyTickets] = useState<Ticket[]>([]);
  const [myTasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // --- Data Fetching ---
  useEffect(() => {
    const loadDashboardData = async () => {
      if (!user || !user.id) {
          console.warn("[DashboardPage] User data not available yet for fetching dashboard stats.");
          setIsLoading(false);
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
          fetchTasks({ assigneeId: user.id, status: 'Open,In Progress', limit: 5, sortBy: 'dueDate', sortOrder: 'asc' }) // Note: sortBy uses camelCase for API param
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
        const recent = unassignedTicketsPromise.status === 'fulfilled' ? unassignedTicketsPromise.value.data : [];
        const assigned = assignedTicketsPromise.status === 'fulfilled' ? assignedTicketsPromise.value.data : [];
        const tasksData = myTasksPromise.status === 'fulfilled' ? myTasksPromise.value.data : [];

        setRecentTickets(recent);
        setMyTickets(assigned);
        setTasks(tasksData);

        console.log("[DashboardPage] Raw recentTickets data:", recent);
        console.log("[DashboardPage] Raw myTickets data:", assigned);


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
    if (!authLoading && user) {
        loadDashboardData();
    } else if (!authLoading && !user) {
        setIsLoading(false);
        // setError("User session not found. Please log in.");
    }
  }, [user, authLoading]);

  // --- Table Columns ---
  const ticketColumns: TableColumn<Ticket>[] = [
    { key: 'ticket_number', header: '#', render: (item) => <Link to={`/tickets/${item.id}`}>#{item.ticket_number}</Link> },
    { key: 'subject', header: 'Subject', render: (item) => <Link to={`/tickets/${item.id}`}>{truncateString(item.subject, 40)}</Link> },
    { key: 'status', header: 'Status', render: (item) => <Badge type={item.status.toLowerCase() as any}>{item.status}</Badge> },
    { key: 'urgency', header: 'Urgency', render: (item) => <Badge type={item.urgency.toLowerCase() as any}>{item.urgency}</Badge> },
    // ** FIX: Use item.created_at **
    { key: 'created_at', header: 'Created', render: (item) => {
        console.log(`[DashboardPage] Formatting date for ticket #${item.ticket_number}:`, item.created_at); // Log snake_case
        const formatted = formatDate(item.created_at); // Pass snake_case to function
        console.log(`[DashboardPage] -> Formatted date:`, formatted);
        return formatted;
      }
    },
  ];

  const taskColumns: TableColumn<Task>[] = [
       { key: 'task_number', header: '#', render: (item) => item.task_number },
       { key: 'title', header: 'Task', render: (item) => <Link to={`/tasks/${item.id}`}>{truncateString(item.title, 50)}</Link> },
       { key: 'status', header: 'Status', render: (item) => <Badge type={item.status === 'In Progress' ? 'progress' : item.status.toLowerCase() as any}>{item.status}</Badge> },
       // ** FIX: Use item.due_date **
       { key: 'due_date', header: 'Due Date', render: (item) => item.due_date ? formatDate(item.due_date) : 'N/A' },
    ];

  // --- Render ---
  if (authLoading || isLoading) {
    return <Loader text="Loading dashboard..." />;
  }
  if (error) {
    return <Alert type="error" message={error} />;
  }
  if (!stats) {
      return <Alert type="info" message="No dashboard data to display." />;
  }

  return (
    <div className="dashboard-page">
      {/* Page Header */}
      <div className="page-header">
        <h1>Dashboard</h1>
        {user && user.name && <p>Welcome back, {user.name}!</p>}
      </div>

      {/* Dashboard Content */}
      <>
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
