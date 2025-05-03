// src/pages/dashboard/DashboardPage.tsx
// ==========================================================================
// Component representing the main dashboard page.
// Displays overview statistics and recent tickets.
// **SIMPLIFIED**: Removed task-related sections and streamlined dashboard.
// ==========================================================================

import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Loader from '../../components/common/Loader';
import Alert from '../../components/common/Alert';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Table, { TableColumn } from '../../components/common/Table';
import { useAuth } from '../../hooks/useAuth';
import { fetchTickets } from '../../services/ticketService';
import { Ticket, DashboardStats } from '../../types';
import { formatDate, truncateString } from '../../utils/helpers';

// --- Component ---
const DashboardPage: React.FC = () => {
  // --- Hooks ---
  const { user, loading: authLoading } = useAuth();

  // --- State ---
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentTickets, setRecentTickets] = useState<Ticket[]>([]);
  const [myTickets, setMyTickets] = useState<Ticket[]>([]);
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
        // Fetch tickets in parallel for better performance
        const [
          unassignedTicketsPromise,
          assignedTicketsPromise,
          inProgressTicketsPromise,
          myOpenTicketsPromise
        ] = await Promise.allSettled([
          // Unassigned tickets
          fetchTickets({ status: 'Unassigned', limit: 5, page: 1 }),
          // Tickets assigned to current user
          fetchTickets({ assigned_to: user.id, limit: 5, page: 1 }),
          // Tickets in progress assigned to current user
          fetchTickets({ status: 'In Progress', assigned_to: user.id, limit: 5, page: 1 }),
          // Tickets submitted by current user that are still open
          fetchTickets({ submitter_id: user.id, status: 'Open,Assigned,In Progress', limit: 5, page: 1 }),
        ]);

        // Handle any failed promises
        const failedPromises = [unassignedTicketsPromise, assignedTicketsPromise, inProgressTicketsPromise, myOpenTicketsPromise].filter(p => p.status === 'rejected');
        if (failedPromises.length > 0) {
            console.error("Some dashboard data failed to load:", failedPromises);
            setError("Could not load all dashboard data.");
        }

        // Calculate dashboard statistics
        const calculatedStats = {
            unassigned: unassignedTicketsPromise.status === 'fulfilled' ? unassignedTicketsPromise.value.total : 0,
            assignedToMe: assignedTicketsPromise.status === 'fulfilled' ? assignedTicketsPromise.value.total : 0,
            inProgress: inProgressTicketsPromise.status === 'fulfilled' ? inProgressTicketsPromise.value.total : 0,
            myOpenTickets: myOpenTicketsPromise.status === 'fulfilled' ? myOpenTicketsPromise.value.total : 0,
        };
        setStats(calculatedStats);

        // Set ticket lists
        const recent = unassignedTicketsPromise.status === 'fulfilled' ? unassignedTicketsPromise.value.data : [];
        const assigned = assignedTicketsPromise.status === 'fulfilled' ? assignedTicketsPromise.value.data : [];

        setRecentTickets(recent);
        setMyTickets(assigned);

        console.log("[DashboardPage] Dashboard data loaded successfully");
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
    }
  }, [user, authLoading]);

  // --- Table Columns ---
  const ticketColumns: TableColumn<Ticket>[] = [
    { key: 'ticketNumber', header: '#', render: (item) => <Link to={`/tickets/${item.id}`}>#{item.ticketNumber}</Link> },
    { key: 'subject', header: 'Subject', render: (item) => <Link to={`/tickets/${item.id}`}>{truncateString(item.subject, 40)}</Link> },
    { key: 'status', header: 'Status', render: (item) => <Badge type={item.status?.toLowerCase() as any}>{item.status}</Badge> },
    { key: 'urgency', header: 'Urgency', render: (item) => <Badge type={item.urgency?.toLowerCase() as any}>{item.urgency}</Badge> },
    { key: 'createdAt', header: 'Created', render: (item) => formatDate(item.createdAt ?? item.createdAt) },
  ];

  // --- Render ---
  if (authLoading || isLoading) {
    return <Loader text="Loading dashboard..." />;
  }
  if (error) {
    return <Alert type="error" message={error} />;
  }

  return (
    <div className="dashboard-page">
      {/* Page Header */}
      <div className="page-header">
        <h1>Dashboard</h1>
        <div className="welcome-message">
          <p>Welcome back, <strong>{user?.name}</strong>!</p>
        </div>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <section className="stats-cards">
          <Link to="/tickets?status=Unassigned" className="stats-card">
                <div className="card-content"><h3>Unassigned</h3><p className="count">{stats.unassigned}</p></div><div className="card-action">View All</div>
          </Link>
          <Link to="/tickets?assigned_to=me" className="stats-card">
                <div className="card-content"><h3>Assigned To Me</h3><p className="count">{stats.assignedToMe}</p></div><div className="card-action">View All</div>
          </Link>
            <Link to="/tickets?assigned_to=me&status=In Progress" className="stats-card">
                <div className="card-content"><h3>My In Progress</h3><p className="count">{stats.inProgress}</p></div><div className="card-action">View All</div>
          </Link>
            <Link to="/tickets?submitter_id=me&status=Open,Assigned,In Progress" className="stats-card">
                <div className="card-content"><h3>My Open Tickets</h3><p className="count">{stats.myOpenTickets}</p></div><div className="card-action">View All</div>
          </Link>
        </section>
      )}

      {/* Main Dashboard Grid */}
      <section className="dashboard-grid">
        {/* Recent Unassigned Tickets Card */}
        <Card className="dashboard-card">
          <div className="card-header">
            <h2>Recent Unassigned Tickets</h2>
            <Link to="/tickets?status=Unassigned" className="view-all">View All</Link>
          </div>
          {recentTickets.length > 0 ? (
            <Table 
              columns={ticketColumns} 
              data={recentTickets} 
              tableClassName="dashboard-table"
            />
          ) : (
            <p className="no-data">No unassigned tickets available.</p>
          )}
        </Card>

        {/* My Assigned Tickets Card */}
        <Card className="dashboard-card">
          <div className="card-header">
            <h2>My Tickets</h2>
            <Link to="/tickets?assigned_to=me" className="view-all">View All</Link>
          </div>
          {myTickets.length > 0 ? (
            <Table 
              columns={ticketColumns} 
              data={myTickets} 
              tableClassName="dashboard-table"
            />
          ) : (
            <p className="no-data">No tickets are currently assigned to you.</p>
          )}
        </Card>
      </section>
    </div>
  );
};

export default DashboardPage;