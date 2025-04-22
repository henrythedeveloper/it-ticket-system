// src/components/forms/LoginForm.tsx
// ==========================================================================
// Component rendering the login form. Handles user input, submission,
// loading state, and error display for the login process.
// Refactored to use the useFormSubmit hook.
// ==========================================================================

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth'; // Auth context hook
import { useFormSubmit } from '../../hooks/useFormSubmit'; // Custom submission hook
import Input from '../common/Input'; // Reusable Input component
import Button from '../common/Button'; // Reusable Button component
import Alert from '../common/Alert'; // Reusable Alert component
import { LoginFormInputs, User } from '../../types'; // Form input types
import { login as loginService } from '../../services/authService'; // API service call

/**
 * Expected response structure from the login service.
 */
interface LoginResponse {
    token: string;
    user: User;
}

// --- Component ---

/**
 * Renders the login form and handles the authentication process using useFormSubmit.
 */
const LoginForm: React.FC = () => {
    // --- Hooks ---
    const navigate = useNavigate();
    const { login: contextLogin } = useAuth(); // Get login function from auth context

    // --- State ---
    const [formData, setFormData] = useState<LoginFormInputs>({ email: '', password: '' });

    // --- Custom Hook for Submission ---
    const {
    submit: handleLoginSubmit, // Renamed for clarity
    isLoading,
    error,
    clearError, // Function to clear error manually if needed
    // successMessage is not used here as we navigate on success
    } = useFormSubmit<LoginFormInputs, LoginResponse>(
    // Pass the actual API function for logging in
    loginService,
    // Configuration options
    {
        onSuccess: ({ token, user }) => {
        // Update global auth state via context/store
        contextLogin(token, user);
        // Redirect to dashboard on successful login
        navigate('/dashboard');
        },
        onError: (err) => {
        // Error message is handled by the hook's state
        console.error("Login failed (hook callback):", err);
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
    // Clear error from hook state when user starts typing again
    if (error) {
        clearError();
    }
    };

    /**
     * Handles form submission by calling the submit function from the hook.
     */
    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); // Prevent default form submission
    // Basic validation inline (could be improved with libraries)
    if (!formData.password) {
            // We could use the hook's error state here, but maybe a direct alert is fine too
            alert("Password is required."); // Or set a local validation error state
            return;
    }
    handleLoginSubmit(formData); // Call the hook's submit function
    };

    // --- Render ---
    return (
    <form onSubmit={handleSubmit} className="login-form">
        {/* Display login error message from hook state */}
        {error && <Alert type="error" message={error} className="mb-4" />}

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
        disabled={isLoading} // Use isLoading from hook
        containerClassName="mb-4" // Margin bottom utility class
        />

        {/* Password Input */}
        <Input
        label="Password"
        id="password"
        name="password"
        type="password"
        value={formData.password ?? ''} // Handle potential undefined value
        onChange={handleChange}
        placeholder="Enter your password"
        required
        disabled={isLoading} // Use isLoading from hook
        containerClassName="mb-6" // More margin before button
        />

        {/* Submit Button */}
        <Button
        type="submit"
        variant="primary"
        isLoading={isLoading} // Use isLoading from hook
        disabled={isLoading} // Use isLoading from hook
        className="w-full" // Example utility class for full width
        >
        {isLoading ? 'Logging In...' : 'Login'}
        </Button>
    </form>
    );
};

export default LoginForm;
