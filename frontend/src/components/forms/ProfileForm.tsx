// src/components/forms/ProfileForm.tsx
// ==========================================================================
// Component rendering the form for editing user profile information.
// Refactored to use the useFormSubmit hook.
// ==========================================================================

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth'; // Auth context hook
import { useFormSubmit } from '../../hooks/useFormSubmit'; // Custom submission hook
import Input from '../common/Input'; // Reusable Input component
import Button from '../common/Button'; // Reusable Button component
import Alert from '../common/Alert'; // Reusable Alert component
import { User } from '../../types'; // User type
import { updateUser } from '../../services/userService'; // API service call

// --- Component Props ---
interface ProfileFormProps {
    currentUser: User;
    onUpdateSuccess: (updatedUser: User) => void; // Keep callback for potential parent actions
}

// --- Form Input Data Structure ---
interface ProfileFormInputs {
    name: string;
    email: string;
}

// --- Component ---

/**
 * Renders a form for users to update their profile information (name, email)
 * using the useFormSubmit hook.
 *
 * @param {ProfileFormProps} props - The component props.
 * @returns {React.ReactElement} The rendered ProfileForm component.
 */
const ProfileForm: React.FC<ProfileFormProps> = ({ currentUser, onUpdateSuccess }) => {
    // --- Hooks ---
    const { setUser: setAuthUser } = useAuth(); // Function to update user in auth context

    // --- State ---
    const [formData, setFormData] = useState<ProfileFormInputs>({
    name: currentUser.name || '',
    email: currentUser.email || '',
    });

    // --- Custom Hook for Submission ---
    const {
    submit: saveProfile, // Renamed for clarity
    isLoading,
    error,
    successMessage,
    clearError,
    clearSuccessMessage,
    } = useFormSubmit<ProfileFormInputs, User>(
    // Pass the API function (partially applied with user ID)
    (data) => updateUser(currentUser.id, data),
    // Configuration options
    {
        onSuccess: (updatedUser) => {
        // Update user in global auth context/store
        setAuthUser(updatedUser);
        // Update local form state in case user wants to edit further
        setFormData({ name: updatedUser.name, email: updatedUser.email });
        // Trigger success callback for parent component
        onUpdateSuccess(updatedUser);
        // Success message handled by hook state
        },
        onError: (err) => {
        console.error("Profile update failed (hook callback):", err);
        // Error message handled by hook state
        },
        successMessage: 'Profile updated successfully!',
    }
    );

    // --- Effects ---
    // Update form data if currentUser prop changes
    useEffect(() => {
    setFormData({
        name: currentUser.name || '',
        email: currentUser.email || '',
    });
    // Clear messages if the user context changes externally
    clearError();
    clearSuccessMessage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentUser]); // Rerun only when currentUser changes

    // --- Handlers ---
    /**
     * Handles changes in form input fields. Clears hook messages.
     */
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({
        ...prevData,
        [name]: value,
    }));
    // Clear feedback messages from the hook when user makes changes
    if (error) clearError();
    if (successMessage) clearSuccessMessage();
    };

    /**
     * Handles form submission by calling the submit function from the hook.
     */
    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    saveProfile(formData); // Call the hook's submit function
    };

    // --- Render ---
    return (
    <form onSubmit={handleSubmit} className="profile-form">
        {/* Display messages from the hook state */}
        {error && <Alert type="error" message={error} className="mb-4" />}
        {successMessage && <Alert type="success" message={successMessage} className="mb-4" />}

        {/* Name Input */}
        <Input
        label="Full Name" id="name" name="name" type="text"
        value={formData.name} onChange={handleChange} required
        disabled={isLoading} // Use isLoading from hook
        containerClassName="mb-4"
        />

        {/* Email Input */}
        <Input
        label="Email Address" id="email" name="email" type="email"
        value={formData.email} onChange={handleChange} required
        disabled={isLoading} // Use isLoading from hook
        containerClassName="mb-6"
        />

        {/* Submit Button */}
        <div className="form-actions">
        <Button
            type="submit" variant="primary"
            isLoading={isLoading} // Use isLoading from hook
            disabled={isLoading} // Use isLoading from hook
            className="submit-btn"
        >
            {isLoading ? 'Saving...' : 'Save Changes'}
        </Button>
        </div>
    </form>
    );
};

export default ProfileForm;
