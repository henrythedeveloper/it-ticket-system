// src/pages/dashboard/TaskDetailPage.tsx
// ==========================================================================
// Component representing the page for viewing or editing a single task.
// Handles fetching task data and rendering either details or the TaskForm.
// ==========================================================================

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Loader from '../../components/common/Loader';
import Badge from '../../components/common/Badge';
import Alert from '../../components/common/Alert';
import Button from '../../components/common/Button';
import TaskForm from '../../components/forms/TaskForm'; // Task editing form
import Modal from '../../components/common/Modal'; // For delete confirmation
import { useAuth } from '../../hooks/useAuth'; // To get assignable users potentially
import { fetchTaskById, deleteTask } from '../../services/taskService'; // Task API
import { fetchUsers } from '../../services/userService'; // User API (for assignee list)
import { Task, User } from '../../types'; // Import types
import { formatDateTime } from '../../utils/helpers'; // Date formatting
import { ArrowLeft, Edit, Trash2 } from 'lucide-react'; // Icons

// --- Component ---

/**
 * Renders the Task Detail page, allowing viewing, editing, or deleting a task.
 */
const TaskDetailPage: React.FC = () => {
  // --- Hooks ---
  const { taskId } = useParams<{ taskId: string }>(); // Get task ID from URL
  const navigate = useNavigate();
  const { user } = useAuth(); // Get current user info

  // --- State ---
  const [task, setTask] = useState<Task | null>(null);
  const [assignableUsers, setAssignableUsers] = useState<Pick<User, 'id' | 'name'>[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState<boolean>(false); // Toggle edit mode
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false); // Delete confirmation modal
  const [isDeleting, setIsDeleting] = useState<boolean>(false); // Loading state for delete action

  // --- Data Fetching ---
  /**
   * Fetches task details and assignable users.
   * useCallback ensures the function identity is stable unless taskId changes.
   */
  const loadData = useCallback(async () => {
    if (!taskId) {
      setError("Task ID is missing.");
      setIsLoading(false);
      return;
    }
    // Don't refetch if editing
    if (isEditing) {
        setIsLoading(false); // Ensure loading is off if we were editing
        return;
    }

    setIsLoading(true);
    setError(null);
    try {
      // Fetch task and users concurrently
      const [taskData, usersData] = await Promise.all([
        fetchTaskById(taskId),
        fetchUsers({ role: 'Admin,Staff', limit: 500 }) // Fetch users for assignee dropdown
      ]);
      setTask(taskData);
      setAssignableUsers(usersData.data.map(u => ({ id: u.id, name: u.name })));
    } catch (err: any) {
      console.error("Failed to load task details:", err);
      setError(err.response?.data?.message || err.message || 'Could not load task details.');
    } finally {
      setIsLoading(false);
    }
  }, [taskId, isEditing]); // Depend on taskId and isEditing

  // Fetch data on initial mount and when taskId changes
  useEffect(() => {
    loadData();
  }, [loadData]); // Use the memoized loadData function

  // --- Handlers ---
  /**
   * Handles successful save (create or update) from TaskForm.
   * @param savedTask - The task data returned from the API.
   */
  const handleSaveSuccess = (savedTask: Task) => {
    setTask(savedTask); // Update local task state
    setIsEditing(false); // Exit edit mode
    // Optionally show a success message or rely on form's message
  };

  /**
   * Handles cancellation of the edit form.
   */
  const handleCancelEdit = () => {
    setIsEditing(false);
    // Optional: Refetch data if changes might have been discarded uncleanly
    // loadData();
  };

  /**
   * Handles the delete task action.
   */
  const handleDelete = async () => {
    if (!task) return;
    setIsDeleting(true);
    setError(null);
    try {
      await deleteTask(task.id);
      setShowDeleteModal(false); // Close modal
      navigate('/tasks'); // Navigate back to tasks list
    } catch (err: any) {
      console.error("Failed to delete task:", err);
      setError(err.response?.data?.message || err.message || 'Could not delete task.');
      setIsDeleting(false); // Stop delete loading state
      // Keep modal open to show error within it, or close and show on page
      // setShowDeleteModal(false);
    }
  };

  // --- Render Logic ---
  if (isLoading) return <Loader text="Loading task..." />;
  // Show error if loading failed (and not in edit mode, as form might be visible)
  if (error && !isEditing) return <Alert type="error" message={error} />;
  // Show message if task is somehow null after loading without error
  if (!task && !isEditing) return <Alert type="warning" message="Task data not found." />;

  // --- Render ---
  return (
    <div className="task-detail-page">
      {/* Page Header */}
      <div className="page-header">
        <div className="header-left">
          <Link to="/tasks" className="back-button">
            <ArrowLeft size={16} style={{ marginRight: '4px' }} /> Back to Tasks
          </Link>
          <h1>{isEditing ? `Edit Task #${task?.id.substring(0,6)}` : `Task #${task?.id.substring(0,6)}`}</h1>
        </div>
        <div className="header-right">
          {!isEditing && task && ( // Show Edit button only in view mode
            <Button variant="outline" onClick={() => setIsEditing(true)} leftIcon={<Edit size={16} />}>
              Edit Task
            </Button>
          )}
        </div>
      </div>

      {/* Main Content Area (Form or Details) */}
      <div className="task-container">
        {isEditing && task ? (
          // --- Edit Mode: Render Form ---
          <div className="task-form-container">
            <TaskForm
              task={task}
              onSaveSuccess={handleSaveSuccess}
              onCancel={handleCancelEdit}
              assignableUsers={assignableUsers}
              ticketId={task.task_id} // Pass ticketId if available
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
              {/* Optional: Add status change buttons here if needed */}
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
                {task.task_id && (
                  <div className="meta-item">
                    <label className="meta-label">Related Ticket</label>
                    <span className="meta-value">
                      <Link to={`/tickets/${task.task_id}`}>#{task.task_id.substring(0, 6)}...</Link>
                    </span>
                  </div>
                )}
            </section>

            {/* Actions Section */}
            <div className="task-actions">
              {/* Add assign to me button if applicable */}
              {/* <Button variant="secondary">Assign to Me</Button> */}
              <Button variant="danger" onClick={() => setShowDeleteModal(true)} leftIcon={<Trash2 size={16} />}>
                Delete Task
              </Button>
            </div>
          </div>
        ) : null /* Should not happen if error/loading handled correctly */}
      </div>

        {/* Delete Confirmation Modal */}
        <Modal
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          title="Confirm Deletion"
        >
          <p>Are you sure you want to delete this task? This action cannot be undone.</p>
          {error && <Alert type="error" message={error} className="mt-4" />} {/* Show delete error in modal */}
          <div className="form-actions mt-6"> {/* Style modal buttons */}
            <Button variant="outline" onClick={() => setShowDeleteModal(false)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete} isLoading={isDeleting} disabled={isDeleting}>
              {isDeleting ? 'Deleting...' : 'Delete Task'}
            </Button>
          </div>
        </Modal>
    </div>
  );
};

export default TaskDetailPage;
