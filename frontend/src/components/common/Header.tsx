// src/components/common/Header.tsx
// ==========================================================================
// Reusable Header component for the main application layout.
// Includes sidebar toggle, logo, theme toggle, and user dropdown.
// ==========================================================================

import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth'; // Auth context hook
import { useTheme } from '../../hooks/useTheme'; // Theme context hook
import { useSidebar } from '../../hooks/useSidebar'; // Sidebar context hook
import Dropdown from './Dropdown'; // Dropdown component
import { Sun, Moon, Menu, LogOut, User as UserIcon, Settings } from 'lucide-react'; // Icons

// --- Component Props ---

/**
 * Props for the Header component.
 */
interface HeaderProps {
    /** Optional CSS class name for custom styling. */
    className?: string;
}

// --- Component ---

/**
 * Renders the main application header bar.
 * Includes sidebar toggle, logo, theme switch, user info, and logout dropdown.
 * Uses context hooks for state management (auth, theme, sidebar).
 *
 * @param {HeaderProps} props - The component props.
 * @returns {React.ReactElement} The rendered Header component.
 */
const Header: React.FC<HeaderProps> = ({ className = '' }) => {
    // --- Hooks ---
    const { user, logout } = useAuth(); // Get user info and logout function
    const { theme, toggleTheme } = useTheme(); // Get theme state and toggle function
    const { toggleSidebar } = useSidebar(); // Get sidebar toggle function
    const navigate = useNavigate(); // Hook for programmatic navigation

    // --- Event Handlers ---
    /**
     * Handles the logout action.
     */
    const handleLogout = () => {
    logout();
    navigate('/login'); // Redirect to login page after logout
    };

    // --- Render ---
    const headerClass = `header ${className}`;

    return (
    <header className={headerClass}>
        {/* Left side: Sidebar Toggle and Logo */}
        <div className="header-left">
        <button
            onClick={toggleSidebar}
            className="sidebar-toggle"
            aria-label="Toggle sidebar"
        >
            {/* Simple hamburger icon using spans */}
            <span></span>
            <span></span>
            <span></span>
            {/* Or use an icon library: <Menu size={24} /> */}
        </button>
        <Link to="/dashboard" className="logo">
            HelpDesk
        </Link>
        </div>

        {/* Right side: Theme Toggle, User Info, Dropdown */}
        <div className="header-right">
        {/* Theme Toggle Button */}
        <button
            onClick={toggleTheme}
            className="theme-toggle-header"
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
        >
            {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
        </button>

        {/* User Info and Dropdown */}
        {user && (
            <Dropdown
            position="right"
            trigger={
                <div className="user-info-trigger" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                    {/* User Info Text (optional, can be hidden on small screens) */}
                    <div className="user-info">
                        <span className="user-name">{user.name}</span>
                        <span className="user-role">{user.role}</span>
                    </div>
                    {/* User Avatar/Icon as trigger */}
                    <div className="avatar-placeholder" style={{ marginLeft: '8px', background: 'var(--primary-color)', color: 'var(--text-inverted)', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                        {user.name.charAt(0).toUpperCase()} {/* Simple initial */}
                    </div>
                </div>
            }
            >
            {/* Dropdown Menu Content */}
            <Link to="/profile">
                <UserIcon size={16} style={{ marginRight: '8px' }}/> Profile
            </Link>
            <Link to="/settings">
                <Settings size={16} style={{ marginRight: '8px' }}/> Settings
            </Link>
            <button onClick={handleLogout}>
                <LogOut size={16} style={{ marginRight: '8px' }}/> Logout
            </button>
            </Dropdown>
        )}
        </div>
    </header>
    );
};

export default Header;
