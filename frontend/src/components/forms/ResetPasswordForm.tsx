// src/components/forms/ResetPasswordForm.tsx
// ==========================================================================
// Component rendering the form to set a new password using a reset token.
// Handles password input, confirmation, submission, and feedback.
// **REVISED**: Fixed payload keys to use camelCase (newPassword, confirmPassword).
// ==========================================================================

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Input from '../common/Input';
import Button from '../common/Button';
import Alert from '../common/Alert';
import { useFormSubmit } from '../../hooks/useFormSubmit';
import { PasswordResetPayload } from '../../types'; // Import type
import { resetPassword as resetPasswordService } from '../../services/authService'; // API service call

// --- Component Props ---
interface ResetPasswordFormProps {
  token: string; // The reset token from the URL
}

// --- Component ---

/**
 * Renders the form for users to set a new password using a reset token.
 */
const ResetPasswordForm: React.FC<ResetPasswordFormProps> = ({ token }) => {
  // --- Hooks ---
  const navigate = useNavigate();

  // --- State ---
  const [formData, setFormData] = useState({
    newPassword: '',
    confirmPassword: '',
  });
  // Local state for success feedback before redirect
  const [showSuccess, setShowSuccess] = useState<boolean>(false);

  // --- Custom Hook for Submission ---
  const {
    submit: handleResetSubmit,
    isLoading,
    error,
    clearError,
    // successMessage from hook options is not used directly
  } = useFormSubmit<PasswordResetPayload, string>( // Expects payload, returns success message string
    resetPasswordService,
    {
      onSuccess: (message) => {
        console.log('Password reset successful:', message);
        setShowSuccess(true); // Show local success message
        // Redirect to login page after a delay
        setTimeout(() => {
          navigate('/login', { state: { passwordResetSuccess: true, message: message } });
        }, 3000); // 3 second delay
      },
      onError: (err) => {
        // Error message is handled by the hook's state
        console.error("Password reset failed (hook callback):", err);
        setShowSuccess(false); // Hide success message on error
      },
    }
  );

  // --- Handlers ---
  /**
   * Handles changes in form input fields.
   */
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
    // Clear errors/success message when user types again
    if (error) clearError();
    if (showSuccess) setShowSuccess(false);
  };

  /**
   * Handles form submission.
   */
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Basic validation
    if (formData.newPassword !== formData.confirmPassword) {
      alert("Passwords do not match.");
      return;
    }
    if (formData.newPassword.length < 8) {
      alert("Password must be at least 8 characters long.");
      return;
    }

    // Prepare payload for the API
    // *** FIXED: Use camelCase keys to match backend model json tags ***
    const payload: PasswordResetPayload = {
      token: token,
      newPassword: formData.newPassword,       // Use camelCase
      confirmPassword: formData.confirmPassword, // Use camelCase
    };

    // Call the hook's submit function
    handleResetSubmit(payload);
  };

  // --- Render ---
  return (
    <form onSubmit={handleSubmit} className="reset-password-form">
      {/* Display error message from hook state */}
      {error && !showSuccess && <Alert type="error" message={error} className="mb-4" />}

      {/* Display local success message */}
      {showSuccess && (
        <Alert type="success" message="Password reset successfully! Redirecting to login..." className="mb-4" />
      )}

      {/* New Password Input */}
      <Input
        label="New Password"
        id="newPassword"
        name="newPassword" // Keep name camelCase for state binding
        type="password"
        value={formData.newPassword}
        onChange={handleChange}
        placeholder="Enter new password (min. 8 characters)"
        required
        minLength={8}
        disabled={isLoading || showSuccess}
        containerClassName="mb-4"
      />

      {/* Confirm New Password Input */}
      <Input
        label="Confirm New Password"
        id="confirmPassword"
        name="confirmPassword" // Keep name camelCase for state binding
        type="password"
        value={formData.confirmPassword}
        onChange={handleChange}
        placeholder="Confirm your new password"
        required
        minLength={8}
        disabled={isLoading || showSuccess}
        containerClassName="mb-6"
      />

      {/* Submit Button */}
      <Button
        type="submit"
        variant="primary"
        isLoading={isLoading}
        disabled={isLoading || showSuccess}
        className="w-full"
      >
        {isLoading ? 'Resetting Password...' : 'Reset Password'}
      </Button>
    </form>
  );
};

export default ResetPasswordForm;
