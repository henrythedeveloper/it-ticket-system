// src/components/forms/ForgotPasswordForm.tsx
// ==========================================================================
// Component rendering the form to request a password reset link.
// Handles email input, submission, and feedback messages.
// ==========================================================================

import React, { useState } from 'react';
import Input from '../common/Input';
import Button from '../common/Button';
import Alert from '../common/Alert';
import { useFormSubmit } from '../../hooks/useFormSubmit';
import { PasswordResetRequest } from '../../types'; // Import type
import { requestPasswordReset } from '../../services/authService'; // API service call

// --- Component ---

/**
 * Renders the form for users to request a password reset email.
 */
const ForgotPasswordForm: React.FC = () => {
  // --- State ---
  const [email, setEmail] = useState<string>('');
  // Local state to display the success message persistently after submission
  const [showSuccessMessage, setShowSuccessMessage] = useState<string | null>(null);

  // --- Custom Hook for Submission ---
  const {
    submit: handleRequestReset,
    isLoading,
    error,
    clearError,
    // successMessage from hook options is not used directly, using local state instead
  } = useFormSubmit<PasswordResetRequest, string>( // Expects request object, returns success message string
    requestPasswordReset,
    {
      onSuccess: (message) => {
        console.log('Password reset request successful:', message);
        // Set the success message to display persistently
        setShowSuccessMessage(message || "If an account with that email exists, a password reset link has been sent.");
        setEmail(''); // Clear the email field
      },
      onError: (err) => {
        // Error message is handled by the hook's state
        console.error("Password reset request failed (hook callback):", err);
        setShowSuccessMessage(null); // Hide success message on error
      },
    }
  );

  // --- Handlers ---
  /**
   * Handles changes in the email input field.
   */
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    // Clear errors/success message when user types again
    if (error) clearError();
    if (showSuccessMessage) setShowSuccessMessage(null);
  };

  /**
   * Handles form submission.
   */
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!email) {
      alert("Please enter your email address.");
      return;
    }
    // Call the hook's submit function
    handleRequestReset({ email });
  };

  // --- Render ---
  return (
    <form onSubmit={handleSubmit} className="forgot-password-form">
      {/* Display error message from hook state */}
      {error && !showSuccessMessage && <Alert type="error" message={error} className="mb-4" />}

      {/* Display persistent success message from local state */}
      {showSuccessMessage && (
        <Alert type="success" message={showSuccessMessage} className="mb-4" />
      )}

      {/* Email Input */}
      <Input
        label="Email Address"
        id="email"
        name="email"
        type="email"
        value={email}
        onChange={handleChange}
        placeholder="Enter your account email"
        required
        disabled={isLoading || !!showSuccessMessage} // Disable if loading or success message shown
        containerClassName="mb-6"
      />

      {/* Submit Button */}
      <Button
        type="submit"
        variant="primary"
        isLoading={isLoading}
        disabled={isLoading || !!showSuccessMessage} // Disable if loading or success message shown
        className="w-full"
      >
        {isLoading ? 'Sending Request...' : 'Send Reset Link'}
      </Button>
    </form>
  );
};

export default ForgotPasswordForm;

