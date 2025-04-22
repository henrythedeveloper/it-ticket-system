// src/components/layouts/PublicLayout.tsx
// ==========================================================================
// Layout component for public-facing pages (e.g., Home, FAQ, Create Ticket).
// Includes side navigation and a footer.
// ==========================================================================

import React from 'react';
import { Outlet, Link, NavLink } from 'react-router-dom'; // Renders nested routes & Links
import Footer from '../common/Footer'; // Common Footer component
import Button from '../common/Button'; // Common Button component
import { useAuth } from '../../hooks/useAuth'; // Auth hook to show correct button
import { useTheme } from '../../hooks/useTheme'; // Theme hook for toggle button
import { Home, HelpCircle, Send, LogIn, LayoutDashboard, Sun, Moon } from 'lucide-react'; // Icons

// --- Component ---

/**
 * Renders the layout structure for public pages.
 * Includes a side navigation bar, the main content area (<Outlet />), and a Footer.
 */
const PublicLayout: React.FC = () => {
    // --- Hooks ---
    const { isAuthenticated } = useAuth(); // Check if user is logged in
    const { theme, toggleTheme } = useTheme(); // Theme state and toggle

  // --- Render ---
  // Assumes SCSS file (_PublicLayout.scss) defines the layout styles
  return (
    <div className="public-layout">
        {/* Sticky Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          className="theme-toggle-sticky" // Styled in _PublicLayout.scss
          aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
        >
          {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
        </button>

      {/* Side Navigation */}
      <nav className="side-nav">
        {/* Logo */}
        <div className="logo-container">
          <Link to="/" className="logo">
            HelpDesk
          </Link>
        </div>

        {/* Navigation Links */}
        <ul className="nav-links">
          <li>
            <NavLink to="/" end> {/* `end` prop ensures exact match for root */}
              <Home size={20} className="icon" /> Home
            </NavLink>
          </li>
          <li>
            <NavLink to="/faq">
                <HelpCircle size={20} className="icon" /> FAQ
            </NavLink>
          </li>
          <li>
            <NavLink to="/create-ticket">
                <Send size={20} className="icon" /> Submit Ticket
            </NavLink>
          </li>
          {/* Add other public links as needed */}
        </ul>

        {/* Authentication Buttons */}
        <div className="auth-buttons">
          {isAuthenticated ? (
            <Link to="/dashboard">
              <Button variant="primary" className="dashboard-btn" leftIcon={<LayoutDashboard size={18} />}>
                Dashboard
              </Button>
            </Link>
          ) : (
            <Link to="/login">
              <Button variant="primary" className="login-btn" leftIcon={<LogIn size={18} />}>
                Agent Login
              </Button>
            </Link>
          )}
        </div>
      </nav>

      {/* Main Content Area - Nested routes render here */}
      <main className="public-content">
        <Outlet />
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
};

export default PublicLayout;
