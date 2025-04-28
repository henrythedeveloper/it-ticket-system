// src/router/ProtectedRoute.tsx
// ==========================================================================
// Route guard component. Checks if a user is authenticated.
// If authenticated, renders the child components (usually a Layout + Outlet).
// If not authenticated, redirects to the login page.
// Fixed children prop type.
// ==========================================================================

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth'; // Auth context hook
import Loader from '../common/Loader'; // Loader component

// --- Component Props ---

interface ProtectedRouteProps {
    /** The child elements to render if the user is authenticated. */
    // FIX: Change type from React.ReactElement to React.ReactNode
    children: React.ReactNode;
}

// --- Component ---

/**
 * A route guard that checks for user authentication.
 * - If the authentication state is still loading, it displays a loader.
 * - If the user is authenticated, it renders the intended child component(s).
 * - If the user is not authenticated, it redirects them to the login page,
 * preserving the originally requested location for potential redirection after login.
 *
 * @param {ProtectedRouteProps} props - The component props.
 * @returns {React.ReactElement | null} The child component, a Loader, or a Navigate component.
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
    // --- Hooks ---
    const { isAuthenticated, loading } = useAuth(); // Get auth state and loading status
    const location = useLocation(); // Get current location to redirect back after login

    // --- Render Logic ---
    // 1. Show loader while authentication status is being checked
    console.log('[ProtectedRoute] Rendering. Checking auth state:', { loading, isAuthenticated });
    if (loading) {
    // You might want a more prominent, full-page loader here
    return <Loader text="Authenticating..." />;
    }

    // 2. If authenticated, render the requested child route/component
    if (isAuthenticated) {
    // Render children (can be one or more elements wrapped in Fragment implicitly)
    return <>{children}</>;
    }

    // 3. If not authenticated, redirect to login page
    //    Pass the current location state so the login page can redirect back
    return <Navigate to="/login" state={{ from: location }} replace />;
};

export default ProtectedRoute;
