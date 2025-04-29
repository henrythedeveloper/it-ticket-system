// src/layouts/PublicLayout.tsx
// ==========================================================================
// Layout component for public-facing pages (e.g., Home, FAQ, Create Ticket).
// Includes side navigation (desktop) / mobile overlay navigation and a footer.
// **REVISED**: Added mobile navigation toggle (hamburger menu).
// **REVISED AGAIN**: Added Logout button.
// ==========================================================================

import React, { useState, useEffect } from 'react';
import { Outlet, Link, NavLink, useLocation, useNavigate } from 'react-router-dom'; // Import useNavigate
import Footer from '../components/common/Footer';
import Button from '../components/common/Button';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { Home, HelpCircle, Send, LogIn, LogOut, LayoutDashboard, Sun, Moon, Menu, X as CloseIcon } from 'lucide-react'; // Added LogOut icon

// --- Component ---

/**
 * Renders the layout structure for public pages.
 * Includes a side navigation bar (desktop), mobile overlay navigation,
 * the main content area (<Outlet />), and a Footer.
 */
const PublicLayout: React.FC = () => {
    // --- Hooks ---
    const { isAuthenticated, logout } = useAuth(); // Get logout function
    const { theme, toggleTheme } = useTheme();
    const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
    const location = useLocation();
    const navigate = useNavigate(); // Hook for navigation

    // --- Effects ---
    useEffect(() => {
        setIsMobileNavOpen(false);
    }, [location.pathname]);

    useEffect(() => {
        if (isMobileNavOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isMobileNavOpen]);


    // --- Handlers ---
    const toggleMobileNav = () => {
        setIsMobileNavOpen(!isMobileNavOpen);
    };

    const handleLogout = () => {
        logout(); // Call the logout function from context
        navigate('/'); // Redirect to homepage after logout
        setIsMobileNavOpen(false); // Close mobile nav if open
    };

    // --- Render ---
    const navClasses = `side-nav ${isMobileNavOpen ? 'mobile-open' : ''}`;

  return (
    <div className="public-layout">
        {/* Sticky Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          className="theme-toggle-sticky"
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
            <NavLink to="/" end>
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
        </ul>

        {/* Authentication Buttons */}
        <div className="auth-buttons">
          {isAuthenticated ? (
            <> {/* Use Fragment to group buttons */}
                <Link to="/dashboard">
                <Button variant="primary" className="dashboard-btn" leftIcon={<LayoutDashboard size={18} />}>
                    Dashboard
                </Button>
                </Link>
                {/* Logout Button - Shown only when authenticated */}
                <Button variant="outline" onClick={handleLogout} className="logout-btn" leftIcon={<LogOut size={18} />}>
                    Logout
                </Button>
            </>
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
        <Footer />
      </div>
    </div>
  );
};

export default PublicLayout;
