// src/pages/dashboard/UserFormPage.tsx
// ==========================================================================
// Component representing the page for adding or editing a user (Admin only).
// Fetches user data if editing and renders the UserForm component.
// ==========================================================================

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Loader from '../../components/common/Loader';
import Alert from '../../components/common/Alert';
import UserForm from '../../components/forms/UserForm'; // The user form component
import { useAuth } from '../../hooks/useAuth'; // For role check
import { fetchUserById } from '../../services/userService'; // User API
import { User } from '../../types'; // Import types
import { ArrowLeft } from 'lucide-react'; // Icon

// --- Component ---

/**
 * Renders the Add/Edit User page.
 * Fetches user data if editing, handles role checks, and displays the UserForm.
 */
const UserFormPage: React.FC = () => {
  // --- Hooks ---
  const { userId } = useParams<{ userId?: string }>(); // Get optional userId from URL
  const navigate = useNavigate();
  const { user: currentUser, loading: authLoading } = useAuth(); // Current logged-in user

  // --- State ---
  const [userToEdit, setUserToEdit] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(!!userId); // Load only if editing
  const [error, setError] = useState<string | null>(null);

  // --- Mode ---
  const isEditMode = !!userId;

  // --- Data Fetching (for Edit mode) ---
  const loadUser = useCallback(async () => {
    if (!isEditMode || !userId) {
        setIsLoading(false); // Not editing, no need to load
        return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const fetchedUser = await fetchUserById(userId);
      setUserToEdit(fetchedUser);
    } catch (err: any) {
      console.error("Failed to load user for editing:", err);
      setError(err.response?.data?.message || err.message || 'Could not load user data.');
    } finally {
      setIsLoading(false);
    }
  }, [isEditMode, userId]);

  // Fetch user data when component mounts in edit mode
  useEffect(() => {
    loadUser();
  }, [loadUser]);

  // --- Handlers ---
  /**
   * Callback function triggered when the UserForm successfully saves.
   * Navigates back to the users list page.
   * @param savedUser - The user object returned from the form/API.
   */
  const handleSaveSuccess = (savedUser: User) => {
    console.log("User saved successfully in parent:", savedUser);
    navigate('/users'); // Navigate back to the list after save
  };

  /**
   * Handles cancellation - navigates back to the users list page.
   */
  const handleCancel = () => {
    navigate('/users');
  };

  // --- Render Logic ---
    // Check permissions first
    if (!authLoading && currentUser?.role !== 'Admin') {
      return <Alert type="error" title="Access Denied" message="You do not have permission to manage users." />;
    }

    // Show loader during initial auth check or user fetch (in edit mode)
    if (authLoading || isLoading) {
      return <Loader text={isEditMode ? "Loading user data..." : "Loading..."} />;
    }

    // Show error if fetching failed in edit mode
    if (isEditMode && error) {
      return <Alert type="error" title="Error Loading User" message={error} />;
    }

    // Show error if trying to edit but user data is missing after load
    if (isEditMode && !userToEdit) {
        return <Alert type="warning" message="User data not found for editing." />;
    }


  // --- Render ---
  return (
    <div className="user-form-page">
      {/* Page Header */}
      <div className="page-header">
          <div className="header-left">
            <Link to="/users" className="back-button">
                <ArrowLeft size={16} style={{ marginRight: '4px' }} /> Back to Users
            </Link>
            <h1>{isEditMode ? 'Edit User' : 'Add New User'}</h1>
          </div>
      </div>

      {/* User Form Container */}
      <div className="user-form-container">
        <UserForm
          user={userToEdit} // Pass null for create mode
          onSaveSuccess={handleSaveSuccess}
          onCancel={handleCancel}
        />
      </div>
    </div>
  );
};

export default UserFormPage;
