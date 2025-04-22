// src/pages/dashboard/TasksPage.tsx
// ==========================================================================
// Component representing the page for listing and managing tasks.
// Includes filtering, search, and a table of tasks.
// Fixed type errors and render function parameters (explicit typing).
// ==========================================================================

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Loader from '../../components/common/Loader';
import Alert from '../../components/common/Alert';
import Button from '../../components/common/Button';
import Table, { TableColumn } from '../../components/common/Table';
import Badge from '../../components/common/Badge';
import Pagination from '../../components/common/Pagination'; // Pagination component
import Input from '../../components/common/Input'; // Use Input component for search
import { useAuth } from '../../hooks/useAuth'; // For default filters
import { fetchTasks } from '../../services/taskService'; // Task API
import { fetchUsers } from '../../services/userService'; // User API for assignee filter
import { Task, User, TaskStatus } from '../../types'; // Import types
import { formatDate } from '../../utils/helpers'; // Date formatting
import { PlusCircle, Search, X } from 'lucide-react'; // Icons

// --- Constants ---
const DEFAULT_LIMIT = 15; // Number of tasks per page

// --- Type Definition for Fetch Params ---
// Define explicitly to ensure type safety
interface FetchTasksParams {
    page?: number;
    limit?: number;
    status?: string | undefined;
    assigneeId?: string | undefined;
    search?: string | undefined;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc' | undefined; // Correct type
}

// --- Component ---

/**
 * Renders the Tasks list page with filtering, search, pagination, and table display.
 */
const TasksPage: React.FC = () => {
  // --- Hooks ---
  const { user } = useAuth(); // Get current user for potential default filters
  const [searchParams, setSearchParams] = useSearchParams(); // Manage URL query params

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
  // Add state for sorting if needed: const currentSort = ...

  // --- Data Fetching ---
  /**
   * Fetches tasks based on current filter/pagination state derived from URL params.
   * useCallback ensures stable function identity for useEffect dependency.
   */
  const loadTasks = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    console.log(`Fetching tasks: Page=${currentPage}, Status=${currentStatus}, Assignee=${currentAssignee}, Search=${currentSearch}`);

    try {
      // Use the explicit FetchTasksParams type
      const params: FetchTasksParams = {
        page: currentPage,
        limit: DEFAULT_LIMIT,
        status: currentStatus || undefined, // Send undefined if empty
        assigneeId: currentAssignee || undefined,
        search: currentSearch || undefined,
        sortBy: 'createdAt', // Default sort
        sortOrder: 'desc',   // Ensure this matches the allowed type
      };
      const response = await fetchTasks(params);
      setTasks(response.data);
      setTotalTasks(response.total);
      setTotalPages(response.totalPages);
    } catch (err: any) {
      console.error("Failed to load tasks:", err);
      setError(err.response?.data?.message || err.message || 'Could not load tasks.');
      // Reset state on error
      setTasks([]);
      setTotalTasks(0);
      setTotalPages(1);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, currentStatus, currentAssignee, currentSearch]); // Dependencies based on URL state

  /**
   * Fetches users for the assignee filter dropdown.
   */
  const loadAssignableUsers = useCallback(async () => {
      try {
        // Fetch only staff and admins
        const usersData = await fetchUsers({ role: 'Admin,Staff', limit: 500 });
        setAssignableUsers(usersData.data.map(u => ({ id: u.id, name: u.name })));
      } catch (err) {
          console.error("Failed to load users for filter:", err);
          // Handle error appropriately, maybe show a message
      }
  }, []);

  // --- Effects ---
  // Fetch tasks when filter/pagination params change
  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // Fetch assignable users on initial mount
  useEffect(() => {
    loadAssignableUsers();
  }, [loadAssignableUsers]);


  // --- Handlers ---
  /**
   * Updates URL search parameters based on filter changes.
   * @param param - The query parameter key (e.g., 'status', 'assigneeId').
   * @param value - The new value for the parameter.
   */
  const handleFilterChange = (param: string, value: string) => {
    setSearchParams(prevParams => {
      const newParams = new URLSearchParams(prevParams);
      if (value) {
        newParams.set(param, value);
      } else {
        newParams.delete(param); // Remove param if value is empty
      }
      newParams.set('page', '1'); // Reset to page 1 when filters change
      return newParams;
    }, { replace: true }); // Use replace to avoid excessive history entries
  };

  /**
   * Handles search input changes and updates URL param.
   * Uses debounce if desired.
   */
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      // Basic immediate update:
      handleFilterChange('search', e.target.value);
      // TODO: Implement debounce if needed for performance
  };

  /**
   * Clears all active filters and resets to page 1.
   */
  const handleClearFilters = () => {
    setSearchParams({ page: '1' }); // Reset to just page 1
  };

  /**
   * Handles page changes from the Pagination component.
   * @param newPage - The new page number selected.
   */
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
    // Add 'Assigned to Me' option if user is logged in
    ...(user ? [{ value: user.id, label: 'Assigned to Me' }] : []),
    ...assignableUsers.map(u => ({ value: u.id, label: u.name })),
  ];

  // --- Table Columns ---
  // FIX: Explicitly type 'item' parameter in render functions
  const taskColumns: TableColumn<Task>[] = [
    { key: 'title', header: 'Title', render: (item: Task) => <Link to={`/tasks/${item.id}`}>{item.title}</Link>, cellClassName: 'title-cell' },
    { key: 'status', header: 'Status', render: (item: Task) => <Badge type={item.status === 'In Progress' ? 'progress' : item.status.toLowerCase() as any}>{item.status}</Badge> },
    { key: 'assignedTo', header: 'Assignee', render: (item: Task) => item.assignedTo?.name || 'Unassigned' },
    { 
      key: 'dueDate', 
      header: 'Due Date', 
      render: (item: Task) => {
        // Determine if the task is overdue
        const isOverdue = item.dueDate && new Date(item.dueDate) < new Date() && item.status !== 'Completed';
        // Set the class name based on the condition
        const className = isOverdue ? 'overdue' : '';
        // Get the display content
        const content = item.dueDate ? formatDate(item.dueDate) : '-';
        // Return the content wrapped in a span with the conditional class
        return <span className={className}>{content}</span>;
      }
    },
    { key: 'createdBy', header: 'Created By', render: (item: Task) => item.createdBy?.name || 'Unknown' },
    { key: 'createdAt', header: 'Created At', render: (item: Task) => formatDate(item.createdAt) },
    { key: 'actions', header: 'Actions', render: (item: Task) => (
        <Link to={`/tasks/${item.id}`}>
            <Button variant='outline' size='sm'>View</Button>
        </Link>
      ), cellClassName: 'actions-cell'
    },
  ];

  // Determine if any filters are active
  const filtersActive = !!currentStatus || !!currentAssignee || !!currentSearch;

  // --- Render ---
  return (
    <div className="tasks-page">
      {/* Page Header */}
      <div className="page-header">
        <h1>Manage Tasks</h1>
        <div className="header-actions">
          <Link to="/tasks/new"> {/* Assuming a route for creating new tasks */}
            <Button variant="primary" leftIcon={<PlusCircle size={18} />}>
              New Task
            </Button>
          </Link>
        </div>
      </div>

      {/* Filter Section */}
      <section className="filter-section">
          {/* Search Form */}
          <form onSubmit={(e) => e.preventDefault()} className="search-form">
              <Input
                label="" // Hide label visually if needed, use aria-label
                aria-label="Search tasks by title or description"
                id="task-search" // Use specific ID
                type="search"
                placeholder="Search tasks by title or description..."
                value={currentSearch}
                onChange={handleSearchChange}
                className="search-input" // Ensure this class applies necessary styles
              />
              {/* Optional: Add explicit search button if not searching on change */}
              {/* <Button type="submit" variant="primary" aria-label="Search"><Search size={20}/></Button> */}
          </form>

          {/* Dropdown Filters */}
          <div className="filters">
              <div className="filter-group">
                  <label htmlFor="status-filter">Status:</label>
                  <select
                    id="status-filter"
                    value={currentStatus}
                    onChange={(e) => handleFilterChange('status', e.target.value)}
                    className="filter-select"
                  >
                      {statusOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
              </div>
              <div className="filter-group">
                  <label htmlFor="assignee-filter">Assignee:</label>
                  <select
                    id="assignee-filter"
                    value={currentAssignee}
                    onChange={(e) => handleFilterChange('assigneeId', e.target.value)}
                    className="filter-select"
                  >
                      {assigneeOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
              </div>
              {/* Clear Filters Button (only show if filters are active) */}
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
                // Optional: Add onRowClick to navigate to detail page
                // onRowClick={(task) => navigate(`/tasks/${task.id}`)}
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
          // No Tasks Found Message
          <div className="no-tasks">
              <p>No tasks found matching your current filters.</p>
              {filtersActive && (
                <Button variant="primary" onClick={handleClearFilters}>
                    Clear Filters
                </Button>
              )}
          </div>
        )
      )}
    </div>
  );
};

export default TasksPage;
