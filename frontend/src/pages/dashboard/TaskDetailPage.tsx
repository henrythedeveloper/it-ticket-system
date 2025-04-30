import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Loader from '../../components/common/Loader';
import Badge from '../../components/common/Badge';
import Alert from '../../components/common/Alert';
import Button from '../../components/common/Button';
import TaskForm from '../../components/forms/TaskForm';
import Modal from '../../components/common/Modal';
import { useAuth } from '../../hooks/useAuth';
import { fetchTaskById, deleteTask } from '../../services/taskService';
import { fetchUsers } from '../../services/userService';
import { Task, User } from '../../types';
import { formatDateTime } from '../../utils/helpers';
import { ArrowLeft, Edit, Trash2 } from 'lucide-react';

const TaskDetailPage: React.FC = () => {
  const { taskId } = useParams<{ taskId?: string }>(); // Use optional taskId
  const navigate = useNavigate();
  const { user } = useAuth();

  const [task, setTask] = useState<Task | null>(null);
  const [assignableUsers, setAssignableUsers] = useState<Pick<User, 'id' | 'name'>[]>([]);
  // Separate loading states
  const [isLoadingTask, setIsLoadingTask] = useState<boolean>(!!taskId); // Only true initially if editing
  const [isLoadingUsers, setIsLoadingUsers] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState<boolean>(!taskId); // Start in edit mode if creating
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const isCreateMode = !taskId;

  // --- Data Fetching ---
  const loadTaskDetails = useCallback(async () => {
    if (!taskId) { // Only fetch if taskId exists
        setIsLoadingTask(false);
        return;
    }
    setIsLoadingTask(true);
    setError(null);
    try {
      const taskData = await fetchTaskById(taskId);
      setTask(taskData);
    } catch (err: any) {
      console.error("Failed to load task details:", err);
      setError(err.response?.data?.message || err.message || 'Could not load task details.');
      setTask(null); // Clear task on error
    } finally {
      setIsLoadingTask(false);
    }
  }, [taskId]);

  const loadAssignableUsers = useCallback(async () => {
    setIsLoadingUsers(true);
    try {
      const usersData = await fetchUsers({ role: 'Admin,Staff', limit: 500 });
      setAssignableUsers(usersData.data.map(u => ({ id: u.id, name: u.name })));
    } catch (err) {
      console.error("Failed to load assignable users:", err);
      // Optional: Set a specific error for user loading failure
      // setError("Could not load users for assignment.");
    } finally {
      setIsLoadingUsers(false);
    }
  }, []);

  // --- Effects ---
  useEffect(() => {
    loadTaskDetails(); // Fetch task details if taskId is present
  }, [loadTaskDetails]); // Rerun only if taskId changes

  useEffect(() => {
    loadAssignableUsers(); // Fetch assignable users on mount
  }, [loadAssignableUsers]);

  // Reset editing state if switching between create/edit mode via URL
  useEffect(() => {
      setIsEditing(isCreateMode);
      if (isCreateMode) {
          setTask(null); // Ensure task is null in create mode
      }
  }, [isCreateMode]);


  // --- Handlers ---
  const handleSaveSuccess = (savedTask: Task) => {
    // If created, navigate to the new task's detail page
    if (isCreateMode) {
        navigate(`/tasks/${savedTask.id}`, { replace: true }); // Navigate to the newly created task
    } else {
        setTask(savedTask); // Update existing task state
        setIsEditing(false); // Exit edit mode
    }
  };

  const handleCancelEdit = () => {
    if (isCreateMode) {
        navigate('/tasks'); // Go back to list if cancelling create
    } else {
        setIsEditing(false); // Exit edit mode
        setError(null); // Clear potential errors from failed edit attempt
        // Optionally reload task data to discard unsaved changes
        // loadTaskDetails();
    }
  };

  const handleDelete = async () => {
    if (!task) return;
    setIsDeleting(true);
    setError(null);
    try {
      await deleteTask(task.id);
      setShowDeleteModal(false);
      navigate('/tasks');
    } catch (err: any) {
      console.error("Failed to delete task:", err);
      setError(err.response?.data?.message || err.message || 'Could not delete task.');
      setIsDeleting(false);
    }
  };

  // --- Render Logic ---
  const isLoading = isLoadingTask || isLoadingUsers; // Overall loading state

  if (isLoading) return <Loader text="Loading..." />;
  // Display error only if not in create mode OR if it's a user loading error
  if (error && !isCreateMode) return <Alert type="error" message={error} />;
  // If editing and task data failed to load
  if (!isCreateMode && !task) return <Alert type="warning" message="Task data not found." />;

  // --- Render ---
  return (
    <div className="task-detail-page">
      {/* Page Header - Uses updated logic */}
      <div className="page-header">
        <div className="header-left">
          <Link to="/tasks" className="back-button">
            <ArrowLeft size={16} style={{ marginRight: '4px' }} /> Back to Tasks
          </Link>
          {/* Updated Title Logic */}
          <h1>{isCreateMode ? 'Create New Task' : (isEditing ? `Edit Task #${task?.task_number}` : `Task #${task?.task_number}`)}</h1>
        </div>
        <div className="header-right">
            {/* Show Edit button only in view mode */}
          {!isCreateMode && !isEditing && task && (
            <Button variant="outline" onClick={() => setIsEditing(true)} leftIcon={<Edit size={16} />}>
              Edit Task
            </Button>
          )}
        </div>
      </div>

      {/* Main Content Area (Form or Details) */}
      <div className="task-container">
        {/* Show Form if creating OR editing */}
        {(isCreateMode || isEditing) ? (
          <div className="task-form-container">
            <TaskForm
              task={task} // Pass null in create mode, task object in edit mode
              onSaveSuccess={handleSaveSuccess}
              onCancel={handleCancelEdit}
              assignableUsers={assignableUsers} // Pass the loaded users
              // Pass ticketId if creating task from a ticket page (might need modification)
              // ticketId={isCreateMode ? perhapsFromLocationState : task?.ticketId}
            />
          </div>
        ) : task ? (
          // --- View Mode: Render Details ---
          <div className="task-details">
            {/* Status Bar */}
            <div className="status-bar">
              <Badge type={task.status === 'In Progress' ? 'progress' : task.status.toLowerCase() as any}>
                Status: {task.status}
              </Badge>
            </div>
            {/* Task Title */}
            <h2 className="task-title-detail">{task.title}</h2>
            {/* Description Section */}
            <section className="detail-section">
              <h3>Description</h3>
              <div className="description">
                {task.description ? task.description : <span className="no-description">No description provided.</span>}
              </div>
            </section>
            {/* Metadata Section */}
            <section className="meta-section">
              <div className="meta-item">
                <label className="meta-label">Assignee</label>
                <span className="meta-value">{task.assignedTo?.name || 'Unassigned'}</span>
              </div>
              <div className="meta-item">
                <label className="meta-label">Due Date</label>
                <span className={`meta-value ${task.due_date && new Date(task.due_date) < new Date() && task.status !== 'Completed' ? 'overdue' : ''}`}>
                  {task.due_date ? formatDateTime(task.due_date, 'MMM d, yyyy') : 'Not set'}
                </span>
              </div>
              <div className="meta-item">
                <label className="meta-label">Created By</label>
                <span className="meta-value">{task.createdBy?.name || 'Unknown'}</span>
              </div>
              <div className="meta-item">
                <label className="meta-label">Created At</label>
                <span className="meta-value">{formatDateTime(task.created_at)}</span>
              </div>
              <div className="meta-item">
                <label className="meta-label">Last Updated</label>
                <span className="meta-value">{formatDateTime(task.updated_at)}</span>
              </div>
              {/* Display Related Ticket Link if task.task_id exists */}
              {task.task_id && (
                  <div className="meta-item">
                    <label className="meta-label">Related Ticket</label>
                    {/* Assuming ticketId is stored in task.task_id */}
                    <span className="meta-value">
                      <Link to={`/tickets/${task.task_id}`}>Ticket #{task.task_id.substring(0, 6)}...</Link>
                    </span>
                  </div>
                )}
            </section>
            {/* Actions Section */}
            <div className="task-actions">
              <Button variant="danger" onClick={() => setShowDeleteModal(true)} leftIcon={<Trash2 size={16} />}>
                Delete Task
              </Button>
            </div>
          </div>
        ) : null /* Fallback if task is null unexpectedly */}
      </div>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Confirm Deletion" >
        <p>Are you sure you want to delete this task? This action cannot be undone.</p>
        {error && <Alert type="error" message={error} className="mt-4" />}
        <div className="form-actions mt-6">
          <Button variant="outline" onClick={() => setShowDeleteModal(false)} disabled={isDeleting}> Cancel </Button>
          <Button variant="danger" onClick={handleDelete} isLoading={isDeleting} disabled={isDeleting}> {isDeleting ? 'Deleting...' : 'Delete Task'} </Button>
        </div>
      </Modal>
    </div>
  );
};

export default TaskDetailPage;