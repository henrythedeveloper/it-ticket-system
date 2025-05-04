// src/components/layouts/AuthLayout.tsx
// ==========================================================================
// Layout component specifically for authentication pages (e.g., Login).
// Provides a centered container structure.
// ==========================================================================

import React from 'react';
import { Outlet, Link } from 'react-router-dom'; // Renders nested routes

// --- Component ---

/**
 * Renders the layout structure for authentication pages.
 * Centers the content (rendered via <Outlet />) within a container.
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
          <Outlet />
        </main>

        {/* Optional: Footer section within the auth container */}
        {/* <footer className="auth-footer">
          <p>&copy; {new Date().getFullYear()} HelpDesk System</p>
        </footer> */}
      </div>
    </div>
  );
};

export default AuthLayout;
