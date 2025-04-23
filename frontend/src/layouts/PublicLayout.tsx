// src/layouts/PublicLayout.tsx
// ==========================================================================
// Layout component for public-facing pages (e.g., Home, FAQ, Create Ticket).
// Includes side navigation (desktop) / mobile overlay navigation and a footer.
// **REVISED: Added mobile navigation toggle (hamburger menu).**
// ==========================================================================

import React, { useState, useEffect } from 'react';
import { Outlet, Link, NavLink, useLocation } from 'react-router-dom'; // Renders nested routes & Links
import Footer from '../components/common/Footer'; // Common Footer component
import Button from '../components/common/Button'; // Common Button component
import { useAuth } from '../hooks/useAuth'; // Auth hook to show correct button
import { useTheme } from '../hooks/useTheme'; // Theme hook for toggle button
import { Home, HelpCircle, Send, LogIn, LayoutDashboard, Sun, Moon, Menu, X as CloseIcon } from 'lucide-react'; // Icons

// --- Component ---

/**
 * Renders the layout structure for public pages.
 * Includes a side navigation bar (desktop), mobile overlay navigation,
 * the main content area (<Outlet />), and a Footer.
 */
const PublicLayout: React.FC = () => {
    // --- Hooks ---
    const { isAuthenticated } = useAuth(); // Check if user is logged in
    const { theme, toggleTheme } = useTheme(); // Theme state and toggle
    const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
    const location = useLocation(); // To close nav on route change

    // --- Effects ---
    // Close mobile nav on route change
    useEffect(() => {
        setIsMobileNavOpen(false);
    }, [location.pathname]);

    // Prevent body scroll when mobile nav is open
    useEffect(() => {
        if (isMobileNavOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        // Cleanup function
        return () => {
            document.body.style.overflow = '';
        };
    }, [isMobileNavOpen]);


    // --- Handlers ---
    const toggleMobileNav = () => {
        setIsMobileNavOpen(!isMobileNavOpen);
    };

    // --- Render ---
    const navClasses = `side-nav ${isMobileNavOpen ? 'mobile-open' : ''}`;

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

        {/* Hamburger Menu Button (Mobile Only) */}
        <button
            className="mobile-nav-toggle"
            onClick={toggleMobileNav}
            aria-label={isMobileNavOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={isMobileNavOpen}
        >
            {isMobileNavOpen ? <CloseIcon size={24} /> : <Menu size={24} />}
        </button>

      {/* Side Navigation (Desktop) / Overlay Navigation (Mobile) */}
      <nav className={navClasses}>
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

        {/* Optional: Overlay for closing mobile nav */}
        {isMobileNavOpen && <div className="mobile-nav-overlay" onClick={toggleMobileNav}></div>}

      {/* Container for Content + Footer */}
      <div className="content-footer-wrapper">
        {/* Main Content Area - Nested routes render here */}
        <main className="public-content">
          <Outlet />
        </main>

        {/* Footer */}
        <Footer /> {/* Footer is now inside the wrapper */}
      </div>
    </div>
  );
};

export default PublicLayout;
