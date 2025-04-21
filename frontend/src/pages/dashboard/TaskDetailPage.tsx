import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
// Import TaskCreate along with other types
import { Task, User, TaskStatusUpdate, APIResponse, TaskCreate } from '../../types/models'; 

// Validation schema for the task form
const TaskSchema = Yup.object().shape({
  title: Yup.string().required('Title is required'),
  description: Yup.string(),
  // Allow assigned_to_user_id to be a string (UUID) or null
  assigned_to_user_id: Yup.string().nullable(), 
  due_date: Yup.date().nullable(),
  is_recurring: Yup.boolean(),
  // Require recurrence_rule only if is_recurring is true
  recurrence_rule: Yup.string().when('is_recurring', ([isRecurring], schema) =>
    isRecurring ? schema.required('Recurrence rule is required when task is recurring') : schema
  )
});

// Task Detail Page Component
const TaskDetailPage: React.FC = () => {
  // Hooks for routing and parameters
  const { id } = useParams<{ id: string }>(); // Get task ID from URL
  const isNewTask = id === 'new'; // Check if creating a new task
  const navigate = useNavigate(); // Hook for navigation
  
  // Hooks for state management
  const { user } = useAuth(); // Get current user from auth context
  const [loading, setLoading] = useState(!isNewTask); // Loading state, true if editing
  const [task, setTask] = useState<Task | null>(null); // State for task details
  const [users, setUsers] = useState<User[]>([]); // State for list of users (for assignment)
  const [error, setError] = useState<string | null>(null); // State for error messages
  const [editMode, setEditMode] = useState(isNewTask); // State to toggle edit mode

  // --- Permissions ---
  const isAdmin = user?.role === 'Admin';
  const isCreator = task?.created_by_user_id === user?.id;
  const isAssignee = task?.assigned_to_user_id === user?.id;
  // User can edit if they are admin or the creator of the task
  const canEdit = isAdmin || isCreator; 

  // --- Effects ---
  // Effect to fetch necessary data on component mount or when ID changes
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null); // Clear previous errors

        // Fetch users for the assignment dropdown
        const usersResponse = await api.get<APIResponse<User[]>>('/users');
        if (usersResponse.data.success && usersResponse.data.data) {
          setUsers(usersResponse.data.data);
        } else {
          console.error("Failed to fetch users:", usersResponse.data.error);
          // Optionally set an error state here if users are critical
        }
        
        // If editing an existing task, fetch its details
        if (!isNewTask && id) {
          const taskResponse = await api.get<APIResponse<Task>>(`/tasks/${id}`);
          if (taskResponse.data.success && taskResponse.data.data) {
            setTask(taskResponse.data.data); // Set task state
          } else {
            setError(taskResponse.data.error || 'Failed to load task details');
          }
        }
        
      } catch (error: any) {
        console.error('Error fetching task details:', error);
        setError(error.response?.data?.error || 'Failed to load task details');
      } finally {
        setLoading(false); // Set loading to false after fetching
      }
    };
    
    fetchData();
  }, [id, isNewTask]); // Dependencies: re-run if id or isNewTask changes

  // --- Handlers ---
  // Handle form submission for creating or updating a task
  const handleSubmit = async (values: any) => {
    setError(null); // Clear previous errors
    try {
      // Create a mutable copy of the form values to modify
      const payload = { ...values };

      // --- Payload Adjustments ---
      // Handle unassigned user: Convert empty string to null
      if (payload.assigned_to_user_id === '') {
        payload.assigned_to_user_id = null; 
      }
      
      // Handle empty or valid due date: Convert empty string to null, 
      // otherwise format valid date to ISO string (RFC3339 compatible)
      if (payload.due_date === '' || !payload.due_date) {
          payload.due_date = null; 
      } else {
          // Convert YYYY-MM-DD to a Date object and then to ISO string (e.g., "2025-04-23T00:00:00.000Z")
          // Appending time ensures it's parsed correctly by Go's time.Time
          try {
             // Create date assuming local timezone midnight, then convert to ISO string (UTC)
             const localDate = new Date(payload.due_date + 'T00:00:00'); 
             if (!isNaN(localDate.getTime())) { // Check if date parsing was successful
                 payload.due_date = localDate.toISOString();
             } else {
                 // Handle invalid date input if necessary, though Yup should catch it
                 console.warn("Invalid date value received from form:", payload.due_date);
                 payload.due_date = null; // Set to null if invalid
             }
          } catch (dateError) {
              console.error("Error processing date:", dateError);
              payload.due_date = null; // Set to null on error
          }
      } 
      
      // Handle empty recurrence rule: Convert empty string to null
      if (!payload.is_recurring || payload.recurrence_rule === '') {
          payload.recurrence_rule = null; 
      }
      // --- END Payload Adjustments ---

      // If it's a new task, POST to the tasks endpoint
      if (isNewTask) {
        const response = await api.post<APIResponse<Task>>('/tasks', payload);
        if (response.data.success && response.data.data) {
          // Navigate to the newly created task's detail page
          navigate(`/tasks/${response.data.data.id}`); 
        } else {
          // Set specific error message if available, otherwise generic
          setError(response.data.error || 'Failed to create task');
        }
      // If editing an existing task, PUT to the specific task endpoint
      } else {
        const response = await api.put<APIResponse<Task>>(`/tasks/${id}`, payload);
        if (response.data.success && response.data.data) {
          setTask(response.data.data); // Update local task state
          setEditMode(false); // Exit edit mode
        } else {
           // Set specific error message if available, otherwise generic
          setError(response.data.error || 'Failed to update task');
        }
      }
    } catch (err: any) {
      // Log and set error state if API call fails
      console.error('Error saving task:', err);
       // Provide more specific feedback based on the error status
      if (err.response?.status === 401) {
           setError('Authentication error. Please try logging out and back in.');
      } else if (err.response?.status === 400) {
           // Use the specific error from backend if available
           setError(`Invalid data: ${err.response?.data?.error || 'Please check the form fields.'}`);
      } else {
           setError(err.response?.data?.error || 'An unexpected error occurred while saving the task.');
      }
    }
  };
  
  // Handle updating the task status
  const handleStatusUpdate = async (status: string) => {
    setError(null); // Clear previous errors
    if (!id) return; // Should not happen if button is visible

    try {
      // Prepare the status update payload
      const statusUpdate: TaskStatusUpdate = { status: status as any }; // Cast status string to TaskStatus type
      // PUT request to the status update endpoint
      const response = await api.put<APIResponse<Task>>(`/tasks/${id}/status`, statusUpdate);
      
      if (response.data.success && response.data.data) {
        setTask(response.data.data); // Update local task state with new status
      } else {
        setError(response.data.error || `Failed to update task status to ${status}`);
      }
    } catch (err: any) {
      // Log and set error state if API call fails
      console.error('Error updating task status:', err);
      setError(err.response?.data?.error || `Failed to update task status to ${status}`);
    }
  };

  // --- Helper Functions ---
  // Format date string to 'Mon D, YYYY'
  const formatDate = (dateString?: string | null): string => {
    if (!dateString) return '';
    try {
      // Use UTC parsing to avoid timezone shifts from just YYYY-MM-DD
      const date = new Date(dateString); 
       // Check if date is valid after parsing
      if (isNaN(date.getTime())) {
          // Try parsing assuming it might already be YYYY-MM-DD
          const parts = dateString.split('-');
          if (parts.length === 3) {
              const year = parseInt(parts[0], 10);
              const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
              const day = parseInt(parts[2], 10);
              const localDate = new Date(Date.UTC(year, month, day));
               if (!isNaN(localDate.getTime())) {
                   return localDate.toLocaleDateString('en-US', {
                       timeZone: 'UTC', // Specify UTC for consistency
                       month: 'short',
                       day: 'numeric',
                       year: 'numeric'
                   });
               }
          }
          return 'Invalid Date'; // Return if parsing fails
      }
      // If parsed directly as ISO string (e.g., from backend)
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch (e) {
      console.error("Error formatting date:", dateString, e);
      return 'Invalid Date';
    }
  };
  
  // Format date string to include time
  const formatDateTime = (dateString?: string | null): string => {
    if (!dateString) return '';
     try {
      const date = new Date(dateString);
      // Check if date is valid before formatting
      if (isNaN(date.getTime())) return 'Invalid Date';
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } catch (e) {
      console.error("Error formatting date/time:", dateString, e);
      return 'Invalid Date';
    }
  };
  
  // --- Render Logic ---
  // Display loading indicator
  if (loading) {
    return (
      <div className="task-detail-page loading">
        <div className="loader"></div>
        <p>Loading task details...</p>
      </div>
    );
  }

  // Display error message if loading failed for an existing task
  if (error && !isNewTask) {
    return (
      <div className="task-detail-page error">
        <h1>Error</h1>
        <p>{error}</p>
        <button onClick={() => navigate('/tasks')} className="back-button">
          Back to Tasks
        </button>
      </div>
    );
  }

  // Define initial values for the Formik form
  const initialValues = isNewTask ? {
    // Defaults for a new task
    title: '',
    description: '',
    assigned_to_user_id: '', // Default to empty string for the dropdown
    due_date: '', // Default to empty string for date input
    is_recurring: false,
    recurrence_rule: '' // Default to empty string for dropdown
  } : {
    // Values from the fetched task for editing
    title: task?.title || '',
    description: task?.description || '',
    assigned_to_user_id: task?.assigned_to_user_id || '', // Use existing or empty string
    // Format date for the date input field (YYYY-MM-DD) or empty string
    // Ensure we handle potential timezone issues by parsing as UTC if just date is present
    due_date: task?.due_date ? new Date(task.due_date).toISOString().split('T')[0] : '', 
    is_recurring: task?.is_recurring || false,
    recurrence_rule: task?.recurrence_rule || '' // Use existing or empty string
  };

  // Main component render
  return (
    <div className="task-detail-page">
      {/* Page Header */}
      <div className="page-header">
        <div className="header-left">
          <button onClick={() => navigate('/tasks')} className="back-button">
            ← Back to Tasks
          </button>
          <h1>{isNewTask ? 'Create New Task' : `Task #${task?.task_number}: ${task?.title}`}</h1>
        </div>
        {/* Show Edit button only when viewing existing task and user has permission */}
        {!isNewTask && !editMode && canEdit && (
          <div className="header-right">
            <button 
              className="edit-task-btn"
              onClick={() => setEditMode(true)} // Enter edit mode on click
            >
              Edit Task
            </button>
          </div>
        )}
      </div>
      
      {/* Display error message if any */}
      {error && <div className="error-message">{error}</div>}
      
      {/* Main Task Container */}
      <div className="task-container">
        {/* Conditional rendering: Show form if in edit mode or creating new task */}
        {(editMode || isNewTask) ? (
          <div className="task-form-container">
            {/* Formik component for form handling and validation */}
            <Formik
              initialValues={initialValues}
              validationSchema={TaskSchema}
              onSubmit={handleSubmit} // Use the defined submit handler
              enableReinitialize // Ensure form updates if initialValues change (e.g., after fetch)
            >
              {/* Render prop function providing form state and helpers */}
              {({ isSubmitting, values }) => (
                <Form className="task-form">
                  {/* Title Field */}
                  <div className="form-group">
                    <label htmlFor="title">Title</label>
                    <Field
                      type="text"
                      name="title"
                      id="title"
                      placeholder="Enter task title"
                    />
                    <ErrorMessage name="title" component="div" className="error" />
                  </div>
                  
                  {/* Description Field */}
                  <div className="form-group">
                    <label htmlFor="description">Description</label>
                    <Field
                      as="textarea" // Use textarea for longer descriptions
                      name="description"
                      id="description"
                      placeholder="Enter task description (optional)"
                      rows={4}
                    />
                    <ErrorMessage name="description" component="div" className="error" />
                  </div>
                  
                  {/* Assigned To Field */}
                  <div className="form-group">
                    <label htmlFor="assigned_to_user_id">Assigned To</label>
                    <Field as="select" name="assigned_to_user_id" id="assigned_to_user_id">
                      {/* Default unassigned option */}
                      <option value="">-- Unassigned --</option> 
                      {/* Map fetched users to options */}
                      {users.map(u => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({u.email})
                        </option>
                      ))}
                    </Field>
                    <ErrorMessage name="assigned_to_user_id" component="div" className="error" />
                  </div>
                  
                  {/* Due Date Field */}
                  <div className="form-group">
                    <label htmlFor="due_date">Due Date</label>
                    <Field
                      type="date" // HTML5 date input
                      name="due_date"
                      id="due_date"
                    />
                    <ErrorMessage name="due_date" component="div" className="error" />
                  </div>
                  
                  {/* Recurring Task Checkbox */}
                  <div className="form-group checkbox">
                    <label>
                      <Field type="checkbox" name="is_recurring" />
                      Recurring Task
                    </label>
                    <ErrorMessage name="is_recurring" component="div" className="error" />
                  </div>
                  
                  {/* Recurrence Pattern Field (conditional) */}
                  {values.is_recurring && ( // Only show if recurring is checked
                    <div className="form-group">
                      <label htmlFor="recurrence_rule">Recurrence Pattern</label>
                      <Field as="select" name="recurrence_rule" id="recurrence_rule">
                        <option value="">-- Select Pattern --</option>
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                        <option value="quarterly">Quarterly</option>
                        <option value="annually">Annually</option>
                      </Field>
                      {/* Error message specifically for recurrence rule */}
                      <ErrorMessage name="recurrence_rule" component="div" className="error" />
                    </div>
                  )}
                  
                  {/* Form Actions (Cancel/Submit Buttons) */}
                  <div className="form-actions">
                    <button 
                      type="button" // Important: type="button" to prevent form submission
                      onClick={() => {
                        if (isNewTask) {
                          navigate('/tasks'); // Go back if creating new
                        } else {
                          setEditMode(false); // Exit edit mode if editing
                          setError(null); // Clear errors on cancel
                        }
                      }}
                      className="cancel-btn"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit" // Standard submit button
                      disabled={isSubmitting} // Disable while submitting
                      className="submit-btn"
                    >
                      {/* Dynamic button text */}
                      {isSubmitting ? 'Saving...' : isNewTask ? 'Create Task' : 'Update Task'}
                    </button>
                  </div>
                </Form>
              )}
            </Formik>
          </div>
        ) : (
          /* --- Display Mode (when not editing) --- */
          <>
            <div className="task-details">
              {/* Status Bar */}
              <div className="status-bar">
                <span className={`status-badge status-${task?.status?.toLowerCase()?.replace(' ', '-')}`}>
                  {task?.status}
                </span>
                
                {/* Status update buttons (conditional) */}
                {task?.status !== 'Completed' && (isAdmin || isAssignee) && (
                  <div className="status-actions">
                    {task?.status === 'Open' && (
                      <button 
                        className="start-btn"
                        onClick={() => handleStatusUpdate('In Progress')}
                      >
                        Start Working
                      </button>
                    )}
                    {task?.status === 'In Progress' && (
                      <button 
                        className="complete-btn"
                        onClick={() => handleStatusUpdate('Completed')}
                      >
                        Mark Completed
                      </button>
                    )}
                  </div>
                )}
              </div>
              
              {/* Title and Description */}
              <div className="detail-section">
                <h3>{task?.title}</h3>
                <p className="description">
                  {/* Use pre-line to respect newlines in description */}
                  {task?.description ? (
                     <span style={{ whiteSpace: 'pre-line' }}>{task.description}</span>
                  ) : ( 
                     <span className="no-description">No description provided</span>
                  )}
                </p>
              </div>
              
              {/* Metadata Section */}
              <div className="meta-section">
                <div className="meta-item">
                  <span className="meta-label">Task #:</span>
                  <span className="meta-value">{task?.task_number}</span> 
                </div>
                <div className="meta-item">
                    <span className="meta-label">Internal ID:</span>
                    <span className="meta-value" style={{ fontSize: '0.8em', wordBreak: 'break-all' }}>({task?.id})</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">Assigned To:</span>
                  <span className="meta-value">
                    {task?.assigned_to_user ? task.assigned_to_user.name : 'Unassigned'}
                  </span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">Due Date:</span>
                  {/* Add 'overdue' class if applicable */}
                  <span className={`meta-value ${task?.due_date && new Date(task.due_date) < new Date() && task?.status !== 'Completed' ? 'overdue' : ''}`}>
                    {task?.due_date ? formatDate(task.due_date) : 'No due date'}
                  </span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">Created By:</span>
                  <span className="meta-value">
                    {task?.created_by_user ? task.created_by_user.name : 'System'}
                  </span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">Created:</span>
                  <span className="meta-value">
                    {task ? formatDateTime(task.created_at) : ''}
                  </span>
                </div>
                {/* Display recurrence if applicable */}
                {task?.is_recurring && (
                  <div className="meta-item">
                    <span className="meta-label">Recurrence:</span>
                    <span className="meta-value">
                      {task.recurrence_rule || 'Yes (Pattern not specified)'}
                    </span>
                  </div>
                )}
                {/* Display completion date if applicable */}
                {task?.completed_at && (
                  <div className="meta-item">
                    <span className="meta-label">Completed:</span>
                    <span className="meta-value">
                      {formatDateTime(task.completed_at)}
                    </span>
                  </div>
                )}
              </div>
            </div>
            
            {/* Action Buttons (Edit, Assign, Delete) */}
            <div className="task-actions">
              {/* Edit Button */}
              {(canEdit && task?.status !== 'Completed') && (
                <button 
                  className="edit-btn"
                  onClick={() => setEditMode(true)}
                >
                  Edit Task
                </button>
              )}
              
              {/* Assign to Me Button (if unassigned and not completed) */}
              {task?.status !== 'Completed' && !task?.assigned_to_user_id && (
                <button 
                  className="assign-to-me-btn"
                  onClick={async () => {
                    setError(null); // Clear previous errors
                    if (!id || !user?.id || !task) return; // Ensure task data is available
                    try {
                      // Prepare payload to assign to current user
                      // Only send fields relevant for update, especially avoiding user objects
                      // Use the TaskCreate type for the payload structure
                      const assignPayload: Partial<TaskCreate> & { id?: string } = { 
                          // id: task.id, // ID is usually part of the URL, not payload for PUT
                          title: task.title,
                          description: task.description || undefined, // Send undefined if null/empty
                          assigned_to_user_id: user.id, // Set assignee (Corrected field name)
                          due_date: task.due_date || undefined,
                          is_recurring: task.is_recurring || false,
                          recurrence_rule: task.recurrence_rule || undefined
                      };
                      
                      const response = await api.put<APIResponse<Task>>(`/tasks/${id}`, assignPayload);
                      if (response.data.success && response.data.data) {
                        setTask(response.data.data); // Update local state
                      } else {
                         setError(response.data.error || 'Failed to assign task');
                      }
                    } catch (err: any) {
                      console.error('Error assigning task:', err);
                      setError(err.response?.data?.error || 'Failed to assign task');
                    }
                  }}
                >
                  Assign to Me
                </button>
              )}
              
              {/* Delete Button (if admin or creator) */}
              {(isAdmin || isCreator) && (
                <button 
                  className="delete-btn"
                  onClick={() => {
                    if (window.confirm('Are you sure you want to delete this task? This action cannot be undone.')) {
                      api.delete(`/tasks/${id}`)
                        .then(() => {
                          navigate('/tasks'); // Navigate back to list on success
                        })
                        .catch(err => {
                          console.error('Error deleting task:', err);
                          setError(err.response?.data?.error || 'Failed to delete task');
                        });
                    }
                  }}
                >
                  Delete Task
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default TaskDetailPage;
