// src/pages/auth/ResetPasswordPage.tsx
// ==========================================================================
// Component representing the page where users can set a new password
// using a token received via email.
// ==========================================================================

import React from 'react';
import { useParams } from 'react-router-dom';
import ResetPasswordForm from '../../components/forms/ResetPasswordForm'; // Import the form
import Alert from '../../components/common/Alert'; // Import Alert

// --- Component ---

/**
 * Renders the reset password page. Extracts the token from the URL
 * and passes it to the ResetPasswordForm.
 */
const ResetPasswordPage: React.FC = () => {
  // --- Hooks ---
  const { token } = useParams<{ token?: string }>(); // Get token from URL parameter

  // --- Render Logic ---
  // If no token is present in the URL, redirect or show an error
  if (!token) {
    console.warn("ResetPasswordPage: No token found in URL.");
    // Option 1: Redirect to login or forgot password page
    // return <Navigate to="/forgot-password" replace />;
    // Option 2: Show an error message
    return (
        <div className="reset-password-page-content">
             <h1>Invalid Link</h1>
             <Alert type="error" message="The password reset link is invalid or missing a token." />
        </div>
    );
  }

  // --- Render ---
  return (
    <div className="reset-password-page-content">
      {/* Page Title */}
      <h1>Set New Password</h1>
      <p className="reset-password-description mb-6">
        Enter and confirm your new password below.
      </p>

      {/* Reset Password Form - Pass the token */}
      <ResetPasswordForm token={token} />
    </div>
  );
};

export default ResetPasswordPage;
