// src/layouts/PublicLayout.tsx
import React from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../hooks/useTheme'; // Import the theme hook

const PublicLayout: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme(); // Use the theme hook

  const handleLoginClick = () => {
    navigate('/login');
  };

  const handleDashboardClick = () => {
    navigate('/dashboard');
  };

  return (
    <div className="public-layout">
      {/* Sticky Theme Toggle Button */}
      <button
        onClick={toggleTheme}
        className="theme-toggle-sticky"
        aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
        title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
      >
        {theme === 'light' ? '🌙' : '☀️'} {/* Moon for light, Sun for dark */}
      </button>

      {/* Side Navigation */}
      <nav className="side-nav">
        {/* ... rest of side-nav content ... */}
         <div className="logo-container">
          <Link to="/" className="logo">
            IT Helpdesk
          </Link>
        </div>
        <ul className="nav-links">
          <li>
            <Link to="/">
              <span className="icon">🏠</span>
              <span className="link-text">Home</span>
            </Link>
          </li>
          <li>
            <Link to="/create-ticket">
              <span className="icon">📝</span>
              <span className="link-text">Submit Ticket</span>
            </Link>
          </li>
          <li>
            <Link to="/faq">
              <span className="icon">❓</span>
              <span className="link-text">FAQ</span>
            </Link>
          </li>
        </ul>
        <div className="auth-buttons">
          {isAuthenticated ? (
            <button className="dashboard-btn" onClick={handleDashboardClick}>
              <span className="icon">📊</span>
              <span className="btn-text">Dashboard</span>
            </button>
          ) : (
            <button className="login-btn" onClick={handleLoginClick}>
              <span className="icon">🔒</span>
              <span className="btn-text">Staff Login</span>
            </button>
          )}
        </div>
      </nav>

      {/* Main Content */}
      <main className="public-content">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="public-footer">
         {/* ... footer content ... */}
         <div className="footer-content">
          <div className="footer-section">
            <h3>IT Helpdesk</h3>
            <p>Your reliable IT support solution. We're here to help with all your technology needs.</p>
          </div>
          <div className="footer-section">
            <h3>Quick Links</h3>
            <ul>
              <li>
                <Link to="/">Home</Link>
              </li>
              <li>
                <Link to="/create-ticket">Submit Ticket</Link>
              </li>
              <li>
                <Link to="/faq">FAQ</Link>
              </li>
            </ul>
          </div>
          <div className="footer-section">
            <h3>Contact</h3>
            <p>Email: support@example.com</p>
            <p>Phone: (123) 456-7890</p>
            <p>Hours: Mon-Fri 9am-5pm</p>
          </div>
        </div>
        <div className="footer-bottom">
          <p>&copy; {new Date().getFullYear()} IT Helpdesk. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default PublicLayout;
