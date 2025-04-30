// src/pages/dashboard/TasksPage.tsx
// ==========================================================================
// Component representing the page for listing and managing tasks.
// Includes filtering, search, and a table of tasks.
// **REVISED**: Show task_number instead of linking title in first column.
// ==========================================================================

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom'; // Added useNavigate
import Loader from '../../components/common/Loader';
import Alert from '../../components/common/Alert';
import Button from '../../components/common/Button';
import Table, { TableColumn } from '../../components/common/Table';
import Badge from '../../components/common/Badge';
import Pagination from '../../components/common/Pagination';
import Input from '../../components/common/Input';
import { useAuth } from '../../hooks/useAuth';
import { fetchTasks, deleteTask } from '../../services/taskService'; // Added deleteTask
import { fetchUsers } from '../../services/userService';
import { Task, User, TaskStatus } from '../../types';
import { formatDate } from '../../utils/helpers';
import { PlusCircle, Search, X, Edit, Trash2 } from 'lucide-react'; // Added Edit, Trash2
import Modal from '../../components/common/Modal'; // Added Modal

// --- Constants ---
const DEFAULT_LIMIT = 15;

// --- Type Definition for Fetch Params ---
interface FetchTasksParams {
    page?: number;
    limit?: number;
    status?: string | undefined;
    assigneeId?: string | undefined;
    search?: string | undefined;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc' | undefined;
}

// --- Component ---
const TasksPage: React.FC = () => {
  // --- Hooks ---
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate(); // Initialize useNavigate

  // --- State ---
  const [tasks, setTasks] = useState<Task[]>([]);
  const [assignableUsers, setAssignableUsers] = useState<Pick<User, 'id' | 'name'>[]>([]);
  const [totalTasks, setTotalTasks] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  // Add state for delete confirmation
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // --- Filtering/Pagination State ---
  const currentPage = useMemo(() => parseInt(searchParams.get('page') || '1', 10), [searchParams]);
  const currentStatus = useMemo(() => searchParams.get('status') || '', [searchParams]);
  const currentAssignee = useMemo(() => searchParams.get('assigneeId') || '', [searchParams]);
  const currentSearch = useMemo(() => searchParams.get('search') || '', [searchParams]);

  // --- Data Fetching ---
  const loadTasks = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    console.log(`Fetching tasks: Page=${currentPage}, Status=${currentStatus}, Assignee=${currentAssignee}, Search=${currentSearch}`);
    try {
      const params: FetchTasksParams = {
        page: currentPage, limit: DEFAULT_LIMIT,
        status: currentStatus || undefined, assigneeId: currentAssignee || undefined,
        search: currentSearch || undefined, sortBy: 'createdAt', sortOrder: 'desc',
      };
      const response = await fetchTasks(params);
      setTasks(response.data);
      setTotalTasks(response.total);
      setTotalPages(response.total_pages);
    } catch (err: any) {
      console.error("Failed to load tasks:", err);
      setError(err.response?.data?.message || err.message || 'Could not load tasks.');
      setTasks([]); setTotalTasks(0); setTotalPages(1);
    } finally { setIsLoading(false); }
  }, [currentPage, currentStatus, currentAssignee, currentSearch]);

  const loadAssignableUsers = useCallback(async () => {
      try {
        const usersData = await fetchUsers({ role: 'Admin,Staff', limit: 500 });
        setAssignableUsers(usersData.data.map(u => ({ id: u.id, name: u.name })));
      } catch (err) { console.error("Failed to load users for filter:", err); }
  }, []);

  // --- Effects ---
  useEffect(() => { loadTasks(); }, [loadTasks]);
  useEffect(() => { loadAssignableUsers(); }, [loadAssignableUsers]);

  // --- Handlers ---
  const handleFilterChange = (param: string, value: string) => {
    setSearchParams(prevParams => {
      const newParams = new URLSearchParams(prevParams);
      if (value) { newParams.set(param, value); }
      else { newParams.delete(param); }
      newParams.set('page', '1');
      return newParams;
    }, { replace: true });
  };
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => { handleFilterChange('search', e.target.value); };
  const handleClearFilters = () => { setSearchParams({ page: '1' }); };
  const handlePageChange = (newPage: number) => { setSearchParams(prevParams => { const newParams = new URLSearchParams(prevParams); newParams.set('page', newPage.toString()); return newParams; }, { replace: true }); window.scrollTo(0, 0); };

  // Delete Handlers
  const openDeleteModal = (task: Task) => setTaskToDelete(task);
  const closeDeleteModal = () => { setTaskToDelete(null); setError(null); }; // Clear error on close
  const handleDeleteTask = async () => {
      if (!taskToDelete) return;
      setIsDeleting(true);
      setError(null);
      try {
          await deleteTask(taskToDelete.id);
          closeDeleteModal();
          loadTasks(); // Refresh list after delete
      } catch (err: any) {
          console.error("Failed to delete task:", err);
          setError(err.response?.data?.message || err.message || 'Could not delete task.');
          // Keep modal open to show error
      } finally {
          setIsDeleting(false);
      }
  };


  // --- Options for Filters ---
  const statusOptions: { value: TaskStatus | ''; label: string }[] = [ { value: '', label: 'All Statuses' }, { value: 'Open', label: 'Open' }, { value: 'In Progress', label: 'In Progress' }, { value: 'Completed', label: 'Completed' }, ];
  const assigneeOptions = [ { value: '', label: 'All Assignees' }, ...(user ? [{ value: user.id, label: 'Assigned to Me' }] : []), ...assignableUsers.map(u => ({ value: u.id, label: u.name })), ];

  // --- Table Columns ---
  const taskColumns: TableColumn<Task>[] = [
    // ** FIX: Display task_number and link it **
    { key: 'task_number', header: '#', render: (item: Task) => <Link to={`/tasks/${item.id}`}>#{item.task_number}</Link> },
    { key: 'title', header: 'Title', render: (item: Task) => <Link to={`/tasks/${item.id}`}>{item.title}</Link>, cellClassName: 'title-cell' },
    { key: 'status', header: 'Status', render: (item: Task) => <Badge type={item.status === 'In Progress' ? 'progress' : item.status.toLowerCase() as any}>{item.status}</Badge> },
    { key: 'assignedTo', header: 'Assignee', render: (item: Task) => item.assignedTo?.name || 'Unassigned' },
    { key: 'dueDate', header: 'Due Date', render: (item: Task) => { const isOverdue = item.due_date && new Date(item.due_date) < new Date() && item.status !== 'Completed'; const className = isOverdue ? 'overdue' : ''; const content = item.due_date ? formatDate(item.due_date) : '-'; return <span className={className}>{content}</span>; } },
    { key: 'createdBy', header: 'Created By', render: (item: Task) => item.createdBy?.name || 'Unknown' },
    { key: 'createdAt', header: 'Created At', render: (item: Task) => formatDate(item.created_at) },
    // Add Actions Column
    { key: 'actions', header: 'Actions', render: (item: Task) => (
        <div className='actions-cell-content' style={{ display: 'flex', gap: '0.5rem' }}>
            {/* Link to edit page (assuming TaskDetailPage handles edit mode) */}
            <Link to={`/tasks/${item.id}`}>
                 <Button variant='outline' size='sm' leftIcon={<Edit size={14} />}>View/Edit</Button>
            </Link>
            {/* Delete Button */}
            <Button variant='danger' size='sm' leftIcon={<Trash2 size={14} />} onClick={() => openDeleteModal(item)} >
                Delete
            </Button>
        </div>
      ), cellClassName: 'actions-cell'
    },
  ];

  const filtersActive = !!currentStatus || !!currentAssignee || !!currentSearch;

  // --- Render ---
  return (
    <div className="tasks-page">
      {/* Page Header */}
      <div className="page-header">
        <h1>Manage Tasks</h1>
        <div className="header-actions">
          <Link to="/tasks/new">
            <Button variant="primary" leftIcon={<PlusCircle size={18} />}> New Task </Button>
          </Link>
        </div>
      </div>

      {/* Filter Section */}
      <section className="filter-section">
          <form onSubmit={(e) => e.preventDefault()} className="search-form">
              <Input label="" aria-label="Search tasks by title or description" id="task-search" type="search" placeholder="Search tasks..." value={currentSearch} onChange={handleSearchChange} className="search-input" />
          </form>
          <div className="filters">
              <div className="filter-group"><label htmlFor="status-filter">Status:</label><select id="status-filter" value={currentStatus} onChange={(e) => handleFilterChange('status', e.target.value)} className="filter-select">{statusOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select></div>
              <div className="filter-group"><label htmlFor="assignee-filter">Assignee:</label><select id="assignee-filter" value={currentAssignee} onChange={(e) => handleFilterChange('assigneeId', e.target.value)} className="filter-select">{assigneeOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select></div>
              {filtersActive && ( <Button variant="outline" onClick={handleClearFilters} leftIcon={<X size={16} />} className='clear-filters-btn'> Clear Filters </Button> )}
          </div>
      </section>

      {isLoading && <Loader text="Loading tasks..." />}
      {error && !isLoading && <Alert type="error" message={error} />}

      {!isLoading && !error && (
        tasks.length > 0 ? (
          <>
            <div className="tasks-table-container">
              <Table columns={taskColumns} data={tasks} tableClassName="tasks-table" onRowClick={(task) => navigate(`/tasks/${task.task_number}`)} />
            </div>
            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={handlePageChange} className="mt-6" />
          </>
        ) : (
          <div className="no-tasks">
              <p>No tasks found matching your current filters.</p>
              {filtersActive && ( <Button variant="primary" onClick={handleClearFilters}> Clear Filters </Button> )}
          </div>
        )
      )}

       {/* Delete Confirmation Modal */}
        <Modal isOpen={!!taskToDelete} onClose={closeDeleteModal} title="Confirm Task Deletion" >
          <p>Are you sure you want to delete the task <strong>"{taskToDelete?.title}"</strong>?</p>
          <p className="mt-2 text-sm text-red-600">This action cannot be undone.</p>
          {error && taskToDelete && <Alert type="error" message={error} className="mt-4" />}
          <div className="form-actions mt-6">
            <Button variant="outline" onClick={closeDeleteModal} disabled={isDeleting}> Cancel </Button>
            <Button variant="danger" onClick={handleDeleteTask} isLoading={isDeleting} disabled={isDeleting}> {isDeleting ? 'Deleting...' : 'Delete Task'} </Button>
          </div>
        </Modal>

    </div>
  );
};

export default TasksPage;
