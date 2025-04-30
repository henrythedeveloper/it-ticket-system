// src/pages/dashboard/TasksPage.tsx
// ==========================================================================
// Component representing the page for listing and managing tasks.
// Includes filtering, search, table display, and links to create/view tasks.
// ==========================================================================

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import Loader from '../../components/common/Loader';
import Alert from '../../components/common/Alert';
import Button from '../../components/common/Button';
import Table, { TableColumn } from '../../components/common/Table';
import Badge from '../../components/common/Badge';
import Pagination from '../../components/common/Pagination';
import Input from '../../components/common/Input';
import Select from '../../components/common/Select';
import { useAuth } from '../../hooks/useAuth';
import { fetchTasks } from '../../services/taskService'; // Task API
import { fetchUsers } from '../../services/userService'; // User API for assignee filter
import { Task, User, TaskStatus } from '../../types'; // Import types
import { formatDate } from '../../utils/helpers'; // Date formatting
import { PlusCircle, Search, X } from 'lucide-react'; // Icons

// --- Constants ---
const DEFAULT_LIMIT = 15; // Number of tasks per page

// --- Type Definition for Fetch Params ---
interface FetchTasksParams {
    page?: number;
    limit?: number;
    status?: string | undefined; // Allow undefined for 'all'
    assigneeId?: string | 'unassigned' | 'me' | undefined;
    search?: string | undefined;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc' | undefined;
}

// --- Component ---

const TasksPage: React.FC = () => {
  // --- Hooks ---
  const { user } = useAuth(); // Get current user for 'Assigned to Me' filter
  const [searchParams, setSearchParams] = useSearchParams(); // Manage URL query params
  const navigate = useNavigate();

  // --- State ---
  const [tasks, setTasks] = useState<Task[]>([]);
  const [assignableUsers, setAssignableUsers] = useState<Pick<User, 'id' | 'name'>[]>([]);
  const [totalTasks, setTotalTasks] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // --- Filtering/Pagination State (derived from URL search params) ---
  const currentPage = useMemo(() => parseInt(searchParams.get('page') || '1', 10), [searchParams]);
  const currentStatus = useMemo(() => searchParams.get('status') || '', [searchParams]);
  const currentAssignee = useMemo(() => searchParams.get('assigneeId') || '', [searchParams]);
  const currentSearch = useMemo(() => searchParams.get('search') || '', [searchParams]);
  // Add state for sorting if needed

  // --- Data Fetching ---
  const loadTasks = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    console.log(`Fetching tasks: Page=${currentPage}, Status=${currentStatus}, Assignee=${currentAssignee}, Search=${currentSearch}`);

    try {
      const params: FetchTasksParams = {
        page: currentPage,
        limit: DEFAULT_LIMIT,
        status: currentStatus || undefined,
        assigneeId: currentAssignee || undefined,
        search: currentSearch || undefined,
        sortBy: 'dueDate', // Default sort
        sortOrder: 'asc',
      };
      // Handle 'me' filter specifically
      if (params.assigneeId === 'me' && user) {
        params.assigneeId = user.id;
      } else if (params.assigneeId === 'me') {
        // If 'me' is selected but user isn't loaded, don't filter by assignee
        params.assigneeId = undefined;
      }

      const response = await fetchTasks(params);
      setTasks(response.data);
      setTotalTasks(response.total);
      setTotalPages(response.total_pages);
    } catch (err: any) {
      console.error("Failed to load tasks:", err);
      setError(err.response?.data?.message || err.message || 'Could not load tasks.');
      setTasks([]); setTotalTasks(0); setTotalPages(1);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, currentStatus, currentAssignee, currentSearch, user]); // Depend on filters and user

  const loadFiltersData = useCallback(async () => {
    // Fetch users for the assignee dropdown
    try {
      const usersData = await fetchUsers({ role: 'Admin,Staff', limit: 500 });
      setAssignableUsers(usersData.data.map(u => ({ id: u.id, name: u.name })));
    } catch (err) {
      console.error("Failed to load assignable users for filter:", err);
      // Handle error loading users if necessary
    }
  }, []);

  // --- Effects ---
  useEffect(() => { loadTasks(); }, [loadTasks]); // Fetch tasks when filters/page change
  useEffect(() => { loadFiltersData(); }, [loadFiltersData]); // Fetch filter options on mount

  // --- Handlers ---
  const handleFilterChange = (param: string, value: string) => {
    setSearchParams(prevParams => {
      const newParams = new URLSearchParams(prevParams);
      if (value) { newParams.set(param, value); }
      else { newParams.delete(param); }
      newParams.set('page', '1'); // Reset page when filters change
      return newParams;
    }, { replace: true }); // Use replace to avoid history clutter
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFilterChange('search', e.target.value);
  };

  const handleClearFilters = () => {
    setSearchParams({ page: '1' }); // Reset to just page 1
  };

  const handlePageChange = (newPage: number) => {
    setSearchParams(prevParams => {
      const newParams = new URLSearchParams(prevParams);
      newParams.set('page', newPage.toString());
      return newParams;
    }, { replace: true });
    window.scrollTo(0, 0); // Scroll to top on page change
  };

  // --- Options for Filters ---
  const statusOptions: { value: TaskStatus | ''; label: string }[] = [
    { value: '', label: 'All Statuses' },
    { value: 'Open', label: 'Open' },
    { value: 'In Progress', label: 'In Progress' },
    { value: 'Completed', label: 'Completed' },
  ];
  const assigneeOptions = [
    { value: '', label: 'All Assignees' },
    { value: 'unassigned', label: 'Unassigned' },
    ...(user ? [{ value: 'me', label: 'Assigned to Me' }] : []), // Conditionally add 'me' option
    ...assignableUsers.map(u => ({ value: u.id, label: u.name })),
  ];

  // --- Table Columns ---
  const taskColumns: TableColumn<Task>[] = [
    { key: 'task_number', header: '#', render: (item) => <Link to={`/tasks/${item.id}`}>{item.task_number}</Link> },
    { key: 'title', header: 'Title', render: (item) => <Link to={`/tasks/${item.id}`}>{item.title}</Link>, cellClassName: 'title-cell' },
    { key: 'status', header: 'Status', render: (item) => <Badge type={item.status === 'In Progress' ? 'progress' : item.status.toLowerCase() as any}>{item.status}</Badge> },
    { key: 'assignedTo', header: 'Assignee', render: (item) => item.assignedTo?.name || '-' },
    { key: 'due_date', header: 'Due Date', render: (item) => (
        item.due_date
        ? <span className={new Date(item.due_date) < new Date() && item.status !== 'Completed' ? 'overdue' : ''}>
              {formatDate(item.due_date)}
          </span>
        : '-'
      )},
    { key: 'createdBy', header: 'Created By', render: (item) => item.createdBy?.name || '-' },
    { key: 'updated_at', header: 'Last Update', render: (item) => formatDate(item.updated_at) },
  ];

  const filtersActive = !!currentStatus || !!currentAssignee || !!currentSearch;

  // --- Render ---
  return (
    <div className="tasks-page">
      {/* Page Header */}
      <div className="page-header">
        <h1>Manage Tasks</h1>
        <div className="header-actions">
          <Link to="/tasks/new"> {/* Link to the create task route */}
            <Button variant="primary" leftIcon={<PlusCircle size={18} />}>
              Create Task
            </Button>
          </Link>
        </div>
      </div>

      {/* Filter Section */}
      <section className="filter-section">
        <form className="search-form" onSubmit={(e) => e.preventDefault()}>
          <Input
            label=""
            aria-label="Search tasks by title or description"
            id="task-search"
            type="search"
            placeholder="Search tasks by title or description..."
            value={currentSearch}
            onChange={handleSearchChange}
            className="search-input"
          />
          <Button type="submit" variant="primary" aria-label="Search"><Search size={20}/></Button>
        </form>
        <div className="filters">
          <div className="filter-group">
            <label htmlFor="status-filter">Status:</label>
            <select id="status-filter" value={currentStatus} onChange={(e) => handleFilterChange('status', e.target.value)} className="filter-select">
              {statusOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
          <div className="filter-group">
            <label htmlFor="assignee-filter">Assignee:</label>
            <select id="assignee-filter" value={currentAssignee} onChange={(e) => handleFilterChange('assigneeId', e.target.value)} className="filter-select">
              {assigneeOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
          {filtersActive && (
            <Button variant="outline" onClick={handleClearFilters} leftIcon={<X size={16} />} className='clear-filters-btn'>
              Clear Filters
            </Button>
          )}
        </div>
      </section>

      {/* Loading State */}
      {isLoading && <Loader text="Loading tasks..." />}

      {/* Error State */}
      {error && !isLoading && <Alert type="error" message={error} />}

      {/* Tasks Table or No Tasks Message */}
      {!isLoading && !error && (
        tasks.length > 0 ? (
          <>
            <div className="tasks-table-container">
              <Table
                columns={taskColumns}
                data={tasks}
                tableClassName="tasks-table"
                // Link entire row to detail page
                onRowClick={(task) => navigate(`/tasks/${task.id}`)}
              />
            </div>
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={handlePageChange}
              className="mt-6" // Add margin top
            />
          </>
        ) : (
          <div className="no-tasks">
            <p>No tasks found matching your current filters.</p>
            {filtersActive && (
                <Button variant="primary" onClick={handleClearFilters}>Clear Filters</Button>
            )}
          </div>
        )
      )}
    </div>
  );
};

export default TasksPage;