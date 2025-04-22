// src/pages/dashboard/TicketDetailPage.tsx
// ==========================================================================
// Component representing the page for viewing and managing a single ticket.
// Displays ticket details, updates, attachments, and allows actions.
// ==========================================================================

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Loader from '../../components/common/Loader';
import Card from '../../components/common/Card';
import Alert from '../../components/common/Alert';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal'; // For status update form
import TicketCommentForm from '../../components/forms/TicketCommentForm'; // Comment form
import TicketStatusForm from '../../components/forms/TicketStatusForm'; // Status update form
import { useAuth } from '../../hooks/useAuth'; // For user info and role checks
import { fetchTicketById, uploadTicketAttachment, deleteTicketAttachment } from '../../services/ticketService'; // Ticket API
import { fetchUsers } from '../../services/userService'; // User API for assignee list
import { Ticket, User, TicketUpdate } from '../../types'; // Import types
import { formatDateTime, formatBytes, getInitials } from '../../utils/helpers'; // Utility functions
import { ArrowLeft, Paperclip, Trash2, Image as ImageIcon, FileText, Download, Edit2 } from 'lucide-react'; // Icons

// --- Component ---

/**
 * Renders the Ticket Detail page, showing all information about a ticket
 * and allowing updates, comments, and status changes.
 */
const TicketDetailPage: React.FC = () => {
  // --- Hooks ---
  const { ticketId } = useParams<{ ticketId: string }>(); // Get ticket ID from URL
  const navigate = useNavigate();
  const { user } = useAuth(); // Get current user

  // --- State ---
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [assignableUsers, setAssignableUsers] = useState<Pick<User, 'id' | 'name'>[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showStatusModal, setShowStatusModal] = useState<boolean>(false);
  const [showCommentForm, setShowCommentForm] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [attachmentToDelete, setAttachmentToDelete] = useState<string | null>(null); // ID of attachment for delete confirmation
  const [isDeletingAttachment, setIsDeletingAttachment] = useState<boolean>(false);

  // --- Data Fetching ---
  /**
   * Fetches ticket details and assignable users.
   */
  const loadTicketData = useCallback(async () => {
    if (!ticketId) {
      setError("Ticket ID is missing.");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null); // Clear previous errors
    try {
      // Fetch ticket and users concurrently
      const [ticketData, usersData] = await Promise.all([
        fetchTicketById(ticketId),
        fetchUsers({ role: 'Admin,Staff', limit: 500 }) // Fetch users for assignee dropdown
      ]);
      setTicket(ticketData);
      setAssignableUsers(usersData.data.map(u => ({ id: u.id, name: u.name })));
    } catch (err: any) {
      console.error("Failed to load ticket details:", err);
      setError(err.response?.data?.message || err.message || 'Could not load ticket details.');
    } finally {
      setIsLoading(false);
    }
  }, [ticketId]);

  // Fetch data on initial mount and when ticketId changes
  useEffect(() => {
    loadTicketData();
  }, [loadTicketData]);

  // --- Handlers ---
  /**
   * Callback after status is successfully updated via the modal form.
   * @param updatedTicket - The updated ticket object from the API.
   */
  const handleStatusUpdateSuccess = (updatedTicket: Ticket) => {
    setTicket(updatedTicket); // Update local state
    setShowStatusModal(false); // Close the modal
  };

  /**
   * Callback after a comment/update is successfully added.
   * @param newUpdate - The new update object from the API.
   */
  const handleCommentAdded = (newUpdate: TicketUpdate) => {
      setTicket(prevTicket => prevTicket ? ({
          ...prevTicket,
          updates: [...(prevTicket.updates || []), newUpdate].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) // Add and re-sort
      }) : null);
      setShowCommentForm(false); // Hide the comment form
  };

  /**
   * Handles file selection for attachment upload.
   */
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file || !ticketId) return;

      setIsUploading(true);
      setUploadError(null);
      try {
          const newAttachment = await uploadTicketAttachment(ticketId, file, (progressEvent) => {
              // Optional: Update upload progress state here
              // const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
              // console.log(`Upload Progress: ${percentCompleted}%`);
          });
          // Add the new attachment to the ticket state
          setTicket(prevTicket => prevTicket ? ({
              ...prevTicket,
              attachments: [...(prevTicket.attachments || []), newAttachment]
          }) : null);
      } catch (err: any) {
          console.error("Attachment upload failed:", err);
          setUploadError(err.response?.data?.message || err.message || 'File upload failed.');
      } finally {
          setIsUploading(false);
          // Reset file input value to allow uploading the same file again if needed
          event.target.value = '';
      }
  };

  /**
   * Handles the deletion of an attachment after confirmation.
   */
    const handleDeleteAttachment = async () => {
        if (!ticketId || !attachmentToDelete) return;

        setIsDeletingAttachment(true);
        setError(null); // Clear general page errors
        try {
            await deleteTicketAttachment(ticketId, attachmentToDelete);
            // Remove the attachment from local state
            setTicket(prevTicket => prevTicket ? ({
                ...prevTicket,
                attachments: prevTicket.attachments?.filter(att => att.id !== attachmentToDelete) || []
            }) : null);
            setAttachmentToDelete(null); // Close confirmation state
        } catch (err: any) {
            console.error("Failed to delete attachment:", err);
            setError(err.response?.data?.message || err.message || 'Could not delete attachment.');
            // Keep confirmation open to show error? Or close it? Closing for now.
            setAttachmentToDelete(null);
        } finally {
            setIsDeletingAttachment(false);
        }
    };


  // --- Render Logic ---
  const canManageTicket = user?.role === 'Admin' || user?.role === 'Staff'; // Determine if user can manage (assign, change status etc.)
  const canAddInternalNote = user?.role === 'Admin' || user?.role === 'Staff';

  if (isLoading) return <Loader text="Loading ticket details..." />;
  if (error) return <Alert type="error" message={error} />;
  if (!ticket) return <Alert type="warning" message="Ticket data not found." />;

  // Sort updates by creation date (newest first)
  const sortedUpdates = ticket.updates?.slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) || [];

  // --- Render ---
  return (
    <div className="ticket-detail-page">
      {/* Page Header */}
      <div className="page-header">
        <div className="header-left">
          <Link to="/tickets" className="back-button">
            <ArrowLeft size={16} style={{ marginRight: '4px' }} /> Back to Tickets
          </Link>
          <h1>Ticket #{ticket.id.substring(0, 8)}...</h1>
        </div>
        <div className="header-right">
          {canManageTicket && (
            <Button variant="primary" onClick={() => setShowStatusModal(true)} leftIcon={<Edit2 size={16}/>}>
              Update Status / Assignee
            </Button>
          )}
        </div>
      </div>

      {/* Main Grid Layout */}
      <div className="ticket-grid">
        {/* Main Ticket Content Area */}
        <main className="ticket-main">
          {/* Ticket Info Card */}
          <Card className="ticket-card">
            <div className="ticket-header">
              <h2>{ticket.subject}</h2>
              <div className="ticket-meta">
                <Badge type={ticket.status.toLowerCase() as any}>{ticket.status}</Badge>
                <Badge type={ticket.urgency.toLowerCase() as any}>{ticket.urgency}</Badge>
              </div>
            </div>
            <div className="ticket-body">
              <div className="ticket-description">
                  {ticket.description || <span style={{ fontStyle: 'italic', color: 'var(--text-muted)'}}>No description provided.</span>}
              </div>
              {ticket.tags && ticket.tags.length > 0 && (
                <div className="ticket-tags">
                  <strong>Tags:</strong>
                  {ticket.tags.map(tag => <span key={tag} className="tag">{tag}</span>)}
                </div>
              )}
            </div>
            {/* Attachments Section */}
            {ticket.attachments && ticket.attachments.length > 0 && (
                <section className="ticket-attachments">
                    <h3>Attachments ({ticket.attachments.length})</h3>
                    <ul className="attachment-list">
                        {ticket.attachments.map(att => (
                            <li key={att.id} className="attachment-item">
                                {att.mimetype.startsWith('image/') ? (
                                    // Image Attachment Handling (simplified preview)
                                    <div className="image-attachment">
                                        <div className="image-preview">
                                            {/* Basic image preview or placeholder */}
                                            <ImageIcon size={32} color="var(--text-muted)" />
                                            {/* In a real app, you might load a thumbnail: */}
                                            {/* <img src={att.thumbnailUrl || att.url} alt={att.filename} /> */}
                                        </div>
                                        <span className="attachment-filename">{att.filename} ({formatBytes(att.size)})</span>
                                        <a href={att.url} target="_blank" rel="noopener noreferrer" className="download-icon-btn" title="Download Image">
                                            <Download size={18} />
                                        </a>
                                          {canManageTicket && ( // Only allow deletion for staff/admin
                                            <button onClick={() => setAttachmentToDelete(att.id)} className="delete-icon-btn" title="Delete Attachment">
                                                <Trash2 size={16} color="var(--error-color)" />
                                            </button>
                                        )}
                                    </div>
                                ) : (
                                    // Non-Image Attachment Link/Button
                                    <a href={att.url} target="_blank" rel="noopener noreferrer" className="attachment-link-button" title={`Download ${att.filename}`}>
                                        <FileText size={18} className="attachment-icon" />
                                        <span className="attachment-name">{att.filename}</span>
                                        <span className="attachment-size">{formatBytes(att.size)}</span>
                                          {canManageTicket && (
                                            <button
                                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setAttachmentToDelete(att.id); }} // Prevent link navigation
                                                className="delete-icon-btn"
                                                title="Delete Attachment"
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', marginLeft: 'auto', padding: '0 4px' }}
                                            >
                                                <Trash2 size={16} color="var(--error-color)" />
                                            </button>
                                        )}
                                    </a>
                                )}
                            </li>
                        ))}
                    </ul>
                </section>
            )}
            {/* Resolution Notes Section */}
            {ticket.status === 'Closed' && ticket.resolutionNotes && (
                <section className="resolution-notes">
                    <h3>Resolution Notes</h3>
                    <p>{ticket.resolutionNotes}</p>
                </section>
            )}
          </Card>

          {/* Ticket Updates/Comments Section */}
          <Card className="ticket-updates">
            <div className="updates-header">
              <h3>Updates & Comments</h3>
              {!showCommentForm && ( // Show button only if form is hidden
                  <Button variant="secondary" size="sm" onClick={() => setShowCommentForm(true)}>
                    Add Comment/Update
                  </Button>
              )}
            </div>

            {/* Conditionally render Comment Form */}
            {showCommentForm && (
                <div className="comment-form-container">
                    <TicketCommentForm
                        ticketId={ticket.id}
                        onCommentAdded={handleCommentAdded}
                        onCancel={() => setShowCommentForm(false)}
                        canAddInternalNote={canAddInternalNote}
                    />
                </div>
            )}

            {/* Updates Timeline */}
            <div className="updates-timeline">
              {sortedUpdates.length > 0 ? (
                sortedUpdates.map(update => (
                  <div key={update.id} className={`update-item ${update.isSystemUpdate ? 'system-update' : ''} ${update.isInternalNote ? 'internal-note' : ''}`}>
                    <div className="update-header">
                      <span className="update-author">
                          <strong>{update.author.name}</strong>
                          {update.isInternalNote && <Badge type='secondary' className="internal-badge">Internal</Badge>}
                          {update.isSystemUpdate && <span> (System)</span>}
                      </span>
                      <span className="update-time">{formatDateTime(update.createdAt)}</span>
                    </div>
                    <div className="update-content">{update.content}</div>
                  </div>
                ))
              ) : (
                <p className="no-updates">No updates or comments yet.</p>
              )}
            </div>
          </Card>
        </main>

        {/* Sidebar Area */}
        <aside className="ticket-sidebar">
          {/* Ticket Details Card */}
          <Card className="sidebar-card">
            <h3>Details</h3>
            <div className="info-group">
              <label>Status:</label>
              <span><Badge type={ticket.status.toLowerCase() as any}>{ticket.status}</Badge></span>
            </div>
            <div className="info-group">
              <label>Urgency:</label>
              <span><Badge type={ticket.urgency.toLowerCase() as any}>{ticket.urgency}</Badge></span>
            </div>
            <div className="info-group">
              <label>Assignee:</label>
              <span>{ticket.assignedTo?.name || 'Unassigned'}</span>
            </div>
              <div className="info-group">
              <label>Issue Type:</label>
              <span>{ticket.issueType || '-'}</span>
            </div>
            <div className="info-group">
              <label>Submitter:</label>
              <span>{ticket.submitter.name} ({ticket.submitter.email})</span>
            </div>
            <div className="info-group">
              <label>Created:</label>
              <span>{formatDateTime(ticket.createdAt)}</span>
            </div>
            <div className="info-group">
              <label>Last Updated:</label>
              <span>{formatDateTime(ticket.updatedAt)}</span>
            </div>
              {ticket.closedAt && (
                <div className="info-group">
                    <label>Closed:</label>
                    <span>{formatDateTime(ticket.closedAt)}</span>
                </div>
              )}
          </Card>

          {/* Actions Card (Conditional based on role/status) */}
          {canManageTicket && (
              <Card className="sidebar-card">
                <h3>Actions</h3>
                <div className="sidebar-actions">
                    {/* File Upload */}
                    <div className="file-upload-container">
                        <label htmlFor="file-upload" className="file-upload-btn">
                            <Paperclip size={16} style={{ marginRight: '8px' }}/>
                            {isUploading ? 'Uploading...' : 'Attach File'}
                        </label>
                        <input
                            id="file-upload"
                            type="file"
                            onChange={handleFileChange}
                            disabled={isUploading}
                            className="file-input" // Hidden visually
                        />
                    </div>
                    {uploadError && <Alert type="error" message={uploadError} />}

                    {/* Other actions based on status */}
                    {/* Example: Assign to me button */}
                    {/* {ticket.status !== 'Closed' && (!ticket.assignedTo || ticket.assignedTo.id !== user?.id) && (
                        <Button variant="secondary">Assign to Me</Button>
                    )} */}
                    {/* Update Status button is in header */}
                </div>
              </Card>
          )}
        </aside>
      </div>

      {/* Status Update Modal */}
      {canManageTicket && (
        <Modal
          isOpen={showStatusModal}
          onClose={() => setShowStatusModal(false)}
          title="Update Ticket Status & Assignee"
        >
          <TicketStatusForm
            ticket={ticket}
            assignableUsers={assignableUsers}
            onUpdateSuccess={handleStatusUpdateSuccess}
            onCancel={() => setShowStatusModal(false)}
          />
        </Modal>
      )}

        {/* Delete Attachment Confirmation Modal */}
        <Modal
          isOpen={!!attachmentToDelete}
          onClose={() => setAttachmentToDelete(null)}
          title="Confirm Attachment Deletion"
        >
          <p>Are you sure you want to delete this attachment? This action cannot be undone.</p>
          {error && <Alert type="error" message={error} className="mt-4" />} {/* Show delete error */}
          <div className="form-actions mt-6">
            <Button variant="outline" onClick={() => setAttachmentToDelete(null)} disabled={isDeletingAttachment}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDeleteAttachment} isLoading={isDeletingAttachment} disabled={isDeletingAttachment}>
              {isDeletingAttachment ? 'Deleting...' : 'Delete Attachment'}
            </Button>
          </div>
        </Modal>

    </div>
  );
};

export default TicketDetailPage;
