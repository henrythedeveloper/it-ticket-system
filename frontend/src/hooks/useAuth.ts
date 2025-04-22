// src/hooks/useAuth.ts
// ==========================================================================
// Custom hook to access authentication context.
// Provides a convenient way to get auth state and actions throughout the app.
// ==========================================================================

import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext'; // Adjust path if needed
import { AuthContextType } from '../types'; // Adjust path if needed

/**
 * Custom hook `useAuth`
 *
 * Provides access to the authentication context (`AuthContext`).
 * It ensures that the hook is used within a component wrapped by `AuthProvider`.
 *
 * @returns {AuthContextType} The authentication context value, including:
 * - `user`: The currently authenticated user object or null.
 * - `token`: The authentication token or null.
 * - `isAuthenticated`: Boolean indicating if the user is authenticated.
 * - `login`: Function to handle user login.
 * - `logout`: Function to handle user logout.
 * - `loading`: Boolean indicating if the auth state is currently being loaded/verified.
 *
 * @throws {Error} If used outside of an `AuthProvider`.
 */
export const useAuth = (): AuthContextType => {
    // Get the context value
    const context = useContext(AuthContext);

    // Ensure the context exists (i.e., the hook is used within the AuthProvider)
    if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
    }

    // Return the context value
    return context;
};
