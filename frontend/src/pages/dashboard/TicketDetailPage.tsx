// src/pages/dashboard/TicketDetailPage.tsx
// ==========================================================================
// Component representing the page for viewing and managing a single ticket.
// Displays ticket details, updates, attachments, and allows actions.
// **REVISED**: Added explicit null checks to satisfy TypeScript.
// ==========================================================================

import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTickets } from '../../context/TicketContext';
import { useAuth } from '../../hooks/useAuth';
import TicketCard from '../../components/tickets/TicketCard';
import TicketStatusForm from '../../components/forms/TicketStatusForm';
import TicketCommentForm from '../../components/forms/TicketCommentForm';
import Loader from '../../components/common/Loader';
import Alert from '../../components/common/Alert';
import { fetchUsers } from '../../services/userService';
import { User, TicketUpdate } from '../../types';


const TicketDetailPage: React.FC = () => {
  // --- Hooks & Params ---
  const { ticketId } = useParams<{ ticketId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    currentTicket,
    isLoading,
    error,
    fetchTicketById,
    updateTicket,
    refreshCurrentTicket,
    clearError
  } = useTickets();

  // --- State ---
  const [assignableUsers, setAssignableUsers] = React.useState<Pick<User, 'id' | 'name'>[]>([]);

  // --- Debugging Log ---
  console.log(`[TicketDetailPage] Component rendered. ID from useParams: ${ticketId}`);

  // --- Effects ---
  useEffect(() => {
    console.log(`[TicketDetailPage] useEffect running. ID dependency: ${ticketId}`);
    if (ticketId) {
      console.log(`[TicketDetailPage] Calling fetchTicketById with ID: ${ticketId}`);
      fetchTicketById(ticketId)
        .then(ticket => {
          console.log(`[TicketDetailPage] fetchTicketById promise resolved. Ticket received (or null):`, ticket);
        })
        .catch(err => {
          console.error('[TicketDetailPage] fetchTicketById promise rejected:', err);
        });
    } else {
        console.warn('[TicketDetailPage] useEffect ran but ID is missing.');
    }
    return () => {
      console.log('[TicketDetailPage] Cleanup effect running.');
      clearError();
    };
  }, [ticketId, fetchTicketById, clearError]);

  React.useEffect(() => {
    console.log('[TicketDetailPage] Fetching assignable users...');
    fetchUsers({ role: 'Admin,Staff', limit: 100 })
      .then(res => {
        console.log('[TicketDetailPage] Assignable users fetched:', res.data);
        setAssignableUsers(res.data.map(u => ({ id: u.id, name: u.name })));
      })
      .catch(err => console.error('[TicketDetailPage] Failed to load assignable users:', err));
  }, []);

  // --- Handlers ---
  const handleTicketUpdate = async (update: any) => {
    if (!ticketId) return;
    console.log(`[TicketDetailPage] handleTicketUpdate called with ID: ${ticketId}, Update:`, update);
    const success = await updateTicket(ticketId, update);
    if (success) {
      console.log(`[TicketDetailPage] Ticket update successful for ticketId: ${ticketId}`);
    } else {
      console.error(`[TicketDetailPage] Ticket update failed for ticketId: ${ticketId}`);
    }
  };

  const handleCommentAdded = (newUpdate: TicketUpdate) => {
    console.log('[TicketDetailPage] handleCommentAdded called. Refreshing ticket data. New update:', newUpdate);
    refreshCurrentTicket();
  };

  // --- Render Logic ---
  console.log(`[TicketDetailPage] Rendering. isLoading=${isLoading}, error=${error}, currentTicket ID=${currentTicket?.id}`);

  // 1. Handle Loading State (especially initial load where currentTicket is null)
  if (isLoading && !currentTicket) {
    console.log('[TicketDetailPage] Rendering Loader (initial load)');
    return <Loader />;
  }

  // 2. Handle Error State
  if (error) {
    console.log(`[TicketDetailPage] Rendering Alert for error: ${error}`);
    return <Alert type="error" message={error} />;
  }

  // 3. Handle Not Found State (explicitly check for null *after* loading/error)
  //    This check guarantees currentTicket is non-null for the code below.
  if (!currentTicket) {
    console.warn(`[TicketDetailPage] Rendering 'Ticket not found'. isLoading=${isLoading}, error=${error}, currentTicket is null.`);
    return <Alert type="error" message="Ticket not found" />;
  }

  // --- Render Main Content (currentTicket is guaranteed non-null here) ---
  console.log('[TicketDetailPage] Rendering ticket details for ID:', currentTicket.id);
  return (
    <div className="ticket-detail-page">
      <div className="page-header">
        {/* Safe to access properties now */}
        <h1>Ticket #{currentTicket.ticketNumber}</h1>
        <button
          className="btn btn-secondary"
          onClick={() => navigate('/dashboard/tickets')}
        >
          Back to Tickets
        </button>
      </div>

      <div className="ticket-detail-content">
        <div className="ticket-info-section">
          {/* Passing non-null currentTicket */}
          <TicketCard ticket={currentTicket} />
        </div>

        <div className="ticket-actions-section">
          <div className="card">
            <div className="card-header">
              <h3>Ticket Management</h3>
            </div>
            <div className="card-body">
              {/* Passing non-null currentTicket */}
              <TicketStatusForm
                ticket={currentTicket}
                assignableUsers={assignableUsers}
                onUpdateSuccess={handleTicketUpdate}
                onCancel={() => {}}
              />
            </div>
          </div>
        </div>

        <div className="ticket-comments-section">
          <div className="card">
            <div className="card-header">
              <h3>Comments & Updates</h3>
            </div>
            <div className="card-body">
              <div className="update-history">
                {/* Safe to access properties now */}
                {currentTicket.updates && currentTicket.updates.length > 0 ? (
                  currentTicket.updates.map((update) => (
                    <div key={update.id} className={`update-item ${update.isInternalNote ? 'internal-note' : ''}`}>
                      <div className="update-header">
                        {/* Optional chaining still good practice for nested user */}
                        <span className="update-author">{update.user?.name || 'System'}</span>
                        <span className="update-time">
                          {new Date(update.createdAt).toLocaleString()}
                        </span>
                        {update.isInternalNote && (
                          <span className="internal-badge">Internal Note</span>
                        )}
                      </div>
                      <div className="update-content">{update.comment}</div>
                    </div>
                  ))
                ) : (
                  <p className="no-updates">No comments or updates yet.</p>
                )}
              </div>
              {/* Ensure id exists before rendering comment form */}
              {ticketId && <TicketCommentForm ticketId={ticketId} onCommentAdded={handleCommentAdded} onCancel={() => {}} />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TicketDetailPage;