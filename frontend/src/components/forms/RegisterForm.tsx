// src/components/forms/RegisterForm.tsx
// ==========================================================================
// Component rendering the user registration form. Handles input, validation,
// submission, loading state, and success/error messages.
// **REVISED**: Added explicit type for prevData in handleChange.
// ==========================================================================

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Input from '../common/Input';
import Button from '../common/Button';
import Alert from '../common/Alert';
import { useFormSubmit } from '../../hooks/useFormSubmit';
import { UserRegister, User } from '../../types'; // Import types
import { register as registerService } from '../../services/authService'; // API service call

// --- Component ---

/**
 * Renders the user registration form and handles the account creation process.
 */
const RegisterForm: React.FC = () => {
  // --- Hooks ---
  const navigate = useNavigate();

  // --- State ---
  const [formData, setFormData] = useState<UserRegister>({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  // Local state to show success message *before* redirecting
  const [showSuccess, setShowSuccess] = useState<boolean>(false);

  // --- Custom Hook for Submission ---
  const {
    submit: handleRegisterSubmit,
    isLoading,
    error,
    clearError,
    // successMessage from hook options is not used directly here
  } = useFormSubmit<UserRegister, User>( // Expects UserRegister, returns User
    registerService,
    {
      onSuccess: (newUser) => {
        console.log('Registration successful:', newUser);
        // Show local success message
        setShowSuccess(true);
        // Redirect to login page after a short delay
        setTimeout(() => {
          navigate('/login', { state: { registrationSuccess: true } }); // Pass state to login page if needed
        }, 2500); // 2.5 second delay
      },
      onError: (err) => {
        // Error message is handled by the hook's state
        console.error("Registration failed (hook callback):", err);
        setShowSuccess(false); // Ensure success message is hidden on error
      },
      // No successMessage option needed here as we handle it locally
    }
  );

  // --- Handlers ---
  /**
   * Handles changes in form input fields.
   */
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    // *** Added explicit type for prevData ***
    setFormData((prevData: UserRegister) => ({
      ...prevData,
      [name]: value,
    }));
    // Clear error/success messages from hook/local state when user types again
    if (error) clearError();
    if (showSuccess) setShowSuccess(false);
  };

  /**
   * Handles form submission.
   */
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Basic validation (more can be added with Yup/Formik)
    if (formData.password !== formData.confirmPassword) {
      alert("Passwords do not match."); // Simple validation
      return;
    }
    if (!formData.password || formData.password.length < 8) { // Check password exists before length check
        alert("Password must be at least 8 characters long.");
        return;
    }
    // Call the hook's submit function
    handleRegisterSubmit(formData);
  };

  // --- Render ---
  return (
    <form onSubmit={handleSubmit} className="register-form">
      {/* Display registration error message from hook state */}
      {error && !showSuccess && <Alert type="error" message={error} className="mb-4" />}

      {/* Display local success message */}
      {showSuccess && (
        <Alert type="success" message="Registration successful! Redirecting to login..." className="mb-4" />
      )}

      {/* Name Input */}
      <Input
        label="Full Name"
        id="name"
        name="name"
        type="text"
        value={formData.name}
        onChange={handleChange}
        placeholder="Enter your full name"
        required
        disabled={isLoading || showSuccess} // Disable on loading or success
        containerClassName="mb-4"
      />

      {/* Email Input */}
      <Input
        label="Email Address"
        id="email"
        name="email"
        type="email"
        value={formData.email}
        onChange={handleChange}
        placeholder="you@example.com"
        required
        disabled={isLoading || showSuccess}
        containerClassName="mb-4"
      />

      {/* Password Input */}
      <Input
        label="Password"
        id="password"
        name="password"
        type="password"
        value={formData.password ?? ''} // Handle potential undefined
        onChange={handleChange}
        placeholder="Enter password (min. 8 characters)"
        required
        minLength={8}
        disabled={isLoading || showSuccess}
        containerClassName="mb-4"
      />

      {/* Confirm Password Input */}
      <Input
        label="Confirm Password"
        id="confirmPassword"
        name="confirmPassword"
        type="password"
        value={formData.confirmPassword ?? ''} // Handle potential undefined
        onChange={handleChange}
        placeholder="Confirm your password"
        required
        minLength={8}
        disabled={isLoading || showSuccess}
        containerClassName="mb-6" // More margin before button
      />

      {/* Submit Button */}
      <Button
        type="submit"
        variant="primary"
        isLoading={isLoading}
        disabled={isLoading || showSuccess} // Disable on loading or success
        className="w-full" // Example utility class for full width
      >
        {isLoading ? 'Registering...' : 'Register'}
      </Button>
    </form>
  );
};

export default RegisterForm;

