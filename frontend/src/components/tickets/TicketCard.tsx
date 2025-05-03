// src/components/tickets/TicketCard.tsx
// ==========================================================================
// Component for displaying a summary of a ticket in a list format.
// Used on dashboard and ticket list pages.
// **REVISED**: Show ticket_number instead of ID.
// **REVISED AGAIN**: Display submitter_name if available.
// ==========================================================================

import React from 'react';
import { Link } from 'react-router-dom';
import Badge from '../common/Badge'; // Reusable Badge component
import { Ticket } from '../../types'; // Ticket type definition
import { formatDate, formatDateTime, truncateString } from '../../utils/helpers';

// --- Component Props ---
interface TicketCardProps {
  ticket: Ticket;
}

// --- Component ---
const TicketCard: React.FC<TicketCardProps> = ({ ticket }) => {
  // --- Render ---
  return (
    <article className="ticket-card">
      {/* Card Header: Badges and Ticket Number */}
      <header className="ticket-header">
        <div className="ticket-badges">
          <Badge type={ticket.status.toLowerCase() as any} title={`Status: ${ticket.status}`}>
            {ticket.status}
          </Badge>
          <Badge type={ticket.urgency.toLowerCase() as any} title={`Urgency: ${ticket.urgency}`}>
            {ticket.urgency}
          </Badge>
        </div>
        <span className="ticket-id" title={`Ticket #${ticket.id}`}>
          #{ticket.ticketNumber}
        </span>
      </header>

      {/* Ticket Title (Link to Detail Page) */}
      <Link to={`/tickets/${ticket.id}`} className="ticket-title">
        {ticket.subject}
      </Link>

      {/* Metadata: Submitter and Creation Date */}
      <div className="ticket-meta">
          {/* Display Submitter Name or Email */}
          <div>
            <span className="meta-label">Submitter:</span>
            {/* Prefer submitter_name, fallback to email */}
            <span className="meta-value">{ticket.submitterName}</span>
          </div>
          <div>
            <span className="meta-label">Created:</span>
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
          {truncateString(ticket.description, 100)}
        </p>
      )}

      {/* Optional: Tags */}
      {ticket.tags && ticket.tags.length > 0 && (
        <div className="ticket-tags">
          {ticket.tags.map(tag => <span key={tag.id} className="tag">{tag.name}</span>)}
        </div>
      )}

    </article>
  );
};

export default TicketCard;
