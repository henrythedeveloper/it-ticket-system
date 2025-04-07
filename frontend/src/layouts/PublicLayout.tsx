import React from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import '../styles/layouts/PublicLayout.scss';

const PublicLayout: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const handleLoginClick = () => {
    navigate('/login');
  };

  const handleDashboardClick = () => {
    navigate('/dashboard');
  };

  return (
    <div className="public-layout">
      {/* Header */}
      <header className="public-header">
        <div className="logo-container">
          <Link to="/" className="logo">
            IT Helpdesk
          </Link>
        </div>
        <nav className="main-nav">
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
        </nav>
        <div className="auth-buttons">
          {isAuthenticated ? (
            <button className="dashboard-btn" onClick={handleDashboardClick}>
              Dashboard
            </button>
          ) : (
            <button className="login-btn" onClick={handleLoginClick}>
              Staff Login
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="public-content">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="public-footer">
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