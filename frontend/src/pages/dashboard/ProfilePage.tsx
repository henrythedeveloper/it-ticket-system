// src/pages/dashboard/ProfilePage.tsx
// ==========================================================================
// Component representing the user's profile page.
// Displays user information and allows editing via ProfileForm.
// ==========================================================================

import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth'; // Auth hook
import ProfileForm from '../../components/forms/ProfileForm'; // Profile editing form
import Loader from '../../components/common/Loader'; // Loader component
import Alert from '../../components/common/Alert'; // Alert component
import { User } from '../../types'; // User type
import { getInitials, formatDateTime } from '../../utils/helpers'; // Helper functions

// --- Component ---

/**
 * Renders the user profile page, showing user details and the profile editing form.
 */
const ProfilePage: React.FC = () => {
  // --- Hooks ---
  // Get user data and loading state from auth context
  // The AuthProvider handles fetching the initial user profile
  const { user, loading: authLoading, isAuthenticated } = useAuth();

  // --- State ---
  // State to track if the profile was just updated (for potential feedback)
  const [updateSuccess, setUpdateSuccess] = useState<boolean>(false);

  // --- Handlers ---
  /**
   * Callback function triggered when the ProfileForm successfully updates the user.
   * @param updatedUser - The updated user object from the form/API.
   */
  const handleUpdateSuccess = (updatedUser: User) => {
    console.log("Profile updated successfully in parent:", updatedUser);
    setUpdateSuccess(true);
    // Optional: Clear success message after a delay
    setTimeout(() => setUpdateSuccess(false), 3000);
  };

  // --- Render Logic ---
  // Show loader if auth state is still loading
  if (authLoading) {
    return <Loader text="Loading profile..." />;
  }

  // Show message if user is not authenticated or user data is missing
  if (!isAuthenticated || !user) {
    return <Alert type="error" message="Could not load user profile. Please try logging in again." />;
  }

  // --- Render ---
  return (
    <div className="profile-page">
      {/* Page Header */}
      <div className="page-header">
        <h1>My Profile</h1>
      </div>

      {/* Optional: Display success message after update */}
      {updateSuccess && (
          <Alert type="success" message="Profile updated successfully!" className="mb-4" />
      )}

      {/* Profile Grid (Info + Form) */}
      <div className="profile-container">
        {/* Left Side: Profile Info Display */}
        <section className="profile-info">
          {/* Uses card styling via SCSS */}
          <div className="profile-header">
            {/* Avatar */}
            <div className="avatar" title={user.name}>
              {getInitials(user.name)}
            </div>
            {/* Meta Info */}
            <div className="profile-meta">
              <h2>{user.name}</h2>
              <div className="profile-details">
                  {/* Role Badge */}
                  {/* Assuming Badge component exists and handles 'admin'/'staff' types */}
                  <span className={`role-badge badge-${user.role.toLowerCase()}`}>
                    {user.role}
                  </span>
                  {/* Join Date */}
                  <span className="join-date">
                    Joined: {formatDateTime(user.createdAt)}
                  </span>
              </div>
            </div>
          </div>
          {/* TODO: Add more profile details if needed (e.g., last login) */}
          {/* <div className="profile-additional-info"> ... </div> */}
        </section>

        {/* Right Side: Profile Edit Form */}
        <section className="profile-form-container">
          {/* Uses card styling via SCSS */}
          <h3>Edit Information</h3>
          <ProfileForm
            currentUser={user}
            onUpdateSuccess={handleUpdateSuccess}
          />
          {/* TODO: Add separate section/form for password change */}
          {/* <h3>Change Password</h3> */}
          {/* <PasswordChangeForm userId={user.id} /> */}
        </section>
      </div>
    </div>
  );
};

export default ProfilePage;
