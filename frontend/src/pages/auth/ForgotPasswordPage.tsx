// src/pages/auth/ForgotPasswordPage.tsx
// ==========================================================================
// Component representing the page where users can request a password reset.
// Renders the ForgotPasswordForm component within the AuthLayout.
// ==========================================================================

import React from 'react';
import ForgotPasswordForm from '../../components/forms/ForgetPasswordForm'; // Import the form

// --- Component ---

/**
 * Renders the forgot password page, displaying the form to request a reset link.
 */
const ForgotPasswordPage: React.FC = () => {
  // --- Render ---
  // The surrounding AuthLayout provides the card styling and centering.
  return (
    <div className="forgot-password-page-content">
      {/* Page Title */}
      <h1>Forgot Your Password?</h1>
      <p className="forgot-password-description mb-6">
        Enter the email address associated with your account, and we'll send you a link to reset your password.
      </p>

      {/* Forgot Password Form */}
      <ForgotPasswordForm />
    </div>
  );
};

export default ForgotPasswordPage;
