import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { Ticket, User, TicketUpdate, TicketUpdateCreate, TicketStatusUpdate, Attachment, APIResponse } from '../../types/models';

const CommentSchema = Yup.object().shape({
  comment: Yup.string().required('Comment is required'),
  is_internal_note: Yup.boolean()
});

const UpdateTicketSchema = Yup.object().shape({
  status: Yup.string().required('Status is required'),
  assigned_to_user_id: Yup.string().nullable(),
  resolution_notes: Yup.string().when('status', ([status], schema) =>
    status === 'Closed'
      ? schema.required('Resolution notes are required when closing a ticket')
      : schema
  )
});

const TicketDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [updateType, setUpdateType] = useState<'comment' | 'status' | null>(null);
  const [imageUrls, setImageUrls] = useState<{ [key: string]: string }>({});
  
  const isAdmin = user?.role === 'Admin';
  const isAssignedToMe = ticket?.assigned_to_user_id === user?.id;
  const canUpdateTicket = isAdmin || isAssignedToMe || ticket?.status === 'Unassigned';

  useEffect(() => {
    const fetchTicketData = async () => {
      try {
        setLoading(true);
        
        // Fetch ticket details
        const ticketResponse = await api.get<APIResponse<Ticket>>(`/tickets/${id}`);
        if (ticketResponse.data.success && ticketResponse.data.data) {
          setTicket(ticketResponse.data.data);
        } else {
          setError('Failed to load ticket details');
        }
        
        // Fetch users for assignment dropdown
        const usersResponse = await api.get<APIResponse<User[]>>('/users');
        if (usersResponse.data.success && usersResponse.data.data) {
          setUsers(usersResponse.data.data);
        }
        
      } catch (error) {
        console.error('Error fetching ticket details:', error);
        setError('Failed to load ticket details');
      } finally {
        setLoading(false);
      }
    };
    
    if (id) {
      fetchTicketData();
    }
  }, [id]);
  
  // Add cleanup for object URLs when component unmounts
  useEffect(() => {
    // This runs when the component unmounts
    return () => {
        Object.values(imageUrls).forEach(url => URL.revokeObjectURL(url));
    };
  }, [imageUrls]);

  const handleAddComment = async (values: TicketUpdateCreate, { resetForm }: { resetForm: () => void }) => {
    try {
      const response = await api.post<APIResponse<TicketUpdate>>(`/tickets/${id}/comments`, values);
      
      if (response.data.success && response.data.data) {
        // Add the new comment to the ticket updates
        const newUpdate = response.data.data;
        
        if (ticket) {
          setTicket({
            ...ticket,
            updates: [...(ticket.updates || []), newUpdate]
          });
        }
        
        resetForm();
        setUpdateType(null);
      } else {
        setError(response.data.error || 'Failed to add comment');
      }
    } catch (err: any) {
      console.error('Error adding comment:', err);
      setError(err.response?.data?.error || 'Failed to add comment');
    }
  };
  
  const handleUpdateTicket = async (values: TicketStatusUpdate) => {
    try {
      const response = await api.put<APIResponse<Ticket>>(`/tickets/${id}`, values);
      
      if (response.data.success && response.data.data) {
        setTicket(response.data.data);
        setUpdateType(null);
      } else {
        setError(response.data.error || 'Failed to update ticket');
      }
    } catch (err: any) {
      console.error('Error updating ticket:', err);
      setError(err.response?.data?.error || 'Failed to update ticket');
    }
  };
  
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const response = await api.post<APIResponse<Attachment>>(
        `/tickets/${id}/attachments`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        }
      );
      
      if (response.data.success && response.data.data) {
        const newAttachment = response.data.data;
        
        if (ticket) {
          setTicket({
            ...ticket,
            attachments: [...(ticket.attachments || []), newAttachment]
          });
        }
      } else {
        setError(response.data.error || 'Failed to upload file');
      }
    } catch (err: any) {
      console.error('Error uploading file:', err);
      setError(err.response?.data?.error || 'Failed to upload file');
    }
  };

  const handleLoadOrDownloadAttachment = async (attachment: Attachment) => {
    if (!ticket?.id) return;
    setError(null);

    try {
        const response = await api.get(
            `/api/tickets/<span class="math-inline">\{ticket\.id\}/attachments/download/</span>{attachment.id}`,
            {
                responseType: 'blob', // Fetch as Blob
            }
        );

        const blobUrl = window.URL.createObjectURL(new Blob([response.data], { type: attachment.mime_type }));

        if (attachment.mime_type.startsWith('image/')) {
            // It's an image, store the blob URL in state for display
            setImageUrls(prev => ({ ...prev, [attachment.id]: blobUrl }));
        } else {
            // Not an image, trigger download as before
            const link = document.createElement('a');
            link.href = blobUrl;
            link.setAttribute('download', attachment.filename);
            document.body.appendChild(link);
            link.click();
            link.parentNode?.removeChild(link);
            // Revoke immediately for downloads, but not for images until unmount/replacement
            window.URL.revokeObjectURL(blobUrl);
        }

    } catch (error: any) {
        console.error("Error loading/downloading file:", error);
        setError(error.response?.data?.message || 'Failed to load/download file.');
    }
};
  
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };
  
  if (loading) {
    return (
      <div className="ticket-detail-page loading">
        <div className="loader"></div>
        <p>Loading ticket details...</p>
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="ticket-detail-page error">
        <h1>Error</h1>
        <p>{error || 'Ticket not found'}</p>
        <button onClick={() => navigate('/tickets')} className="back-button">
          Back to Tickets
        </button>
      </div>
    );
  }

  return (
    <div className="ticket-detail-page">
      <div className="page-header">
        <div className="header-left">
          <button onClick={() => navigate('/tickets')} className="back-button">
            ← Back to Tickets
          </button>
          <h1>Ticket #{ticket.ticket_number}</h1>
        </div>
        <div className="header-right">
          {canUpdateTicket && ticket.status !== 'Closed' && (
            <button 
              className="update-ticket-btn"
              onClick={() => setUpdateType('status')}
            >
              Update Status
            </button>
          )}
        </div>
      </div>
      
      {error && <div className="error-message">{error}</div>}
      
      <div className="ticket-grid">
        <div className="ticket-main">
          <div className="ticket-card">
            <div className="ticket-header">
              <h2>{ticket.subject}</h2>
              <div className="ticket-meta">
                <span className={`status-badge status-${ticket.status.toLowerCase().replace(' ', '-')}`}>
                  {ticket.status}
                </span>
                <span className={`urgency-badge urgency-${ticket.urgency.toLowerCase()}`}>
                  {ticket.urgency}
                </span>
              </div>
            </div>
            
            <div className="ticket-body">
              <p className="ticket-description">{ticket.body}</p>
              
              {ticket.tags && ticket.tags.length > 0 && (
                <div className="ticket-tags">
                  {ticket.tags.map(tag => (
                    <span key={tag.id} className="tag">{tag.name}</span>
                  ))}
                </div>
              )}
            </div>
            
            {ticket.attachments && ticket.attachments.length > 0 && (
              <div className="ticket-attachments">
                <h3>Attachments</h3>
                <ul className="attachment-list">
                  {ticket.attachments.map(attachment => (
                    <li key={attachment.id} className="attachment-item">
                      {attachment.mime_type.startsWith('image/') ? (
                        // Display Image
                        <div className="image-attachment">
                            <div className="image-preview">
                                {imageUrls[attachment.id] ? (
                                    <img src={imageUrls[attachment.id]} alt={attachment.filename} />
                                ) : (
                                    <div className="image-placeholder">
                                        <span>Preview N/A</span>
                                        <button
                                            type="button"
                                            onClick={() => handleLoadOrDownloadAttachment(attachment)}
                                            className="load-image-btn"
                                        >
                                            Load Image
                                        </button>
                                    </div>
                                )}
                            </div>
                            <span className="attachment-filename">{attachment.filename}</span>
                            {/* Optionally add a separate download button even for images */}
                            <button
                                 type="button"
                                 onClick={() => handleLoadOrDownloadAttachment(attachment)}
                                 title="Download"
                                 className="download-icon-btn" // Style as needed
                            >
                                &#x2913; {/* Down arrow symbol */}
                            </button>
                        </div>
                    ) : (
                        // Display Download Link/Button for non-images
                        <button
                            type="button"
                            onClick={() => handleLoadOrDownloadAttachment(attachment)}
                            className="attachment-link-button" // Style as needed
                        >
                          <span className="attachment-icon">📎</span>
                          <span className="attachment-name">{attachment.filename}</span>
                          <span className="attachment-size">
                            {(attachment.size / 1024).toFixed(1)} KB
                          </span>
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {ticket.resolution_notes && (
              <div className="resolution-notes">
                <h3>Resolution</h3>
                <p>{ticket.resolution_notes}</p>
              </div>
            )}
          </div>
          
          <div className="ticket-updates">
            <div className="updates-header">
              <h3>Updates & Comments</h3>
              {ticket.status !== 'Closed' && (
                <button 
                  className="add-comment-btn"
                  onClick={() => setUpdateType('comment')}
                >
                  Add Comment
                </button>
              )}
            </div>
            
            {updateType === 'comment' && (
              <div className="comment-form-container">
                <h4>Add Comment</h4>
                <Formik
                  initialValues={{ comment: '', is_internal_note: false }}
                  validationSchema={CommentSchema}
                  onSubmit={handleAddComment}
                >
                  {({ isSubmitting }) => (
                    <Form className="comment-form">
                      <div className="form-group">
                        <Field
                          as="textarea"
                          name="comment"
                          placeholder="Enter your comment here..."
                          rows={4}
                        />
                        <ErrorMessage name="comment" component="div" className="error" />
                      </div>
                      
                      <div className="form-group checkbox">
                        <label>
                          <Field type="checkbox" name="is_internal_note" />
                          Internal Note (not visible to end user)
                        </label>
                      </div>
                      
                      <div className="form-actions">
                        <button 
                          type="button" 
                          onClick={() => setUpdateType(null)}
                          className="cancel-btn"
                        >
                          Cancel
                        </button>
                        <button 
                          type="submit" 
                          disabled={isSubmitting}
                          className="submit-btn"
                        >
                          {isSubmitting ? 'Posting...' : 'Post Comment'}
                        </button>
                      </div>
                    </Form>
                  )}
                </Formik>
              </div>
            )}
            
            {updateType === 'status' && (
              <div className="status-form-container">
                <h4>Update Ticket Status</h4>
                <Formik
                  initialValues={{
                    status: ticket.status,
                    assigned_to_user_id: ticket.assigned_to_user_id || '',
                    resolution_notes: ticket.resolution_notes || ''
                  }}
                  validationSchema={UpdateTicketSchema}
                  onSubmit={handleUpdateTicket}
                >
                  {({ isSubmitting, values }) => (
                    <Form className="status-form">
                      <div className="form-group">
                        <label>Status</label>
                        <Field as="select" name="status">
                          <option value="Unassigned">Unassigned</option>
                          <option value="Assigned">Assigned</option>
                          <option value="In Progress">In Progress</option>
                          <option value="Closed">Closed</option>
                        </Field>
                        <ErrorMessage name="status" component="div" className="error" />
                      </div>
                      
                      <div className="form-group">
                        <label>Assigned To</label>
                        <Field as="select" name="assigned_to_user_id">
                          <option value="">-- Unassigned --</option>
                          {users.map(user => (
                            <option key={user.id} value={user.id}>
                              {user.name} ({user.email})
                            </option>
                          ))}
                        </Field>
                      </div>
                      
                      {values.status === 'Closed' && (
                        <div className="form-group">
                          <label>Resolution Notes</label>
                          <Field
                            as="textarea"
                            name="resolution_notes"
                            placeholder="Describe how the issue was resolved..."
                            rows={4}
                          />
                          <ErrorMessage name="resolution_notes" component="div" className="error" />
                        </div>
                      )}
                      
                      <div className="form-actions">
                        <button 
                          type="button" 
                          onClick={() => setUpdateType(null)}
                          className="cancel-btn"
                        >
                          Cancel
                        </button>
                        <button 
                          type="submit" 
                          disabled={isSubmitting}
                          className="submit-btn"
                        >
                          {isSubmitting ? 'Updating...' : 'Update Ticket'}
                        </button>
                      </div>
                    </Form>
                  )}
                </Formik>
              </div>
            )}
            
            <div className="updates-timeline">
              {ticket.updates && ticket.updates.length > 0 ? (
                ticket.updates.map(update => (
                  <div 
                    key={update.id} 
                    className={`update-item ${update.is_internal_note ? 'internal-note' : ''}`}
                  >
                    <div className="update-header">
                      <div className="update-author">
                        {update.user ? (
                          <span>{update.user.name}</span>
                        ) : (
                          <span>System</span>
                        )}
                        {update.is_internal_note && (
                          <span className="internal-badge">Internal</span>
                        )}
                      </div>
                      <div className="update-time">
                        {formatDate(update.created_at)}
                      </div>
                    </div>
                    <div className="update-content">
                      {update.comment}
                    </div>
                  </div>
                ))
              ) : (
                <p className="no-updates">No updates yet</p>
              )}
              
              <div className="update-item system-update">
                <div className="update-header">
                  <div className="update-author">
                    <span>System</span>
                  </div>
                  <div className="update-time">
                    {formatDate(ticket.created_at)}
                  </div>
                </div>
                <div className="update-content">
                  Ticket created by {ticket.end_user_email}
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="ticket-sidebar">
          <div className="sidebar-card">
            <h3>Ticket Information</h3>
            <div className="info-group">
              <label>Ticket #:</label>
              <span>{ticket.ticket_number}</span>
            </div>
            <div className="info-group">
              <label>Created:</label>
              <span>{formatDate(ticket.created_at)}</span>
            </div>
            <div className="info-group">
              <label>Last Updated:</label>
              <span>{formatDate(ticket.updated_at)}</span>
            </div>
            {ticket.closed_at && (
              <div className="info-group">
                <label>Closed:</label>
                <span>{formatDate(ticket.closed_at)}</span>
              </div>
            )}
            <div className="info-group">
              <label>Status:</label>
              <span className={`status-badge status-${ticket.status.toLowerCase().replace(' ', '-')}`}>
                {ticket.status}
              </span>
            </div>
            <div className="info-group">
              <label>Urgency:</label>
              <span className={`urgency-badge urgency-${ticket.urgency.toLowerCase()}`}>
                {ticket.urgency}
              </span>
            </div>
            <div className="info-group">
              <label>Issue Type:</label>
              <span>{ticket.issue_type}</span>
            </div>
            <div className="info-group">
              <label>Submitted By:</label>
              <span>{ticket.end_user_email}</span>
            </div>
            <div className="info-group">
              <label>Assigned To:</label>
              <span>
                {ticket.assigned_to_user ? ticket.assigned_to_user.name : 'Unassigned'}
              </span>
            </div>
          </div>
          
          {ticket.status !== 'Closed' && (
            <div className="sidebar-card">
              <h3>Actions</h3>
              <div className="sidebar-actions">
                <div className="file-upload-container">
                  <label htmlFor="file-upload" className="file-upload-btn">
                    Attach File
                  </label>
                  <input 
                    id="file-upload" 
                    type="file" 
                    onChange={handleFileUpload}
                    className="file-input"
                  />
                </div>
                
                {ticket.assigned_to_user_id !== user?.id && (
                  <button 
                    className="assign-to-me-btn"
                    onClick={() => handleUpdateTicket({
                      status: 'Assigned',
                      assigned_to_user_id: user?.id
                    })}
                  >
                    Assign to Me
                  </button>
                )}
                
                {ticket.status === 'Assigned' && isAssignedToMe && (
                  <button 
                    className="start-work-btn"
                    onClick={() => handleUpdateTicket({
                      status: 'In Progress',
                      assigned_to_user_id: user?.id
                    })}
                  >
                    Start Working
                  </button>
                )}
                
                {(ticket.status === 'Assigned' || ticket.status === 'In Progress') && isAssignedToMe && (
                  <button 
                    className="close-ticket-btn"
                    onClick={() => setUpdateType('status')}
                  >
                    Close Ticket
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TicketDetailPage;