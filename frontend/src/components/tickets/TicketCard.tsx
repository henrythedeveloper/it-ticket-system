import React from 'react';
import { Link } from 'react-router-dom';
import { Ticket } from '../../types/models';

interface TicketCardProps {
  ticket: Ticket;
}

const TicketCard: React.FC<TicketCardProps> = ({ ticket }) => {
  // Helper function to determine urgency class
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
  
  // Helper function to determine status class
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
  
  // Format the date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };
  
  // Truncate text to a certain length
  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  return (
    <div className="ticket-card">
      <div className="ticket-header">
        <div className="ticket-badges">
          <span className={`status-badge ${getStatusClass(ticket.status)}`}>
            {ticket.status}
          </span>
          <span className={`urgency-badge ${getUrgencyClass(ticket.urgency)}`}>
            {ticket.urgency}
          </span>
        </div>
        <div className="ticket-id">
          #{ticket.ticket_number}
        </div>
      </div>
      
      <Link to={`/tickets/${ticket.id}`} className="ticket-title">
        {truncateText(ticket.subject, 60)}
      </Link>
      
      <div className="ticket-meta">
        <div className="ticket-submitter">
          <span className="meta-label">From:</span>
          <span className="meta-value">{ticket.end_user_email}</span>
        </div>
        <div className="ticket-date">
          <span className="meta-label">Created:</span>
          <span className="meta-value">{formatDate(ticket.created_at)}</span>
        </div>
      </div>
      
      <div className="ticket-assignment">
        <span className="meta-label">Assigned to:</span>
        <span className="meta-value">
          {ticket.assigned_to_user ? ticket.assigned_to_user.name : 'Unassigned'}
        </span>
      </div>
      
      <p className="ticket-excerpt">
        {truncateText(ticket.body, 120)}
      </p>
      
      {ticket.tags && ticket.tags.length > 0 && (
        <div className="ticket-tags">
          {ticket.tags.map(tag => (
            <span key={tag.id} className="tag">{tag.name}</span>
          ))}
        </div>
      )}
      
      <Link to={`/tickets/${ticket.id}`} className="view-ticket-btn">
        View Ticket
      </Link>
    </div>
  );
};

export default TicketCard;