// src/router/AdminRoute.tsx
// ==========================================================================
// Route guard component specifically for Admin-only routes.
// Checks if the authenticated user has the 'Admin' role.
// Ensuring children prop type is React.ReactNode.
// ==========================================================================

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth'; // Auth context hook
import Loader from '../common/Loader'; // Loader component
import Alert from '../common/Alert'; // Alert component

// --- Component Props ---

interface AdminRouteProps {
    /** The child elements (Admin-only routes/components) to render if authorized. */
    // Ensure this type is React.ReactNode
    children: React.ReactNode;
}

// --- Component ---

/**
 * A route guard that checks if the currently authenticated user has the 'Admin' role.
 * - Assumes `ProtectedRoute` has already verified authentication.
 * - If the auth state is loading, shows a loader.
 * - If the user is an Admin, renders the child component(s).
 * - If the user is authenticated but not an Admin, displays an "Access Denied" message
 * or redirects to a suitable page (e.g., dashboard).
 *
 * @param {AdminRouteProps} props - The component props.
 * @returns {React.ReactElement | null} The child component, Loader, Alert, or Navigate component.
 */
const AdminRoute: React.FC<AdminRouteProps> = ({ children }) => {
    // --- Hooks ---
    const { user, loading, isAuthenticated } = useAuth(); // Get user, loading, and auth status
    const location = useLocation();

    // --- Render Logic ---
    // 1. Show loader if auth state is still loading
    if (loading) {
    return <Loader text="Verifying permissions..." />;
    }

    // 2. Check if authenticated and user has Admin role
    if (isAuthenticated && user?.role === 'Admin') {
    // Render children (can be one or more elements wrapped in Fragment implicitly)
    return <>{children}</>;
    }

    // 3. User is authenticated but NOT an Admin
    if (isAuthenticated) {
        // Option 1: Show an Access Denied message within the current layout
        return (
        <div style={{ padding: '2rem' }}> {/* Basic padding */}
                <Alert type="error" title="Access Denied" message="You do not have permission to access this page." />
        </div>
        );
        // Option 2: Redirect to dashboard or another appropriate page
        // return <Navigate to="/dashboard" replace />;
    }

    // 4. User is not authenticated at all (should have been caught by ProtectedRoute, but as a fallback)
    return <Navigate to="/login" state={{ from: location }} replace />;
};

export default AdminRoute;
