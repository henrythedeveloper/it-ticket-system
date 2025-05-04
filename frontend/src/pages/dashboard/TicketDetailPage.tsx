// src/pages/dashboard/TicketDetailPage.tsx
// ==========================================================================
// Component representing the page for viewing and managing a single ticket.
// Displays ticket details, updates, attachments, and allows actions.
// **REVISED**: Added explicit null checks to satisfy TypeScript.
// ==========================================================================

import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTickets } from '../../context/TicketContext';
import TicketCard from '../../components/tickets/TicketCard';
import TicketStatusForm from '../../components/forms/TicketStatusForm';
import TicketCommentForm from '../../components/forms/TicketCommentForm';
import Loader from '../../components/common/Loader';
import Alert from '../../components/common/Alert';
import { fetchUsers } from '../../services/userService';
import { User, TicketUpdate, Ticket } from '../../types';

const TicketDetailPage: React.FC = () => {
  // --- Hooks & Params ---
  const { ticketId } = useParams<{ ticketId: string }>();
  const navigate = useNavigate();
  const {
    currentTicket,
    isLoading,
    error,
    fetchTicketById,
    updateTicket,
    refreshCurrentTicket,
  } = useTickets();

  // --- State ---
  const [assignableUsers, setAssignableUsers] = React.useState<Pick<User, 'id' | 'name'>[]>([]);

  // --- Debugging Log ---
  console.log(`[TicketDetailPage] Component rendered. ID from useParams: ${ticketId}`);

  // --- Effects ---
  useEffect(() => {
    console.log(`[TicketDetailPage] useEffect running. ID dependency: ${ticketId}`);

    if (ticketId && (!currentTicket || currentTicket.id !== ticketId)) {
      console.log(`[TicketDetailPage] Calling fetchTicketById with ID: ${ticketId} because currentTicket is mismatched or null.`);
      fetchTicketById(ticketId)
        .then(ticket => {
          console.log(`[TicketDetailPage] fetchTicketById promise resolved. Ticket received (or null):`, ticket);
        })
        .catch(err => {
          console.error('[TicketDetailPage] fetchTicketById promise rejected:', err);
        });
    } else if (ticketId && currentTicket && currentTicket.id === ticketId) {
        console.log(`[TicketDetailPage] Skipping fetch because currentTicket already matches ticketId (${ticketId}).`);
    } else {
      console.warn('[TicketDetailPage] useEffect ran but ID is missing or condition not met.');
    }
  }, [ticketId, currentTicket, fetchTicketById]);


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
  const handleTicketUpdate = (updatedTicketData: Partial<Ticket> & { assignedToUserId?: string | null }) => { // Expect potential assignedToUserId
    console.log(`[TicketDetailPage] handleTicketUpdate called. Received updated ticket data:`, updatedTicketData);

    // --- ADD THIS LOGIC ---
    // Reconstruct the assignedTo object based on the ID and the assignableUsers list
    let fullUpdatedTicket: Ticket = { ...currentTicket, ...updatedTicketData } as Ticket; // Start with current + updates

    if (updatedTicketData.assignedToUserId) {
        // Find the user object from the list fetched earlier
        const assignedUser = assignableUsers.find(u => u.id === updatedTicketData.assignedToUserId);
        if (assignedUser) {
            fullUpdatedTicket.assignedTo = assignedUser; // Set the nested object
        } else {
            // User ID present but not found in the list (edge case?)
            console.warn(`Assignee with ID ${updatedTicketData.assignedToUserId} not found in assignableUsers list.`);
// Debug: Log assignableUsers and assignedToUserId for troubleshooting
            console.error(
              '[TicketDetailPage] Assignee not found in assignableUsers!',
              { assignedToUserId: updatedTicketData.assignedToUserId, assignableUsers }
            );
            // Keep assignedTo as null or handle appropriately
             fullUpdatedTicket.assignedTo = null;
        }
    } else if (updatedTicketData.hasOwnProperty('assignedToUserId')) { // Check if the property exists, even if null/undefined
         // Explicitly set to unassigned
// Refresh ticket data to ensure UI is up-to-date
    refreshCurrentTicket();
         fullUpdatedTicket.assignedTo = null;
         fullUpdatedTicket.assignedToUserId = null; // Also clear the ID field
    }
    // Remove the potentially temporary assignedToUserId property if it exists at the top level
    // delete fullUpdatedTicket.assignedToUserId; // This might cause issues if Ticket type expects it. Check your type. Assuming Ticket type has both assignedTo and assignedToUserId.

    console.log(`[TicketDetailPage] handleTicketUpdate: Reconstructed ticket object for context:`, fullUpdatedTicket);
    // --- END ADDED LOGIC ---

    // Pass the *reconstructed* ticket object to the context update function
    const success: boolean = updateTicket(fullUpdatedTicket);

    if (success) {
      console.log(`[TicketDetailPage] Context state updated successfully for ticket ID: ${fullUpdatedTicket.id}`);
      // Ensure UI is in sync by re-fetching the ticket from backend
      refreshCurrentTicket();
    } else {
      console.error(`[TicketDetailPage] Failed to update context state for ticket ID: ${fullUpdatedTicket.id}`);
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
        <h1>Ticket #{currentTicket.ticketNumber}</h1>
        <button
          className="btn btn-secondary"
          onClick={() => navigate('/tickets')}
        >
          Back to Tickets
        </button>
      </div>

      <div className="ticket-grid">
        <div className="ticket-main">
          <div className="ticket-card">
            <TicketCard ticket={currentTicket} />
          </div>
          <div className="ticket-updates">
            <div className="updates-header">
              <h3>Comments & Updates</h3>
            </div>
            <div className="updates-timeline">
              {currentTicket.updates && currentTicket.updates.length > 0 ? (
                currentTicket.updates.map((update) => (
                  <div
                    key={update.id}
                    className={`update-item${update.isInternalNote ? ' internal-note' : ''}`}
                  >
                    <div className="update-header">
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
            {ticketId && (
              <div className="comment-form-container">
                <TicketCommentForm
                  ticketId={ticketId}
                  onCommentAdded={handleCommentAdded}
                  onCancel={() => {}}
                />
              </div>
            )}
          </div>
        </div>
        <div className="ticket-sidebar">
          <div className="sidebar-card">
            <h3>Ticket Management</h3>
            <TicketStatusForm
              ticket={currentTicket}
              assignableUsers={assignableUsers}
              onUpdateSuccess={handleTicketUpdate}
              onCancel={() => {}}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default TicketDetailPage;