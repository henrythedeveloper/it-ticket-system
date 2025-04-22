// src/pages/auth/LoginPage.tsx
// ==========================================================================
// Component representing the login page.
// Primarily renders the LoginForm component.
// ==========================================================================

import React from 'react';
import LoginForm from '../../components/forms/LoginForm'; // The actual login form

// --- Component ---

/**
 * Renders the login page, displaying the login form.
 * This component mainly acts as a container within the AuthLayout.
 */
const LoginPage: React.FC = () => {
  // --- Render ---
  // The surrounding AuthLayout provides the card styling and centering.
  // This component just needs to render the form itself.
  return (
    <div className="login-page-content">
        {/* Optional: Add title or description specific to the login page if needed */}
        {/* <h1>Agent Login</h1> */}
        {/* <p className="login-description">Please enter your credentials to access the dashboard.</p> */}

        <LoginForm />

        {/* Optional: Add links like "Forgot Password?" if needed */}
        {/* <div className="login-links mt-4">
            <Link to="/forgot-password">Forgot Password?</Link>
        </div> */}
    </div>

  );
};

export default LoginPage;
