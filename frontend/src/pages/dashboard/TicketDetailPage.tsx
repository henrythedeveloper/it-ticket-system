// src/pages/dashboard/TicketDetailPage.tsx
// ==========================================================================
// Component representing the page for viewing and managing a single ticket.
// Displays ticket details, updates, attachments, and allows actions.
// **REVISED**: Updated to use centralized TicketContext for state management.
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
  const { id } = useParams<{ id: string }>();
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

  const [assignableUsers, setAssignableUsers] = React.useState<Pick<User, 'id' | 'name'>[]>([]);

  useEffect(() => {
    // Fetch ticket data when component mounts or ID changes
    if (id) {
      fetchTicketById(id).catch(err => {
        console.error('Failed to fetch ticket:', err);
      });
    }

    // Cleanup
    return () => {
      clearError();
    };
  }, [id, fetchTicketById, clearError]);

  React.useEffect(() => {
    // Fetch assignable users (Admin/Staff)
    fetchUsers({ role: 'Admin,Staff', limit: 100 })
      .then(res => setAssignableUsers(res.data.map(u => ({ id: u.id, name: u.name }))))
      .catch(err => console.error('Failed to load assignable users:', err));
  }, []);

  // Handle status/assignment updates
  const handleTicketUpdate = async (update: any) => {
    if (!id) return;
    
    const success = await updateTicket(id, update);
    if (success) {
      // Ticket updated successfully
    }
  };

  // Handle adding a comment (now matches TicketCommentForm signature)
  const handleCommentAdded = (newUpdate: TicketUpdate) => {
    refreshCurrentTicket();
  };

  if (isLoading && !currentTicket) {
    return <Loader />;
  }

  if (error) {
    return <Alert type="error" message={error} />;
  }

  if (!currentTicket) {
    return <Alert type="error" message="Ticket not found" />;
  }

  return (
    <div className="ticket-detail-page">
      <div className="page-header">
        <h1>Ticket #{currentTicket.ticket_number}</h1>
        <button
          className="btn btn-secondary"
          onClick={() => navigate('/dashboard/tickets')}
        >
          Back to Tickets
        </button>
      </div>

      <div className="ticket-detail-content">
        <div className="ticket-info-section">
          <TicketCard ticket={currentTicket} />
        </div>

        <div className="ticket-actions-section">
          <div className="card">
            <div className="card-header">
              <h3>Ticket Management</h3>
            </div>
            <div className="card-body">
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
                {currentTicket.updates && currentTicket.updates.length > 0 ? (
                  currentTicket.updates.map((update) => (
                    <div key={update.id} className={`update-item ${update.is_internal_note ? 'internal-note' : ''}`}>
                      <div className="update-header">
                        <span className="update-author">{update.user?.name || 'System'}</span>
                        <span className="update-time">
                          {new Date(update.created_at).toLocaleString()}
                        </span>
                        {update.is_internal_note && (
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

              <TicketCommentForm ticketId={id!} onCommentAdded={handleCommentAdded} onCancel={() => {}} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TicketDetailPage;
