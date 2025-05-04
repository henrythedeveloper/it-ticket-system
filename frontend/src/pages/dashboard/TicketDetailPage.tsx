// src/pages/dashboard/TicketDetailPage.tsx
// ==========================================================================
// Component representing the page for viewing and managing a single ticket.
// Displays ticket details, updates, attachments, and allows actions.
// **REVISED**: Reordered attachment sections: Admin/Staff now above Submitter
//              within the main ticket card area. Upload moved accordingly.
// **REVISED**: Added sidebar-card class to attachment upload container.
// **REVISED**: Adjusted renderAttachmentItem for better filename display.
// ==========================================================================

import React, { useEffect, useState } from 'react';
import AttachmentUpload from '../../components/forms/AttachmentUpload'; // Import AttachmentUpload
import { useParams, useNavigate } from 'react-router-dom';
import { useTickets } from '../../context/TicketContext';
import TicketCard from '../../components/tickets/TicketCard';
import TicketStatusForm from '../../components/forms/TicketStatusForm';
import TicketCommentForm from '../../components/forms/TicketCommentForm';
import Loader from '../../components/common/Loader';
import Alert from '../../components/common/Alert';
import Modal from '../../components/common/Modal'; // Import Modal component
import { fetchUsers } from '../../services/userService';
import { User, TicketUpdate, Ticket, TicketAttachment } from '../../types';
import { Download, Trash2, Paperclip } from 'lucide-react'; // Import icons
import { formatBytes } from '../../utils/helpers'; // Import helper

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
  const [assignableUsers, setAssignableUsers] = useState<Pick<User, 'id' | 'name'>[]>([]);
  const [previewAttachment, setPreviewAttachment] = useState<TicketAttachment | null>(null); // State for modal content
  const [hoveredAttachmentId, setHoveredAttachmentId] = useState<string | null>(null); // State for hover preview

  // --- Effects ---
  useEffect(() => {
    if (ticketId) {
      fetchTicketById(ticketId);
    }
  }, [ticketId, fetchTicketById]);

  useEffect(() => {
    fetchUsers({ role: 'Admin,Staff', limit: 100 })
      .then(res => setAssignableUsers(res.data.map(u => ({ id: u.id, name: u.name }))))
      .catch(err => console.error('[TicketDetailPage] Failed to load assignable users:', err));
  }, []);

  // --- Handlers ---
  const handleTicketUpdate = (updatedTicketData: Partial<Ticket> & { assignedToUserId?: string | null }) => {
    let fullUpdatedTicket: Ticket = { ...currentTicket, ...updatedTicketData } as Ticket;
    if (updatedTicketData.assignedToUserId) {
      const assignedUser = assignableUsers.find(u => u.id === updatedTicketData.assignedToUserId);
      fullUpdatedTicket.assignedTo = assignedUser || null;
    } else if (updatedTicketData.hasOwnProperty('assignedToUserId')) {
      fullUpdatedTicket.assignedTo = null;
      fullUpdatedTicket.assignedToUserId = null;
    }
    const success: boolean = updateTicket(fullUpdatedTicket);
    if (success) refreshCurrentTicket();
  };

  const handleCommentAdded = (newUpdate: TicketUpdate) => {
    refreshCurrentTicket();
  };

  // --- Attachment Handlers ---
  const handleAttachmentClick = (attachment: TicketAttachment) => {
    if (attachment.mimeType.startsWith('image/')) {
      setPreviewAttachment(attachment); // Set attachment for modal view
    } else {
      // Directly download non-image files
      window.open(attachment.url, '_blank');
    }
  };

  const closePreviewModal = () => {
    setPreviewAttachment(null); // Clear attachment to close modal
  };

  const handleAttachmentMouseEnter = (attachment: TicketAttachment) => {
    if (attachment.mimeType.startsWith('image/')) {
        setHoveredAttachmentId(attachment.id); // Set ID to show hover preview
    }
  };

  const handleAttachmentMouseLeave = () => {
    setHoveredAttachmentId(null); // Clear ID to hide hover preview
  };

  const handleAttachmentDelete = async (attachmentId: string) => {
    if (!currentTicket) return;
    if (window.confirm("Are you sure you want to delete this attachment?")) {
      try {
        // TODO: Replace with actual API call: await deleteTicketAttachment(currentTicket.id, attachmentId);
        console.log(`Simulating delete for attachment ${attachmentId} on ticket ${currentTicket.id}`);
        alert(`Attachment ${attachmentId} deletion simulated. Implement API call.`);
        await refreshCurrentTicket(); // Refresh ticket data after deletion
      } catch (error) {
        console.error("Failed to delete attachment:", error);
        alert("Failed to delete attachment.");
      }
    }
  };

  // --- Render Logic ---
  if (isLoading && !currentTicket) return <Loader />;
  if (error) return <Alert type="error" message={error} />;
  if (!currentTicket) return <Alert type="error" message="Ticket not found" />;

  console.log("TicketDetailPage: Raw attachments:", currentTicket.attachments);

  // Group attachments
  const attachments = currentTicket.attachments || [];
  const adminStaffAttachments = attachments.filter(
    (a) => a.uploadedByRole === 'Admin' || a.uploadedByRole === 'Staff'
  );
  const submitterAttachments = attachments.filter(
    (a) => a.uploadedByRole !== 'Admin' && a.uploadedByRole !== 'Staff'
  );


  // --- Reusable Attachment Item Renderer ---
  const renderAttachmentItem = (att: TicketAttachment) => {
      const isImage = att.mimeType.startsWith('image/');
      return (
        <li
          key={att.id}
          className="attachment-item" // Ensure you have styles for this class
          onMouseEnter={() => handleAttachmentMouseEnter(att)}
          onMouseLeave={handleAttachmentMouseLeave}
        >
          {/* Container for Icon/Thumb + Filename */}
          <div className="attachment-info">
            {isImage ? (
              <img
                src={att.url} // Use URL directly for thumbnail
                alt={`Thumbnail for ${att.filename}`}
                className="attachment-thumbnail" // Style this class
                onClick={() => handleAttachmentClick(att)} // Open modal on image click
                style={{ cursor: 'pointer' }}
              />
            ) : (
              <Paperclip size={24} className="attachment-icon"/> // Icon for non-images
            )}
            {/* Display filename next to icon/thumb */}
            <span className="attachment-filename" title={att.filename}>{att.filename}</span>
          </div>

          {/* Container for Size + Actions */}
          <div className="attachment-meta">
            <span className="attachment-size">({formatBytes(att.size)})</span>
            <div className="attachment-actions">
              {/* Download button always available */}
              <a href={att.url} target="_blank" rel="noopener noreferrer" title="Download Attachment">
                <Download size={16} className="download-icon-btn" />
              </a>
              {/* Delete button - show based on permissions if needed */}
              {/* TODO: Add permission check here (e.g., if user is Admin/Staff) */}
              <button
                onClick={() => handleAttachmentDelete(att.id)}
                className="delete-icon-btn"
                title="Delete Attachment"
                // disabled={isDeleting} // Add state for disabling during delete
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>

          {/* Hover Preview (only for images) */}
          {isImage && hoveredAttachmentId === att.id && (
            <div className="attachment-hover-preview"> {/* Style this class */}
              <img src={att.url} alt={`Preview of ${att.filename}`} />
            </div>
          )}
        </li>
      );
  };

  // --- Main Component Render ---
  return (
    <div className="ticket-detail-page">
      <div className="page-header">
        <h1>Ticket #{currentTicket.ticketNumber}</h1>
        <button className="btn btn-secondary" onClick={() => navigate('/tickets')}>
          Back to Tickets
        </button>
      </div>

      <div className="ticket-grid">
        {/* --- Main Content Area --- */}
        <div className="ticket-main">
          {/* Ticket Info Card - Contains Ticket Details AND Attachments */}
          <div className="ticket-card">
            {/* Core Ticket Details */}
            <TicketCard ticket={currentTicket} />

            {/* --- START: Attachment Sections (Reordered and inside ticket-card) --- */}

            {/* Admin/Staff Attachments - DISPLAYED FIRST */}
            <div className="ticket-attachments"> {/* Use common class */}
              <h3>Admin/Staff Attachments</h3>
              {adminStaffAttachments.length > 0 ? (
                <ul className="attachment-list"> {/* Use common class */}
                  {adminStaffAttachments.map(renderAttachmentItem)}
                </ul>
              ) : (
                <p className="no-attachments">No attachments from admin or staff.</p>
              )}
            </div>

            {/* Submitter Attachments - DISPLAYED SECOND */}
            <div className="ticket-attachments"> {/* Use common class */}
              <h3>Submitter Attachments</h3>
              {submitterAttachments.length > 0 ? (
                <ul className="attachment-list"> {/* Use common class */}
                  {submitterAttachments.map(renderAttachmentItem)}
                </ul>
              ) : (
                <p className="no-attachments">No attachments from submitter.</p>
              )}
            </div>

            {/* Resolution Notes Section */}
            {currentTicket.resolutionNotes && (
                <div className="resolution-notes">
                    <h3>Resolution Notes</h3>
                    <p>{currentTicket.resolutionNotes}</p>
                </div>
            )}

            {/* --- END: Attachment Sections --- */}
          </div> {/* End .ticket-card */}

          {/* Comments/Updates Section (Remains outside ticket-card but in ticket-main) */}
          <div className="ticket-updates">
            <div className="updates-header">
              <h3>Comments & Updates</h3>
            </div>
            <div className="updates-timeline">
              {currentTicket.updates && currentTicket.updates.length > 0 ? (
                currentTicket.updates.map((update) => (
                  <div
                    key={update.id}
                    className={`update-item${update.isInternalNote ? ' internal-note' : ''} ${update.isSystemUpdate ? 'system-update' : ''}`}
                  >
                    <div className="update-header">
                      <span className="update-author">
                        <strong>{update.user?.name || 'System'}</strong>
                        {update.isInternalNote && <span className="internal-badge">Internal</span>}
                      </span>
                      <span className="update-time">
                        {new Date(update.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <div className="update-content">{update.comment}</div>
                  </div>
                ))
              ) : (
                <p className="no-updates">No comments or updates yet.</p>
              )}
            </div>
            {/* Comment Form */}
            {ticketId && (
              <div className="comment-form-container">
                <h4>Add Comment / Note</h4>
                <TicketCommentForm
                  ticketId={ticketId}
                  onCommentAdded={handleCommentAdded}
                  onCancel={() => {}}
                />
              </div>
            )}
          </div> {/* End .ticket-updates */}
        </div> {/* End .ticket-main */}

        {/* --- Sidebar Area (Only Ticket Management now) --- */}
        <div className="ticket-sidebar">
          {/* Ticket Management Card */}
          <div className="sidebar-card">
            <h3>Ticket Management</h3>
            <TicketStatusForm
              ticket={currentTicket}
              assignableUsers={assignableUsers}
              onUpdateSuccess={handleTicketUpdate}
              onCancel={() => {}}
            />
          </div>
          {/* Upload Form for Admin/Staff - Moved here */}
          {ticketId && (
                // Add sidebar-card class here for card styling
                <div className="sidebar-card attachment-upload-form-container">
                  <h4>Upload New Attachment</h4>
                  <AttachmentUpload
                    uploadUrl={`tickets/${currentTicket.id}/attachments`}
                    onUploadSuccess={refreshCurrentTicket}
                    buttonLabel="Upload File"
                  />
                </div>
              )}
        </div> {/* End .ticket-sidebar */}
      </div> {/* End .ticket-grid */}

      {/* Image Preview Modal */}
      <Modal
        isOpen={!!previewAttachment}
        onClose={closePreviewModal}
        title={`Preview: ${previewAttachment?.filename ?? 'Attachment'}`}
        className="image-preview-modal"
      >
        {previewAttachment && (
          <img
            src={previewAttachment.url}
            alt={`Preview of ${previewAttachment.filename}`}
            style={{ maxWidth: '100%', maxHeight: '80vh', display: 'block', margin: '0 auto' }}
          />
        )}
      </Modal>
    </div>
  );
};

export default TicketDetailPage;
