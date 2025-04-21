import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import api from '../../services/api'; // Assuming api service is correctly configured
import { useAuth } from '../../contexts/AuthContext'; // Auth context for user info
import {
  Task,
  User,
  TaskStatus, // Explicitly import TaskStatus
  TaskStatusUpdate,
  APIResponse,
  TaskCreate,
  TaskUpdate, // Import new type
  TaskUpdateCreate // Import new type
} from '../../types/models'; // Import necessary types including new ones

// --- Validation Schema for the Task Form ---
const TaskSchema = Yup.object().shape({
  title: Yup.string().required('Title is required'),
  description: Yup.string().nullable(), // Description is optional
  assigned_to_user_id: Yup.string().nullable(), // Allow null or UUID string
  due_date: Yup.date().nullable(), // Allow null or valid date
  is_recurring: Yup.boolean().required(), // Now required
  recurrence_rule: Yup.string().when('is_recurring', ([isRecurring], schema) =>
    // Recurrence rule required only if task is recurring
    isRecurring ? schema.required('Recurrence rule is required when task is recurring') : schema.nullable()
  )
});

// --- Validation Schema for the Task Update/Comment Form ---
const TaskUpdateSchema = Yup.object().shape({
  comment: Yup.string().required('Update comment cannot be empty')
});

// --- Task Detail Page Component ---
const TaskDetailPage: React.FC = () => {
  // --- Hooks ---
  const { id } = useParams<{ id: string }>(); // Get task ID from URL params
  const navigate = useNavigate(); // Hook for programmatic navigation
  const { user: currentUser } = useAuth(); // Get current logged-in user

  // --- State ---
  const [task, setTask] = useState<Task | null>(null); // Holds the fetched task data
  const [users, setUsers] = useState<User[]>([]); // Holds the list of users for assignment dropdown
  const [loading, setLoading] = useState<boolean>(true); // Loading state indicator
  const [error, setError] = useState<string | null>(null); // Error message state
  const [editMode, setEditMode] = useState<boolean>(id === 'new'); // Edit mode state (true if creating new task)
  const [showUpdateForm, setShowUpdateForm] = useState<boolean>(false); // State to control update form visibility

  // --- Derived State / Constants ---
  const isNewTask = id === 'new'; // Flag for creating a new task

  // --- Permissions ---
  const isAdmin = currentUser?.role === 'Admin';
  // *** FIX: Define isCreator and isAssignee BEFORE they are used in canAddUpdate ***
  const isCreator = task && task.created_by_user_id === currentUser?.id;
  const isAssignee = task && task.assigned_to_user_id === currentUser?.id;
  // User can edit if Admin, or if they created the task
  const canEdit = isAdmin || isCreator;
  // User can update status if Admin, or assigned to the task
  const canUpdateStatus = isAdmin || isAssignee;
  // Allow adding updates if admin, creator, or assignee, and task is not completed
  const canAddUpdate = (isAdmin || isCreator || isAssignee) && task?.status !== 'Completed';


  // --- Data Fetching Effect ---
  const fetchData = useCallback(async () => {
    // Only fetch if not creating a new task
    if (isNewTask) {
       setLoading(false);
       // Still fetch users for the form dropdown
       try {
           const usersResponse = await api.get<APIResponse<User[]>>('/users');
           if (usersResponse.data.success && usersResponse.data.data) {
               setUsers(usersResponse.data.data);
           } else {
               console.error("Failed to fetch users for new task form:", usersResponse.data.error);
           }
       } catch (err) {
           console.error("Error fetching users for new task form:", err);
       }
       return; // Exit early for new tasks
    }

    setLoading(true);
    setError(null);
    try {
      // Fetch users for the assignment dropdown
      const usersResponse = await api.get<APIResponse<User[]>>('/users');
      if (usersResponse.data.success && usersResponse.data.data) {
        setUsers(usersResponse.data.data);
      } else {
        console.error("Failed to fetch users:", usersResponse.data.error);
      }

      // Fetch task details (including updates - requires backend change)
      if (id) {
        // *** Backend Requirement: GET /tasks/{id} must return task object with populated 'updates' array ***
        const taskResponse = await api.get<APIResponse<Task>>(`/tasks/${id}`);
        if (taskResponse.data.success && taskResponse.data.data) {
          setTask(taskResponse.data.data);
        } else {
          setError(taskResponse.data.error || 'Failed to load task details');
        }
      }
    } catch (err: any) {
      console.error('Error fetching data:', err);
      setError(err.response?.data?.error || 'An unexpected error occurred while loading data.');
    } finally {
      setLoading(false);
    }
  // Include currentUser?.id in dependencies in case it changes (e.g., re-login)
  }, [id, isNewTask, currentUser?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]); // fetchData is memoized

  // --- Helper Functions ---
  const formatDate = (dateString?: string | null): string => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Invalid Date';
      return date.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' });
    } catch (e) { return 'Invalid Date'; }
  };

  const formatDateTime = (dateString?: string | null): string => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Invalid Date';
      return date.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
    } catch (e) { return 'Invalid Date'; }
  };

  const getStatusClass = (status?: TaskStatus): string => {
    if (!status) return '';
    return `status-${status.toLowerCase().replace(' ', '-')}`;
  };

  // --- Event Handlers ---

  // Handle form submission for creating or updating a task
  const handleFormSubmit = async (values: TaskCreate) => {
    setError(null); // Clear previous errors
    try {
      // Prepare payload, ensuring correct undefined/string values and date format
      const payload: TaskCreate = {
        ...values,
        assigned_to_user_id: values.assigned_to_user_id || undefined,
        due_date: values.due_date ? new Date(values.due_date + 'T00:00:00Z').toISOString() : undefined,
        recurrence_rule: values.is_recurring && values.recurrence_rule ? values.recurrence_rule : undefined,
      };

      let response;
      if (isNewTask) {
        // Create new task
        response = await api.post<APIResponse<Task>>('/tasks', payload);
        if (response.data.success && response.data.data) {
          navigate(`/tasks/${response.data.data.id}`); // Navigate to the new task's page
        } else { setError(response.data.error || 'Failed to create task'); }
      } else {
        // Update existing task
        response = await api.put<APIResponse<Task>>(`/tasks/${id}`, payload);
        if (response.data.success && response.data.data) {
          setTask(response.data.data); // Update local task state
          setEditMode(false); // Exit edit mode
        } else { setError(response.data.error || 'Failed to update task'); }
      }
    } catch (err: any) {
      console.error('Error saving task:', err);
      setError(err.response?.data?.error || 'An error occurred while saving the task.');
    }
  };

  // Handle status updates
  const handleStatusUpdate = async (newStatus: TaskStatus) => {
    if (!id || !task || task.status === newStatus) return; // Exit if no ID, task, or status is unchanged
    setError(null);
    try {
      const statusUpdate: TaskStatusUpdate = { status: newStatus };
      // *** Backend Requirement: PUT /tasks/{id}/status endpoint ***
      const response = await api.put<APIResponse<Task>>(`/tasks/${id}/status`, statusUpdate);
      if (response.data.success && response.data.data) {
        setTask(response.data.data); // Update local task state
      } else { setError(response.data.error || `Failed to update status`); }
    } catch (err: any) { setError(err.response?.data?.error || `Failed to update status`); }
  };

  // Handle assigning task to current user
  const handleAssignToMe = async () => {
    if (!id || !task || !currentUser?.id || task.assigned_to_user_id === currentUser.id) return; // Exit if already assigned or no user
    setError(null);
    try {
      // Prepare payload to only update the assignee
      const updatePayload: Partial<TaskCreate> = { assigned_to_user_id: currentUser.id };
      // *** Backend Requirement: PUT /tasks/{id} should allow partial updates ***
      const response = await api.put<APIResponse<Task>>(`/tasks/${id}`, updatePayload);
      if (response.data.success && response.data.data) {
        setTask(response.data.data); // Update local state
      } else { setError(response.data.error || 'Failed to assign task'); }
    } catch (err: any) { setError(err.response?.data?.error || 'Failed to assign task'); }
  };

  // Handle task deletion
  const handleDeleteTask = async () => {
    if (!id || !canEdit) return; // Ensure user has permission
    if (window.confirm('Are you sure you want to delete this task?')) {
      setError(null);
      try {
        // *** Backend Requirement: DELETE /tasks/{id} endpoint ***
        const response = await api.delete(`/tasks/${id}`);
        if (response.data.success) {
          navigate('/tasks'); // Navigate back to the task list on successful deletion
        } else { setError(response.data.error || 'Failed to delete task'); }
      } catch (err: any) { setError(err.response?.data?.error || 'Failed to delete task'); }
    }
  };

  // Handle adding a new task update/comment
  const handleAddTaskUpdate = async (values: TaskUpdateCreate, { resetForm }: { resetForm: () => void }) => {
    if (!id || !canAddUpdate) return;
    setError(null);
    try {
      // *** Backend Requirement: POST /tasks/{id}/updates endpoint ***
      const response = await api.post<APIResponse<TaskUpdate>>(`/tasks/${id}/updates`, values);

      if (response.data.success && response.data.data) {
        // Add the new update to the local state
        setTask(prevTask => prevTask ? {
          ...prevTask,
          updates: [...(prevTask.updates || []), response.data.data!]
        } : null);
        resetForm();
        setShowUpdateForm(false); // Hide the form
      } else {
        setError(response.data.error || 'Failed to add update');
      }
    } catch (err: any) {
      console.error('Error adding task update:', err);
      setError(err.response?.data?.error || 'Failed to add update');
    }
  };


  // --- Render Logic ---

  if (loading && !isNewTask) { // Show loading only when fetching existing task
    return <div className="task-detail-page loading"><div className="loader"></div><p>Loading task details...</p></div>;
  }

  if (error && !isNewTask && !task) { // Show error if fetching failed for existing task
    return <div className="task-detail-page error"><h1>Error</h1><p>{error}</p><button onClick={() => navigate('/tasks')} className="back-button">← Back to Tasks</button></div>;
  }

  // Initial values for the main edit form
  const initialFormValues: TaskCreate = {
    title: task?.title || '',
    description: task?.description || '',
    assigned_to_user_id: task?.assigned_to_user_id || '', // Use empty string for 'Unassigned' option
    due_date: task?.due_date ? new Date(task.due_date).toISOString().split('T')[0] : '',
    is_recurring: task?.is_recurring ?? false, // Default to false if null/undefined
    recurrence_rule: task?.recurrence_rule || '',
  };

  // --- Main Component Render ---
  return (
    <div className="task-detail-page">
      {/* Page Header */}
      <div className="page-header">
        <div className="header-left">
          <button onClick={() => navigate('/tasks')} className="back-button">
            ← Back to Tasks
          </button>
          <h1>{isNewTask ? 'Create New Task' : `Task #${task?.task_number}: ${task?.title || '...'}`}</h1>
        </div>
        {!isNewTask && !editMode && canEdit && (
          <div className="header-right">
            <button className="edit-task-btn" onClick={() => setEditMode(true)}>Edit Task</button>
          </div>
        )}
      </div>

      {/* Display general error messages */}
      {error && !showUpdateForm && <div className="error-message">{error}</div> /* Hide main error when update form is open */}

      {/* Main Task Container */}
      <div className="task-container">
        {/* --- Edit/Create Mode --- */}
        {editMode ? (
          <div className="task-form-container">
            <Formik initialValues={initialFormValues} validationSchema={TaskSchema} onSubmit={handleFormSubmit} enableReinitialize>
              {({ isSubmitting, values }) => (
                <Form className="task-form">
                  {/* Fields: Title, Description, Assigned To, Due Date, Recurring, Recurrence Rule */}
                  <div className="form-group">
                    <label htmlFor="title">Title</label>
                    <Field type="text" name="title" id="title" placeholder="Enter task title" />
                    <ErrorMessage name="title" component="div" className="error" />
                  </div>
                  <div className="form-group">
                    <label htmlFor="description">Description</label>
                    <Field as="textarea" name="description" id="description" placeholder="Enter task description (optional)" rows={4} />
                    <ErrorMessage name="description" component="div" className="error" />
                  </div>
                  <div className="form-group">
                    <label htmlFor="assigned_to_user_id">Assigned To</label>
                    <Field as="select" name="assigned_to_user_id" id="assigned_to_user_id">
                      <option value="">-- Unassigned --</option>
                      {users.map(u => (<option key={u.id} value={u.id}>{u.name} ({u.email})</option>))}
                    </Field>
                    <ErrorMessage name="assigned_to_user_id" component="div" className="error" />
                  </div>
                  <div className="form-group">
                    <label htmlFor="due_date">Due Date</label>
                    <Field type="date" name="due_date" id="due_date" />
                    <ErrorMessage name="due_date" component="div" className="error" />
                  </div>
                  <div className="form-group checkbox">
                    <label><Field type="checkbox" name="is_recurring" /> Recurring Task</label>
                    <ErrorMessage name="is_recurring" component="div" className="error" />
                  </div>
                  {values.is_recurring && (
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
                      <ErrorMessage name="recurrence_rule" component="div" className="error" />
                    </div>
                  )}
                  {/* Form Actions */}
                  <div className="form-actions">
                    <button type="button" onClick={() => { isNewTask ? navigate('/tasks') : setEditMode(false); setError(null); }} className="cancel-btn" disabled={isSubmitting}>Cancel</button>
                    <button type="submit" disabled={isSubmitting} className="submit-btn">{isSubmitting ? 'Saving...' : isNewTask ? 'Create Task' : 'Update Task'}</button>
                  </div>
                </Form>
              )}
            </Formik>
          </div>
        ) : (
          /* --- Display Mode --- */
          task && (
            <>
              {/* --- Task Details Section --- */}
              <div className="task-details">
                {/* Status Bar */}
                <div className="status-bar">
                  <span className={`status-badge ${getStatusClass(task.status)}`}>{task.status}</span>
                  {canUpdateStatus && task.status !== 'Completed' && (
                    <div className="status-actions">
                      {task.status === 'Open' && (<button className="start-btn" onClick={() => handleStatusUpdate('In Progress')}>Start Working</button>)}
                      {task.status === 'In Progress' && (<button className="complete-btn" onClick={() => handleStatusUpdate('Completed')}>Mark Completed</button>)}
                    </div>
                  )}
                </div>
                {/* Description Section */}
                <div className="detail-section">
                  <h3>Description</h3>
                  <p className="description">{task.description ? <span style={{ whiteSpace: 'pre-line' }}>{task.description}</span> : <span className="no-description">No description provided.</span>}</p>
                </div>
                {/* Metadata Section */}
                <div className="meta-section">
                  <div className="meta-item"><span className="meta-label">Task #:</span><span className="meta-value">{task.task_number}</span></div>
                  <div className="meta-item"><span className="meta-label">Internal ID:</span><span className="meta-value" style={{ fontSize: '0.8em', wordBreak: 'break-all' }}>({task.id})</span></div>
                  <div className="meta-item"><span className="meta-label">Assigned To:</span><span className="meta-value">{task.assigned_to_user?.name ?? 'Unassigned'}</span></div>
                  <div className="meta-item"><span className="meta-label">Due Date:</span><span className={`meta-value ${task.due_date && new Date(task.due_date) < new Date() && task.status !== 'Completed' ? 'overdue' : ''}`}>{formatDate(task.due_date)}</span></div>
                  <div className="meta-item"><span className="meta-label">Created By:</span><span className="meta-value">{task.created_by_user?.name ?? 'System'}</span></div>
                  <div className="meta-item"><span className="meta-label">Created:</span><span className="meta-value">{formatDateTime(task.created_at)}</span></div>
                  <div className="meta-item"><span className="meta-label">Last Updated:</span><span className="meta-value">{formatDateTime(task.updated_at)}</span></div>
                  {task.is_recurring && (<div className="meta-item"><span className="meta-label">Recurrence:</span><span className="meta-value">{task.recurrence_rule || 'Yes'}</span></div>)}
                  {task.completed_at && (<div className="meta-item"><span className="meta-label">Completed:</span><span className="meta-value">{formatDateTime(task.completed_at)}</span></div>)}
                </div>
              </div>

              {/* --- Task Actions Section --- */}
              <div className="task-actions">
                {task.status !== 'Completed' && !task.assigned_to_user_id && currentUser && (<button className="assign-to-me-btn" onClick={handleAssignToMe}>Assign to Me</button>)}
                {canEdit && (<button className="delete-btn" onClick={handleDeleteTask}>Delete Task</button>)}
              </div>

              {/* --- Task Updates Section --- */}
              <div className="task-updates">
                <div className="updates-header">
                  <h3>Task Updates</h3>
                  {canAddUpdate && !showUpdateForm && (
                    <button className="add-comment-btn" onClick={() => { setShowUpdateForm(true); setError(null); }}>
                      Add Update
                    </button>
                  )}
                </div>

                {/* Add Update Form (Conditional) */}
                {showUpdateForm && (
                  <div className="comment-form-container">
                    <h4>Add New Update</h4>
                    {error && <div className="error-message">{error}</div> /* Show errors specific to this form */}
                    <Formik initialValues={{ comment: '' }} validationSchema={TaskUpdateSchema} onSubmit={handleAddTaskUpdate}>
                      {({ isSubmitting }) => (
                        <Form className="comment-form">
                          <div className="form-group">
                            <Field as="textarea" name="comment" placeholder="Enter your update..." rows={3} />
                            <ErrorMessage name="comment" component="div" className="error" />
                          </div>
                          <div className="form-actions">
                            <button type="button" onClick={() => { setShowUpdateForm(false); setError(null); }} className="cancel-btn" disabled={isSubmitting}>Cancel</button>
                            <button type="submit" disabled={isSubmitting} className="submit-btn">{isSubmitting ? 'Posting...' : 'Post Update'}</button>
                          </div>
                        </Form>
                      )}
                    </Formik>
                  </div>
                )}

                {/* Updates Timeline */}
                <div className="updates-timeline">
                  {task.updates && task.updates.length > 0 ? (
                    [...task.updates].reverse().map(update => (
                      <div key={update.id} className="update-item">
                        <div className="update-header">
                          <span className="update-author">{update.user?.name || 'System'}</span>
                          <span className="update-time">{formatDateTime(update.created_at)}</span>
                        </div>
                        <div className="update-content" style={{ whiteSpace: 'pre-line' }}>{update.comment}</div>
                      </div>
                    ))
                  ) : (
                    !showUpdateForm && <p className="no-updates">No updates posted yet.</p> // Only show if form isn't open
                  )}
                  <div className="update-item system-update">
                    <div className="update-header">
                      <span className="update-author">System</span>
                      <span className="update-time">{formatDateTime(task.created_at)}</span>
                    </div>
                    <div className="update-content">Task created {task.created_by_user ? `by ${task.created_by_user.name}` : ''}.</div>
                  </div>
                </div>
              </div>
            </>
          )
        )}
      </div>
    </div>
  );
};

export default TaskDetailPage;
