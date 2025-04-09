import React, { useEffect } from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const AuthLayout: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // Redirect authenticated users away from auth pages
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  return (
    <div className="auth-layout">
      <div className="auth-container">
        <div className="auth-header">
          <Link to="/" className="auth-logo">
            IT Helpdesk
          </Link>
        </div>
        <div className="auth-content">
          <Outlet />
        </div>
        <div className="auth-footer">
          <p>&copy; {new Date().getFullYear()} IT Helpdesk. All rights reserved.</p>
          <p>
            <Link to="/">Return to Home</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;