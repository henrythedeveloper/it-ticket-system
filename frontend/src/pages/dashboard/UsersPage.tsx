// src/pages/dashboard/UsersPage.tsx
// ==========================================================================
// Component representing the page for listing and managing users (Admin only).
// Includes search, table display, and links to add/edit users.
// Fixed type errors.
// ==========================================================================

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Loader from '../../components/common/Loader';
import Alert from '../../components/common/Alert';
import Button from '../../components/common/Button';
import Table, { TableColumn } from '../../components/common/Table';
import Badge from '../../components/common/Badge';
import Pagination from '../../components/common/Pagination';
import Input from '../../components/common/Input'; // Use Input component for search
import { useAuth } from '../../hooks/useAuth'; // For role check
import { fetchUsers, deleteUser } from '../../services/userService'; // User API
import { User } from '../../types'; // Import types
import { formatDate } from '../../utils/helpers'; // Date formatting
import { PlusCircle, Search, Edit, Trash2 } from 'lucide-react'; // Icons
import Modal from '../../components/common/Modal'; // For delete confirmation

// --- Constants ---
const DEFAULT_LIMIT = 15; // Number of users per page

// --- Type Definition for Fetch Params ---
interface FetchUsersParams {
    page?: number;
    limit?: number;
    role?: string | undefined;
    search?: string | undefined;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc' | undefined; // Correct type
}

// --- Component ---

/**
 * Renders the Manage Users page with search, table, pagination, and actions.
 * Includes role-based access control.
 */
const UsersPage: React.FC = () => {
  // --- Hooks ---
  const { user: currentUser, loading: authLoading } = useAuth(); // Current logged-in user for role check
  const [searchParams, setSearchParams] = useSearchParams(); // Manage URL query params

  // --- State ---
  const [users, setUsers] = useState<User[]>([]);
  const [totalUsers, setTotalUsers] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null); // User object for delete confirmation
  const [isDeleting, setIsDeleting] = useState<boolean>(false); // Loading state for delete action

  // --- Filtering/Pagination State (derived from URL search params) ---
  const currentPage = useMemo(() => parseInt(searchParams.get('page') || '1', 10), [searchParams]);
  const currentSearch = useMemo(() => searchParams.get('search') || '', [searchParams]);
  // Add state for role filter or sorting if needed

  // --- Data Fetching ---
  /**
   * Fetches users based on current filter/pagination state.
   */
  const loadUsers = useCallback(async () => {
    // Ensure admin access before fetching
    if (currentUser?.role !== 'Admin') {
        setError("Access Denied: You do not have permission to manage users.");
        setIsLoading(false);
        return;
    }

    setIsLoading(true);
    setError(null); // Clear previous errors
    console.log(`Fetching users: Page=${currentPage}, Search=${currentSearch}`);

    try {
      // Use explicit FetchUsersParams type
      const params: FetchUsersParams = {
        page: currentPage,
        limit: DEFAULT_LIMIT,
        search: currentSearch || undefined,
        sortBy: 'name', // Default sort
        sortOrder: 'asc',  // Ensure this matches the allowed type
      };
      const response = await fetchUsers(params);
      setUsers(response.data);
      setTotalUsers(response.total);
      setTotalPages(response.totalPages);
    } catch (err: any) {
      console.error("Failed to load users:", err);
      setError(err.response?.data?.message || err.message || 'Could not load users.');
      setUsers([]); setTotalUsers(0); setTotalPages(1); // Reset state on error
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, currentSearch, currentUser?.role]); // Depend on filters and user role

  // Fetch users when component mounts or filters/page change
  useEffect(() => {
    // Only run fetch if auth is loaded and user is admin
    if (!authLoading) {
        loadUsers();
    }
  }, [loadUsers, authLoading]);

  // --- Handlers ---
  /**
   * Updates URL search parameters for search term.
   */
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const searchTerm = e.target.value;
      setSearchParams(prevParams => {
        const newParams = new URLSearchParams(prevParams);
        if (searchTerm) { newParams.set('search', searchTerm); }
        else { newParams.delete('search'); }
        newParams.set('page', '1'); // Reset page on search
        return newParams;
      }, { replace: true });
  };

    /**
   * Handles page changes from the Pagination component.
   */
  const handlePageChange = (newPage: number) => {
      setSearchParams(prevParams => {
        const newParams = new URLSearchParams(prevParams);
        newParams.set('page', newPage.toString());
        return newParams;
    }, { replace: true });
      window.scrollTo(0, 0); // Scroll to top
  };

  /**
   * Opens the delete confirmation modal.
   * @param user - The user object to be deleted.
   */
  const openDeleteModal = (user: User) => {
      // Prevent deleting the currently logged-in user
      if (user.id === currentUser?.id) {
          alert("You cannot delete your own account.");
          return;
      }
      setUserToDelete(user);
  };

  /**
   * Closes the delete confirmation modal.
   */
  const closeDeleteModal = () => {
      setUserToDelete(null);
      setError(null); // Clear any previous delete errors
  };

  /**
   * Handles the actual deletion of a user after confirmation.
   */
  const handleDeleteUser = async () => {
      if (!userToDelete) return;

      setIsDeleting(true);
      setError(null);
      try {
          await deleteUser(userToDelete.id);
          closeDeleteModal();
          // Refetch users on the current page to reflect the deletion
          loadUsers();
          // Optionally show a success message
      } catch (err: any) {
          console.error("Failed to delete user:", err);
          // Display error within the modal
          setError(err.response?.data?.message || err.message || 'Could not delete user.');
          setIsDeleting(false); // Stop loading indicator
      }
  };


  // --- Table Columns ---
  const userColumns: TableColumn<User>[] = [
    { key: 'name', header: 'Name' },
    { key: 'email', header: 'Email' },
    { key: 'role', header: 'Role', render: (item) => <Badge type={item.role.toLowerCase() as any}>{item.role}</Badge> },
    { key: 'createdAt', header: 'Created', render: (item) => formatDate(item.createdAt) },
    { key: 'actions', header: 'Actions', render: (item) => (
        <div className='actions-cell-content' style={{ display: 'flex', gap: '0.5rem' }}>
            <Link to={`/users/edit/${item.id}`}>
                <Button variant='outline' size='sm' leftIcon={<Edit size={14} />}>Edit</Button>
            </Link>
            <Button
                variant='danger'
                size='sm'
                leftIcon={<Trash2 size={14} />}
                onClick={() => openDeleteModal(item)}
                disabled={item.id === currentUser?.id} // Disable delete for self
            >
                Delete
            </Button>
        </div>
      ), cellClassName: 'actions-cell'
    },
  ];

  // --- Render Logic ---
    // Handle loading and initial permission check
    if (authLoading) return <Loader text="Checking permissions..." />;
    if (currentUser?.role !== 'Admin') {
      return <Alert type="error" title="Access Denied" message="You do not have permission to manage users." />;
    }

  // --- Render ---
  return (
    <div className="users-page">
      {/* Page Header */}
      <div className="page-header">
        <h1>Manage Users</h1>
        <div className="header-actions">
          <Link to="/users/new">
            <Button variant="primary" leftIcon={<PlusCircle size={18} />}>
              Add User
            </Button>
          </Link>
        </div>
      </div>

      {/* Search Filter */}
      <section className="search-filter">
          <form onSubmit={(e) => e.preventDefault()}>
              <Input
                label="" // Hide label visually if needed, use aria-label
                aria-label="Search users by name or email"
                id="user-search"
                type="search"
                placeholder="Search users by name or email..."
                value={currentSearch}
                onChange={handleSearchChange}
                className="search-input" // Ensure this class applies necessary styles
              />
              {/* Optional: Add explicit search button if not searching on change */}
          </form>
      </section>

      {/* Loading State */}
      {isLoading && <Loader text="Loading users..." />}

      {/* Error State */}
      {error && !isLoading && <Alert type="error" message={error} />}

      {/* Users Table or No Users Message */}
      {!isLoading && !error && (
        users.length > 0 ? (
          <>
            <div className="users-table-container">
              <Table
                columns={userColumns}
                data={users}
                tableClassName="users-table"
              />
            </div>
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={handlePageChange}
              className="mt-6"
            />
          </>
        ) : (
          // No Users Found Message
          <div className="no-users">
              <p>No users found matching your search criteria.</p>
              {/* FIX: Clear search using setSearchParams or handleSearchChange */}
              {currentSearch && (
                <Button variant="outline" onClick={() => handleSearchChange({ target: { value: '' } } as React.ChangeEvent<HTMLInputElement>)}>
                    Clear Search
                </Button>
              )}
          </div>
        )
      )}

      {/* Delete Confirmation Modal */}
        <Modal
          isOpen={!!userToDelete}
          onClose={closeDeleteModal}
          title="Confirm User Deletion"
        >
          <p>Are you sure you want to delete the user <strong>{userToDelete?.name}</strong> ({userToDelete?.email})?</p>
          <p className="mt-2 text-sm text-red-600">This action cannot be undone.</p>
          {/* Show delete error within modal */}
          {error && userToDelete && <Alert type="error" message={error} className="mt-4" />}
          <div className="form-actions mt-6">
            <Button variant="outline" onClick={closeDeleteModal} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDeleteUser} isLoading={isDeleting} disabled={isDeleting}>
              {isDeleting ? 'Deleting...' : 'Delete User'}
            </Button>
          </div>
        </Modal>

    </div>
  );
};

export default UsersPage;
