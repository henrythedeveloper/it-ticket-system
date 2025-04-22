// src/components/forms/UserForm.tsx
// ==========================================================================
// Component rendering the form for creating or editing users (Admin).
// Refactored to use the useFormSubmit hook.
// ==========================================================================

import React, { useState, useEffect } from 'react';
import Input from '../common/Input';
import Select from '../common/Select';
import Button from '../common/Button';
import Alert from '../common/Alert';
import { useFormSubmit } from '../../hooks/useFormSubmit'; // Custom hook
import { User } from '../../types'; // Import types
import { createUser, updateUser } from '../../services/userService'; // API service calls

// --- Component Props ---
interface UserFormProps {
    user?: User | null;
    onSaveSuccess: (savedUser: User) => void;
    onCancel: () => void;
}

// --- Form Input Data Structure ---
interface UserFormInputs {
    name: string;
    email: string;
    role: User['role'];
    password?: string; // Optional
}

// --- API Payload Structure ---
// Define the shape expected by the API services
type UserApiPayload = Partial<Omit<User, 'id' | 'createdAt' | 'updatedAt'>> & {
    password?: string;
};

// --- Component ---

/**
 * Renders a form for creating or editing user accounts (Admin functionality)
 * using the useFormSubmit hook.
 *
 * @param {UserFormProps} props - The component props.
 * @returns {React.ReactElement} The rendered UserForm component.
 */
const UserForm: React.FC<UserFormProps> = ({ user, onSaveSuccess, onCancel }) => {
    // --- Mode ---
    const isEditMode = !!user;

    // --- State ---
    const [formData, setFormData] = useState<UserFormInputs>({
    name: '', email: '', role: 'User', password: '',
    });

    // --- Custom Hook for Submission ---
    // Define the submission function that calls the correct API
    const submitApiCall = (data: UserApiPayload): Promise<User> => {
        if (isEditMode && user) {
            return updateUser(user.id, data);
        } else {
            // Ensure password is provided for creation (should be validated before calling hook)
            if (!data.password) return Promise.reject(new Error("Password required for new user"));
            return createUser(data as Required<UserApiPayload>); // Cast needed
        }
    };

    const {
        submit: saveUser,
        isLoading,
        error,
        clearError,
        // successMessage not needed, onSaveSuccess handles UI change
    } = useFormSubmit<UserApiPayload, User>(
        submitApiCall,
        {
            onSuccess: (savedUser) => {
                onSaveSuccess(savedUser); // Notify parent component
            },
            onError: (err) => {
                console.error("Failed to save user (hook callback):", err);
                // Error message handled by hook state
            },
        }
    );


    // --- Effects ---
    // Pre-fill form if in edit mode
    useEffect(() => {
    if (isEditMode && user) {
        setFormData({
        name: user.name || '', email: user.email || '',
        role: user.role || 'User', password: '', // Don't pre-fill password
        });
    } else {
        // Reset for create mode
            setFormData({ name: '', email: '', role: 'User', password: '' });
    }
    clearError(); // Clear error when user changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isEditMode, user]); // Depend on mode and user

    // --- Handlers ---
    /**
     * Handles changes in form input/select fields. Clears hook error.
     */
    const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
    ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (error) clearError();
    };

    /**
     * Handles form submission (create or update).
     */
    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isEditMode && !formData.password) {
        alert('Password is required for new users.'); // Simple validation
        return;
    }

    // Prepare payload, handle optional password
    const userDataPayload: UserApiPayload = {
        name: formData.name, email: formData.email, role: formData.role,
    };
    if (formData.password) { // Only include password if provided
        userDataPayload.password = formData.password;
    }

    saveUser(userDataPayload); // Call the hook's submit function
    };

    // --- Options ---
    const roleOptions: { value: User['role']; label: string }[] = [
    { value: 'User', label: 'User (Submitter Only)' },
    { value: 'Staff', label: 'Staff (Can be assigned tickets)' },
    { value: 'Admin', label: 'Administrator (Full access)' },
    ];

    // --- Render ---
    return (
    <form onSubmit={handleSubmit} className="user-form">
        {error && <Alert type="error" message={error} className="mb-4" />}

        {/* Name Input */}
        <Input label="Full Name" id="name" name="name" type="text"
        value={formData.name} onChange={handleChange} required disabled={isLoading}
        containerClassName="mb-4" />

        {/* Email Input */}
        <Input label="Email Address" id="email" name="email" type="email"
        value={formData.email} onChange={handleChange} required disabled={isLoading}
        containerClassName="mb-4" />

        {/* Role Select */}
        <Select label="Role" id="role" name="role" options={roleOptions}
        value={formData.role} onChange={handleChange} required disabled={isLoading}
        containerClassName="mb-4" />

        {/* Password Input */}
        <Input label={isEditMode ? "New Password (Optional)" : "Password"} id="password" name="password"
        type="password" value={formData.password ?? ''} onChange={handleChange}
        required={!isEditMode} disabled={isLoading}
        placeholder={isEditMode ? "Leave blank to keep current password" : "Enter password"}
        containerClassName="mb-6" />

        {/* Form Actions */}
        <div className="form-actions">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
            Cancel
        </Button>
        <Button type="submit" variant="primary" isLoading={isLoading} disabled={isLoading}>
            {isLoading ? (isEditMode ? 'Saving User...' : 'Creating User...') : (isEditMode ? 'Save Changes' : 'Create User')}
        </Button>
        </div>
    </form>
    );
};

export default UserForm;
