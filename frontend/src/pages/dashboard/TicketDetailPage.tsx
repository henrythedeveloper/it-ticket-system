// src/pages/dashboard/TicketDetailPage.tsx
// ==========================================================================
// Component representing the page for viewing and managing a single ticket.
// Displays ticket details, updates, attachments, and allows actions.
// **REVISED**: Added hover preview for image attachments.
// ==========================================================================

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Loader from '../../components/common/Loader';
import Card from '../../components/common/Card';
import Alert from '../../components/common/Alert';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import TicketCommentForm from '../../components/forms/TicketCommentForm';
import TicketStatusForm from '../../components/forms/TicketStatusForm';
import { useAuth } from '../../hooks/useAuth';
import { fetchTicketById, uploadTicketAttachment, deleteTicketAttachment } from '../../services/ticketService';
import { fetchUsers } from '../../services/userService';
import { Ticket, User, TicketUpdate, Tag, TicketAttachment } from '../../types';
import { formatDateTime, formatBytes, getInitials } from '../../utils/helpers';
import { ArrowLeft, Paperclip, Trash2, Image as ImageIcon, FileText, Download, Edit2, ExternalLink } from 'lucide-react';

// --- Component ---

const TicketDetailPage: React.FC = () => {
  // --- Hooks ---
  const { ticketId } = useParams<{ ticketId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  // --- State ---
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [assignableUsers, setAssignableUsers] = useState<Pick<User, 'id' | 'name'>[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showStatusModal, setShowStatusModal] = useState<boolean>(false);
  const [showCommentForm, setShowCommentForm] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [attachmentToDelete, setAttachmentToDelete] = useState<TicketAttachment | null>(null);
  const [isDeletingAttachment, setIsDeletingAttachment] = useState<boolean>(false);
  const [imageModalUrl, setImageModalUrl] = useState<string | null>(null);
  const [imageModalFilename, setImageModalFilename] = useState<string>('');
  const [hoveredAttachmentUrl, setHoveredAttachmentUrl] = useState<string | null>(null); // State for hover preview

  // --- Data Fetching ---
  const loadTicketData = useCallback(async () => {
    // ... (loadTicketData logic remains the same) ...
    console.log('[TicketDetail] loadTicketData called. ticketId:', ticketId);
    if (!ticketId) {
      console.error('[TicketDetail] Error: Ticket ID is missing.');
      setError("Ticket ID is missing.");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    console.log('[TicketDetail] State before fetch:', { isLoading: true, error: null });
    try {
      console.log('[TicketDetail] Fetching ticket and users...');
      const [ticketData, usersData] = await Promise.all([
        fetchTicketById(ticketId),
        fetchUsers({ role: 'Admin,Staff', limit: 500 })
      ]);
      console.log('[TicketDetail] API fetch successful. Ticket Data:', ticketData, 'Users Data:', usersData);

      if (!ticketData || typeof ticketData !== 'object' || !ticketData.id || !ticketData.status) {
          console.error('[TicketDetail] Invalid ticket data structure received from API:', ticketData);
          throw new Error('Invalid ticket data received from server.');
      }

      ticketData.tags = Array.isArray(ticketData.tags) ? ticketData.tags : [];
      ticketData.updates = Array.isArray(ticketData.updates) ? ticketData.updates : [];
      ticketData.attachments = Array.isArray(ticketData.attachments) ? ticketData.attachments : [];

      setTicket(ticketData);
      setAssignableUsers(usersData.data.map(u => ({ id: u.id, name: u.name })));
      console.log('[TicketDetail] State updated with fetched data.');

    } catch (err: any) {
      console.error("[TicketDetail] Failed to load ticket details:", err);
      setError(err.response?.data?.message || err.message || 'Could not load ticket details.');
      setTicket(null);
      console.log('[TicketDetail] State updated with error.');
    } finally {
      setIsLoading(false);
      console.log('[TicketDetail] Fetch finished. Setting isLoading to false.');
    }
  }, [ticketId]);

  useEffect(() => {
    loadTicketData();
  }, [loadTicketData]);

  // --- Handlers ---
  const handleStatusUpdateSuccess = (updatedTicket: Ticket) => {
     // ... (logic remains the same) ...
     console.log('[TicketDetail] handleStatusUpdateSuccess called.');
     if (!updatedTicket || typeof updatedTicket !== 'object' || !updatedTicket.id || !updatedTicket.status) {
        console.error('[TicketDetail] Invalid updated ticket data received:', updatedTicket);
        setError('Failed to update ticket state with invalid data.');
        setShowStatusModal(false);
        return;
    }
    setTicket(updatedTicket);
    setShowStatusModal(false);
  };

  const handleCommentAdded = (newUpdate: TicketUpdate) => {
      // ... (logic remains the same) ...
      console.log('[TicketDetail] handleCommentAdded called.');
      setTicket(prevTicket => {
          if (!prevTicket) return null;
          const currentUpdates = Array.isArray(prevTicket.updates) ? prevTicket.updates : [];
           const updatedUpdates = [newUpdate, ...currentUpdates].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          return {
              ...prevTicket,
              updates: updatedUpdates
          };
      });
      setShowCommentForm(false);
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
      // ... (logic remains the same) ...
      const file = event.target.files?.[0];
      console.log('[TicketDetail] handleFileChange:', file?.name);
      if (!file || !ticketId) return;
      setIsUploading(true);
      setUploadError(null);
      try {
          const newAttachment = await uploadTicketAttachment(ticketId, file);
          console.log('[TicketDetail] Attachment uploaded:', newAttachment);
          setTicket(prevTicket => {
              if (!prevTicket) return null;
              const currentAttachments = Array.isArray(prevTicket.attachments) ? prevTicket.attachments : [];
              return {
                  ...prevTicket,
                  attachments: [newAttachment, ...currentAttachments]
              };
          });
      } catch (err: any) {
          console.error("[TicketDetail] Attachment upload failed:", err);
          setUploadError(err.response?.data?.message || err.message || 'File upload failed.');
      } finally {
          setIsUploading(false);
          event.target.value = '';
          console.log('[TicketDetail] Upload finished.');
      }
  };

  const handleDeleteAttachment = async () => {
    // ... (logic remains the same) ...
    console.log('[TicketDetail] handleDeleteAttachment called for:', attachmentToDelete?.id);
    if (!ticketId || !attachmentToDelete) return;
    const idToDelete = attachmentToDelete.id;
    setIsDeletingAttachment(true);
    setError(null);
    try {
        await deleteTicketAttachment(ticketId, idToDelete);
        console.log('[TicketDetail] Attachment deleted successfully from API.');
        setTicket(prevTicket => {
            if (!prevTicket) return null;
            const currentAttachments = Array.isArray(prevTicket.attachments) ? prevTicket.attachments : [];
            return {
                ...prevTicket,
                attachments: currentAttachments.filter(att => att.id !== idToDelete)
            };
        });
        setAttachmentToDelete(null);
    } catch (err: any) {
        console.error("[TicketDetail] Failed to delete attachment:", err);
        setError(err.response?.data?.message || err.message || 'Could not delete attachment.');
    } finally {
        setIsDeletingAttachment(false);
        console.log('[TicketDetail] Attachment deletion process finished.');
    }
};

  // --- Render Logic ---
  const canManageTicket = user?.role === 'Admin' || user?.role === 'Staff';
  const canAddInternalNote = user?.role === 'Admin' || user?.role === 'Staff';

  if (isLoading) return <Loader text="Loading ticket details..." />;
  if (error && !attachmentToDelete) return <Alert type="error" message={error} />;
  if (!ticket || typeof ticket !== 'object' || !ticket.id || !ticket.status) {
      return <Alert type="warning" message="Ticket data could not be loaded or does not exist." />;
  }

  const sortedUpdates = Array.isArray(ticket.updates)
      ? ticket.updates.slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      : [];

  // --- Render ---
  return (
    <div className="ticket-detail-page">
      {/* Page Header */}
      <div className="page-header">
        <div className="header-left">
          <Link to="/tickets" className="back-button">
            <ArrowLeft size={16} style={{ marginRight: '4px' }} /> Back to Tickets
          </Link>
          <h1>Ticket #{ticket.ticket_number}</h1>
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
                {ticket.status && <Badge type={ticket.status.toLowerCase() as any}>{ticket.status}</Badge>}
                {ticket.urgency && <Badge type={ticket.urgency.toLowerCase() as any}>{ticket.urgency}</Badge>}
              </div>
            </div>
            <div className="ticket-body">
              <div className="ticket-description">
                  {ticket.description || <span style={{ fontStyle: 'italic', color: 'var(--text-muted)'}}>No description provided.</span>}
              </div>
              {ticket.tags && Array.isArray(ticket.tags) && ticket.tags.length > 0 && (
                <div className="ticket-tags">
                  <strong>Tags:</strong>
                  {ticket.tags.map((tag: Tag) => (
                    <span key={tag.id} className="tag">{tag.name}</span>
                  ))}
                </div>
              )}
            </div>

            {/* Attachments Section */}
            <section className="ticket-attachments">
                <h3>Attachments ({ticket.attachments?.length || 0})</h3>
                {ticket.attachments && ticket.attachments.length > 0 ? (
                    <ul className="attachment-list">
                        {ticket.attachments.map(att => {
                            const isImage = att.mime_type?.startsWith('image/');
                            console.log(`[TicketDetail] Rendering attachment: ${att.filename}, MIME Type: ${att.mime_type}, IsImage: ${isImage}`);
                            return (
                                // Add hover handlers to the list item
                                <li
                                    key={att.id}
                                    className="attachment-item"
                                    onMouseEnter={() => isImage && setHoveredAttachmentUrl(att.url)} // Set URL on hover if it's an image
                                    onMouseLeave={() => setHoveredAttachmentUrl(null)} // Clear URL on leave
                                >
                                    <div className="attachment-info">
                                        {isImage ? (
                                            <img
                                                src={att.url}
                                                alt={att.filename}
                                                className="attachment-thumbnail"
                                                onClick={() => { // Keep click handler for modal
                                                    console.log('[TicketDetail] Image thumbnail clicked:', att.filename, att.url);
                                                    setImageModalUrl(att.url);
                                                    setImageModalFilename(att.filename);
                                                }}
                                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                            />
                                        ) : (
                                            <FileText size={24} className="attachment-icon" />
                                        )}
                                        <span className="attachment-filename" title={att.filename}>{att.filename}</span>
                                        <span className="attachment-size">({formatBytes(att.size)})</span>
                                    </div>
                                    <div className="attachment-actions">
                                        <a href={att.url} target="_blank" rel="noopener noreferrer" download={att.filename} className="download-icon-btn" title={`Download ${att.filename}`}>
                                            <Download size={18} />
                                        </a>
                                        {canManageTicket && (
                                            <button onClick={() => setAttachmentToDelete(att)} className="delete-icon-btn" title="Delete Attachment" disabled={isDeletingAttachment} >
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </div>
                                    {/* Conditionally render hover preview */}
                                    {isImage && hoveredAttachmentUrl === att.url && (
                                        <div className="attachment-hover-preview">
                                            <img src={att.url} alt="Preview" />
                                        </div>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                ) : (
                    <p className="no-attachments">No files attached.</p>
                )}
            </section>

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
             {/* ... (updates content remains the same) ... */}
             <div className="updates-header">
              <h3>Updates & Comments</h3>
              {!showCommentForm && ticket.status !== 'Closed' && (
                  <Button variant="secondary" size="sm" onClick={() => setShowCommentForm(true)}>
                    Add Comment/Update
                  </Button>
              )}
            </div>
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
            <div className="updates-timeline">
              {sortedUpdates.length > 0 ? (
                sortedUpdates.map(update => (
                  <div key={update.id} className={`update-item ${update.isSystemUpdate ? 'system-update' : ''} ${update.isInternalNote ? 'internal-note' : ''}`}>
                    <div className="update-header">
                      <span className="update-author">
                          <strong>{update.author?.name || 'System'}</strong>
                          {update.isInternalNote && <Badge type='secondary' className="internal-badge">Internal</Badge>}
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
           {/* ... (sidebar content remains the same) ... */}
           <Card className="sidebar-card">
            <h3>Details</h3>
            <div className="info-group">
              <label>Status:</label>
              <span>{ticket.status && <Badge type={ticket.status.toLowerCase() as any}>{ticket.status}</Badge>}</span>
            </div>
            <div className="info-group">
              <label>Urgency:</label>
              <span>{ticket.urgency && <Badge type={ticket.urgency.toLowerCase() as any}>{ticket.urgency}</Badge>}</span>
            </div>
            <div className="info-group">
              <label>Assignee:</label>
              <span>{ticket.assignedTo?.name || 'Unassigned'}</span>
            </div>
              <div className="info-group">
              <label>Issue Type:</label>
              <span>{ticket.issueType || '-'}</span>
            </div>
            {ticket.submitter && (
                <div className="info-group">
                    <label>Submitter:</label>
                    <span>{ticket.submitter.name} ({ticket.submitter.email})</span>
                </div>
            )}
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

          {canManageTicket && (
              <Card className="sidebar-card">
                <h3>Actions</h3>
                <div className="sidebar-actions">
                    <div className="file-upload-container">
                        <label htmlFor="file-upload" className={`file-upload-btn ${isUploading ? 'disabled' : ''}`}>
                            <Paperclip size={16} style={{ marginRight: '8px' }}/>
                            {isUploading ? 'Uploading...' : 'Attach File'}
                        </label>
                        <input
                            id="file-upload"
                            type="file"
                            onChange={handleFileChange}
                            disabled={isUploading || ticket.status === 'Closed'}
                            className="file-input"
                        />
                    </div>
                    {uploadError && <Alert type="error" message={uploadError} />}
                </div>
              </Card>
          )}
        </aside>
      </div>

      {/* Status Update Modal */}
      {canManageTicket && (
        <Modal isOpen={showStatusModal} onClose={() => setShowStatusModal(false)} title="Update Ticket Status & Assignee" >
          <TicketStatusForm ticket={ticket} assignableUsers={assignableUsers} onUpdateSuccess={handleStatusUpdateSuccess} onCancel={() => setShowStatusModal(false)} />
        </Modal>
      )}

      {/* Delete Attachment Confirmation Modal */}
      <Modal isOpen={!!attachmentToDelete} onClose={() => { setAttachmentToDelete(null); setError(null); }} title="Confirm Attachment Deletion" >
        <p>Are you sure you want to delete the attachment <strong>{attachmentToDelete?.filename}</strong>?</p>
        <p className="mt-2 text-sm text-red-600">This action cannot be undone.</p>
        {error && attachmentToDelete && <Alert type="error" message={error} className="mt-4" />}
        <div className="form-actions mt-6">
          <Button variant="outline" onClick={() => { setAttachmentToDelete(null); setError(null); }} disabled={isDeletingAttachment}> Cancel </Button>
          <Button variant="danger" onClick={handleDeleteAttachment} isLoading={isDeletingAttachment} disabled={isDeletingAttachment}> {isDeletingAttachment ? 'Deleting...' : 'Delete Attachment'} </Button>
        </div>
      </Modal>

      {/* Image Preview Modal */}
        <Modal isOpen={!!imageModalUrl} onClose={() => setImageModalUrl(null)} title={imageModalFilename || "Image Preview"} className="image-preview-modal" >
          {imageModalUrl && (
            <>
              <img src={imageModalUrl} alt={imageModalFilename || 'Preview'} style={{ maxWidth: '100%', maxHeight: '80vh', display: 'block', margin: 'auto' }} />
              <div className="modal-image-actions" style={{ textAlign: 'center', marginTop: '1rem' }}>
                  <a href={imageModalUrl} download={imageModalFilename} target="_blank" rel="noopener noreferrer">
                      <Button variant="secondary" leftIcon={<Download size={16} />}>Download Image</Button>
                  </a>
              </div>
            </>
          )}
        </Modal>

    </div>
  );
};

export default TicketDetailPage;
