// src/router/index.tsx
// ==========================================================================
// Main application router configuration using React Router DOM.
// Defines public and private routes, utilizing layout components.
// **REVISED**: Added route for ResetPasswordPage with token parameter.
// ==========================================================================

import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { Outlet as RouterOutlet } from 'react-router-dom';

// --- Layout Components ---
import MainLayout from '../../layouts/MainLayout';
import PublicLayout from '../../layouts/PublicLayout';
import AuthLayout from '../../layouts/AuthLayout'; // Layout for login/auth routes

// --- Route Protection ---
import ProtectedRoute from './ProtectedRoute';
import AdminRoute from './AdminRoute';

// --- Page Components ---
// Public Pages
import HomePage from '../../pages/public/HomePage';
import FAQPage from '../../pages/public/FAQPage';
import CreateTicketPage from '../../pages/public/CreateTicketPage';
// Auth Pages
import LoginPage from '../../pages/auth/LoginPage';
import RegisterPage from '../../pages/auth/RegisterPage';
import ForgotPasswordPage from '../../pages/auth/ForgotPasswordPage';
import ResetPasswordPage from '../../pages/auth/ResetPasswordPage'; // <<< Import ResetPasswordPage
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
import NotFoundPage from '../../pages/NotFoundPage';

// --- Router Component ---

/**
 * Defines the application's routes using React Router.
 * Organizes routes into public, authentication, and protected sections.
 */
const AppRouter: React.FC = () => {
    return (
    <Routes>
        {/* --- Public Routes (using PublicLayout) --- */}
        <Route path="/" element={<PublicLayout />}>
        <Route index element={<HomePage />} />
        <Route path="faq" element={<FAQPage />} />
        <Route path="create-ticket" element={<CreateTicketPage />} />
        {/* Add other public routes here */}
        </Route>

        {/* --- Authentication Routes (using AuthLayout) --- */}
        {/* Group auth routes under AuthLayout */}
        <Route element={<AuthLayout />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password/:token" element={<ResetPasswordPage />} /> {/* <<< Added Reset Password Route */}
        </Route>

        {/* --- Protected Routes (using MainLayout and ProtectedRoute guard) --- */}
        <Route
        path="/" // Base path for protected routes
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

        {/* Profile Route */}
        <Route path="profile" element={<ProfilePage />} />

        {/* --- Admin Only Routes (using AdminRoute guard) --- */}
        <Route
            path="/" // Nested under the protected route base
            element={
            <AdminRoute> {/* Ensures user is Admin */}
                <RouterOutlet /> {/* Renders the nested admin routes */}
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
        <Route path="*" element={<NotFoundPage />} />

    </Routes>
    );
};

export default AppRouter;
