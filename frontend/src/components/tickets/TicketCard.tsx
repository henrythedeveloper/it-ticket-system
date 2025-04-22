// src/components/tickets/TicketCard.tsx
// ==========================================================================
// Component for displaying a summary of a ticket in a list format.
// Used on dashboard and ticket list pages.
// Fixed missing import for formatDateTime.
// ==========================================================================

import React from 'react';
import { Link } from 'react-router-dom';
import Badge from '../common/Badge'; // Reusable Badge component
import { Ticket } from '../../types'; // Ticket type definition
// FIX: Import both formatDate and formatDateTime
import { formatDate, formatDateTime, truncateString } from '../../utils/helpers';

// --- Component Props ---

/**
 * Props for the TicketCard component.
 */
interface TicketCardProps {
  /** The ticket data object to display. */
  ticket: Ticket;
}

// --- Component ---

/**
 * Renders a card displaying a summary of a ticket.
 * Includes subject, status, urgency, assignee, date, and a link to the detail view.
 *
 * @param {TicketCardProps} props - The component props.
 * @returns {React.ReactElement} The rendered TicketCard component.
 */
const TicketCard: React.FC<TicketCardProps> = ({ ticket }) => {
  // --- Render ---
  // Assumes SCSS file (_TicketCard.scss) defines the card styles
  return (
    <article className="ticket-card">
      {/* Card Header: Badges and Ticket ID */}
      <header className="ticket-header">
        <div className="ticket-badges">
          <Badge type={ticket.status.toLowerCase() as any} title={`Status: ${ticket.status}`}>
            {ticket.status}
          </Badge>
          <Badge type={ticket.urgency.toLowerCase() as any} title={`Urgency: ${ticket.urgency}`}>
            {ticket.urgency}
          </Badge>
        </div>
        <span className="ticket-id" title={`Ticket ID: ${ticket.id}`}>
          #{ticket.id.substring(0, 8)}...
        </span>
      </header>

      {/* Ticket Title (Link to Detail Page) */}
      <Link to={`/tickets/${ticket.id}`} className="ticket-title">
        {ticket.subject}
      </Link>

      {/* Metadata: Submitter and Creation Date */}
      <div className="ticket-meta">
          <div> {/* Group submitter info */}
              <span className="meta-label">Submitter:</span>
              <span className="meta-value">{ticket.submitter.name}</span>
          </div>
          <div> {/* Group creation date */}
            <span className="meta-label">Created:</span>
            {/* Use formatDateTime for tooltip, formatDate for display */}
            <span className="meta-value" title={formatDateTime(ticket.createdAt)}>
                {formatDate(ticket.createdAt)}
            </span>
          </div>
      </div>

      {/* Assignment Information */}
      <div className="ticket-assignment">
          <span className="meta-label">Assigned To:</span>
          <span className="meta-value">{ticket.assignedTo?.name || 'Unassigned'}</span>
      </div>

      {/* Optional: Description Excerpt */}
      {ticket.description && (
        <p className="ticket-excerpt">
          {truncateString(ticket.description, 100)} {/* Truncate long descriptions */}
        </p>
      )}

      {/* Optional: Tags */}
      {ticket.tags && ticket.tags.length > 0 && (
        <div className="ticket-tags">
          {ticket.tags.map(tag => <span key={tag} className="tag">{tag}</span>)}
        </div>
      )}

      {/* Footer Action: View Ticket Button (Optional) */}
      {/* <footer className="ticket-footer">
          <Link to={`/tickets/${ticket.id}`} className="view-ticket-btn">
            View Details
          </Link>
      </footer> */}
    </article>
  );
};

export default TicketCard;
