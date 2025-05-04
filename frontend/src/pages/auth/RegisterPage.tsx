// src/pages/auth/RegisterPage.tsx
// ==========================================================================
// Component representing the user registration page.
// Renders the RegisterForm component within the AuthLayout.
// ==========================================================================

import React from 'react';
import RegisterForm from '../../components/forms/RegisterForm'; // Import the registration form

// --- Component ---

/**
 * Renders the registration page, displaying the registration form.
 */
const RegisterPage: React.FC = () => {
  // --- Render ---
  // The surrounding AuthLayout provides the card styling and centering.
  return (
    <div className="register-page-content">
      {/* Page Title */}
      <h1>Create New Account</h1>
      <p className="register-description mb-6">
        Fill out the form below to register as a new staff member.
      </p>

      {/* Registration Form */}
      <RegisterForm />
    </div>
  );
};

export default RegisterPage;
