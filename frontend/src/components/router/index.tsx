// src/router/index.tsx
// ==========================================================================
// Main application router configuration using React Router DOM.
// Defines public and private routes, utilizing layout components.
// **SIMPLIFIED**: Removed task-related routes to focus on ticket management.
// ==========================================================================

import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// --- Layout Components ---
import MainLayout from '../../layouts/MainLayout'; // Adjusted path for authenticated routes
import PublicLayout from '../../layouts/PublicLayout'; // Layout for public routes
import AuthLayout from '../../layouts/AuthLayout'; // Layout for login/auth routes

// --- Route Protection ---
import ProtectedRoute from './ProtectedRoute'; // Component to guard private routes
import AdminRoute from './AdminRoute'; // Component to guard admin-only routes

// --- Page Components ---
// Public Pages
import HomePage from '../../pages/public/HomePage';
import FAQPage from '../../pages/public/FAQPage';
import CreateTicketPage from '../../pages/public/CreateTicketPage';
// Auth Pages
import LoginPage from '../../pages/auth/LoginPage';
// Dashboard Pages (Authenticated)
import DashboardPage from '../../pages/dashboard/DashboardPage';
import TicketsPage from '../../pages/dashboard/TicketsPage';
import TicketDetailPage from '../../pages/dashboard/TicketDetailPage';
import ProfilePage from '../../pages/dashboard/ProfilePage';
// Admin Pages
import UsersPage from '../../pages/dashboard/UsersPage';
import UserFormPage from '../../pages/dashboard/UserFormPage';
import SettingsPage from '../../pages/dashboard/SettingsPage';
// Other
import NotFoundPage from '../../pages/NotFoundPage'; // 404 Page

// --- Router Component ---

/**
 * Defines the application's routes using React Router.
 * Organizes routes into public, authentication, and protected (dashboard/admin) sections,
 * applying appropriate layouts and route guards.
 */
const AppRouter: React.FC = () => {
    return (
    <Routes>
        {/* --- Public Routes (using PublicLayout) --- */}
        <Route path="/" element={<PublicLayout />}>
        <Route index element={<HomePage />} /> {/* Homepage at root */}
        <Route path="faq" element={<FAQPage />} />
        <Route path="create-ticket" element={<CreateTicketPage />} />
        {/* Add other public routes here (e.g., Terms, Privacy) */}
        </Route>

        {/* --- Authentication Routes (using AuthLayout) --- */}
        <Route path="/login" element={<AuthLayout />}>
        <Route index element={<LoginPage />} />
        {/* Add other auth routes like Forgot Password if needed */}
        </Route>

        {/* --- Protected Routes (using MainLayout and ProtectedRoute guard) --- */}
        <Route
        path="/" // Base path for protected routes (can adjust if needed, e.g., /app)
        element={
            <ProtectedRoute> {/* Ensures user is authenticated */}
            <MainLayout /> {/* Common layout for authenticated pages */}
            </ProtectedRoute>
        }
        >
        {/* Default route after login */}
        <Route path="dashboard" element={<DashboardPage />} />

        {/* Ticket Routes */}
        <Route path="tickets" element={<TicketsPage />} />
        <Route path="tickets/:ticketId" element={<TicketDetailPage />} />
        {/* Optional: Route for creating tickets within dashboard */}
        {/* <Route path="tickets/new" element={<CreateTicketInternalPage />} /> */}

        {/* Profile Route (Accessible to all authenticated users) */}
        <Route path="profile" element={<ProfilePage />} />

        {/* --- Admin Only Routes (using AdminRoute guard) --- */}
        <Route
            path="/" // Nested under the protected route base
            element={
            <AdminRoute> {/* Ensures user is Admin */}
                <Outlet /> {/* Renders the nested admin routes */}
            </AdminRoute>
            }
        >
            <Route path="users" element={<UsersPage />} />
            <Route path="users/new" element={<UserFormPage />} />
            <Route path="users/edit/:userId" element={<UserFormPage />} />
            <Route path="settings" element={<SettingsPage />} />
        </Route>
        {/* --- End Admin Only Routes --- */}

        </Route>
        {/* --- End Protected Routes --- */}


        {/* --- Not Found Route --- */}
        {/* Matches any path not matched above */}
        <Route path="*" element={<NotFoundPage />} />

    </Routes>
    );
};

    // Helper component needed for nested AdminRoute structure
    // Alternatively, structure routes differently if Outlet isn't desired here.
    const Outlet: React.FC = () => <React.Fragment><Routes><Route path="*" element={null} /></Routes><RouterOutlet /></React.Fragment>;
    import { Outlet as RouterOutlet } from 'react-router-dom';


export default AppRouter;
