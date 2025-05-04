// src/layouts/AuthLayout.tsx
// ==========================================================================
// Layout component specifically for authentication pages (e.g., Login).
// Provides a centered container structure.
// **REVISED**: Added Login link to the footer links.
// ==========================================================================

import React from 'react';
import { Outlet, Link } from 'react-router-dom'; // Renders nested routes

// --- Component ---

/**
 * Renders the layout structure for authentication pages.
 * Centers the content (rendered via <Outlet />) within a container.
 * Includes links for login, registration, and password recovery.
 */
const AuthLayout: React.FC = () => {
  return (
    <div className="auth-layout">
      <div className="auth-container">
        {/* Header section within the auth container (e.g., Logo) */}
        <header className="auth-header">
          <Link to="/" className="auth-logo"> {/* Link logo to homepage */}
            HelpDesk System
          </Link>
        </header>

        {/* Main content area where nested routes (like LoginPage) will render */}
        <main className="auth-content">
          <Outlet /> {/* Renders LoginPage, RegisterPage, etc. */}
        </main>

        {/* Footer section within the auth container */}
        <footer className="auth-footer">
          <div className="auth-links">
            {/* Added Login Link */}
            <Link to="/login">Login</Link>
            <span className="link-separator">|</span>
            <Link to="/register">Register New Account</Link>
            <span className="link-separator">|</span>
            <Link to="/forgot-password">Forgot Password?</Link>
          </div>
          <p className="copyright">&copy; {new Date().getFullYear()} HelpDesk System</p>
        </footer>
      </div>
    </div>
  );
};

export default AuthLayout;

