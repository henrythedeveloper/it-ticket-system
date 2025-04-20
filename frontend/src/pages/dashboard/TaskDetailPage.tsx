import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { Task, User, TaskStatusUpdate, APIResponse } from '../../types/models';

const TaskSchema = Yup.object().shape({
  title: Yup.string().required('Title is required'),
  description: Yup.string(),
  assigned_to_user_id: Yup.string().nullable(),
  due_date: Yup.date().nullable(),
  is_recurring: Yup.boolean(),
  recurrence_rule: Yup.string().when('is_recurring', ([isRecurring], schema) =>
    isRecurring ? schema.required('Recurrence rule is required when task is recurring') : schema
  )
});

const TaskDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const isNewTask = id === 'new';
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [task, setTask] = useState<Task | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(isNewTask);
  
  const isAdmin = user?.role === 'Admin';
  const isCreator = task?.created_by_user_id === user?.id;
  const isAssignee = task?.assigned_to_user_id === user?.id;
  const canEdit = isAdmin || isCreator;

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch users for assignment dropdown
        const usersResponse = await api.get<APIResponse<User[]>>('/users');
        if (usersResponse.data.success && usersResponse.data.data) {
          setUsers(usersResponse.data.data);
        }
        
        // If not a new task, fetch task details
        if (!isNewTask && id) {
          const taskResponse = await api.get<APIResponse<Task>>(`/tasks/${id}`);
          if (taskResponse.data.success && taskResponse.data.data) {
            setTask(taskResponse.data.data);
          } else {
            setError('Failed to load task details');
          }
        }
        
      } catch (error) {
        console.error('Error fetching task details:', error);
        setError('Failed to load task details');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [id, isNewTask]);
  
  const handleSubmit = async (values: any) => {
    try {
      if (isNewTask) {
        const response = await api.post<APIResponse<Task>>('/tasks', values);
        if (response.data.success && response.data.data) {
          navigate(`/tasks/${response.data.data.id}`);
        } else {
          setError(response.data.error || 'Failed to create task');
        }
      } else {
        const response = await api.put<APIResponse<Task>>(`/tasks/${id}`, values);
        if (response.data.success && response.data.data) {
          setTask(response.data.data);
          setEditMode(false);
        } else {
          setError(response.data.error || 'Failed to update task');
        }
      }
    } catch (err: any) {
      console.error('Error saving task:', err);
      setError(err.response?.data?.error || 'Failed to save task');
    }
  };
  
  const handleStatusUpdate = async (status: string) => {
    try {
      const statusUpdate: TaskStatusUpdate = { status: status as any };
      const response = await api.put<APIResponse<Task>>(`/tasks/${id}/status`, statusUpdate);
      
      if (response.data.success && response.data.data) {
        setTask(response.data.data);
      } else {
        setError(response.data.error || `Failed to update task status to ${status}`);
      }
    } catch (err: any) {
      console.error('Error updating task status:', err);
      setError(err.response?.data?.error || `Failed to update task status to ${status}`);
    }
  };
  
  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };
  
  const formatDateTime = (dateString: string) => {
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
      <div className="task-detail-page loading">
        <div className="loader"></div>
        <p>Loading task details...</p>
      </div>
    );
  }

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

  const initialValues = isNewTask ? {
    title: '',
    description: '',
    assigned_to_user_id: '',
    due_date: '',
    is_recurring: false,
    recurrence_rule: ''
  } : {
    title: task?.title || '',
    description: task?.description || '',
    assigned_to_user_id: task?.assigned_to_user_id || '',
    due_date: task?.due_date ? new Date(task.due_date).toISOString().split('T')[0] : '',
    is_recurring: task?.is_recurring || false,
    recurrence_rule: task?.recurrence_rule || ''
  };

  return (
    <div className="task-detail-page">
      <div className="page-header">
        <div className="header-left">
          <button onClick={() => navigate('/tasks')} className="back-button">
            ← Back to Tasks
          </button>
          <h1>{isNewTask ? 'Create New Task' : `Task #${task?.task_number}: ${task?.title}`}</h1>
        </div>
        {!isNewTask && !editMode && canEdit && (
          <div className="header-right">
            <button 
              className="edit-task-btn"
              onClick={() => setEditMode(true)}
            >
              Edit Task
            </button>
          </div>
        )}
      </div>
      
      {error && <div className="error-message">{error}</div>}
      
      <div className="task-container">
        {(editMode || isNewTask) ? (
          <div className="task-form-container">
            <Formik
              initialValues={initialValues}
              validationSchema={TaskSchema}
              onSubmit={handleSubmit}
            >
              {({ isSubmitting, values, setFieldValue }) => (
                <Form className="task-form">
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
                  
                  <div className="form-group">
                    <label htmlFor="description">Description</label>
                    <Field
                      as="textarea"
                      name="description"
                      id="description"
                      placeholder="Enter task description"
                      rows={4}
                    />
                    <ErrorMessage name="description" component="div" className="error" />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="assigned_to_user_id">Assigned To</label>
                    <Field as="select" name="assigned_to_user_id" id="assigned_to_user_id">
                      <option value="">-- Unassigned --</option>
                      {users.map(user => (
                        <option key={user.id} value={user.id}>
                          {user.name} ({user.email})
                        </option>
                      ))}
                    </Field>
                    <ErrorMessage name="assigned_to_user_id" component="div" className="error" />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="due_date">Due Date</label>
                    <Field
                      type="date"
                      name="due_date"
                      id="due_date"
                    />
                    <ErrorMessage name="due_date" component="div" className="error" />
                  </div>
                  
                  <div className="form-group checkbox">
                    <label>
                      <Field type="checkbox" name="is_recurring" />
                      Recurring Task
                    </label>
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
                  
                  <div className="form-actions">
                    <button 
                      type="button" 
                      onClick={() => {
                        if (isNewTask) {
                          navigate('/tasks');
                        } else {
                          setEditMode(false);
                        }
                      }}
                      className="cancel-btn"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit" 
                      disabled={isSubmitting}
                      className="submit-btn"
                    >
                      {isSubmitting ? 'Saving...' : isNewTask ? 'Create Task' : 'Update Task'}
                    </button>
                  </div>
                </Form>
              )}
            </Formik>
          </div>
        ) : (
          <>
            <div className="task-details">
              <div className="status-bar">
                <span className={`status-badge status-${task?.status?.toLowerCase()?.replace(' ', '-')}`}>
                  {task?.status}
                </span>
                
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
              
              <div className="detail-section">
                <h3>{task?.title}</h3>
                <p className="description">
                  {task?.description || <span className="no-description">No description provided</span>}
                </p>
              </div>
              
              <div className="meta-section">
                <div className="meta-item">
                  <span className="meta-label">Task #:</span>
                  {/* Display task_number */}
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
                
                {task?.is_recurring && (
                  <div className="meta-item">
                    <span className="meta-label">Recurrence:</span>
                    <span className="meta-value">
                      {task.recurrence_rule}
                    </span>
                  </div>
                )}
                
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
            
            <div className="task-actions">
              {(isAdmin || isCreator) && task?.status !== 'Completed' && (
                <button 
                  className="edit-btn"
                  onClick={() => setEditMode(true)}
                >
                  Edit Task
                </button>
              )}
              
              {task?.status !== 'Completed' && !task?.assigned_to_user_id && (
                <button 
                  className="assign-to-me-btn"
                  onClick={async () => {
                    try {
                      const response = await api.put<APIResponse<Task>>(`/tasks/${id}`, {
                        ...task,
                        assigned_to_user_id: user?.id
                      });
                      if (response.data.success && response.data.data) {
                        setTask(response.data.data);
                      }
                    } catch (err) {
                      console.error('Error assigning task:', err);
                      setError('Failed to assign task');
                    }
                  }}
                >
                  Assign to Me
                </button>
              )}
              
              {(isAdmin || isCreator) && (
                <button 
                  className="delete-btn"
                  onClick={() => {
                    if (window.confirm('Are you sure you want to delete this task?')) {
                      api.delete(`/tasks/${id}`)
                        .then(() => {
                          navigate('/tasks');
                        })
                        .catch(err => {
                          console.error('Error deleting task:', err);
                          setError('Failed to delete task');
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