// src/components/common/Header.tsx
// ==========================================================================
// Reusable Header component for the main application layout.
// Includes sidebar toggle, logo, theme toggle, notification bell, and user dropdown.
// **REVISED**: Added more defensive checks using optional chaining and
//              nullish coalescing when accessing user properties.
// **SIMPLIFIED**: Added notification bell for unassigned tickets.
// ==========================================================================

import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth'; // Auth context hook
import { useTheme } from '../../hooks/useTheme'; // Theme context hook
import { useSidebar } from '../../hooks/useSidebar'; // Sidebar context hook
import Dropdown from './Dropdown'; // Dropdown component
import NotificationBell from '../notifications/NotificationBell'; // Added notification bell
import { Sun, Moon, LogOut, User as UserIcon, Settings } from 'lucide-react'; // Icons

// --- Component Props ---
interface HeaderProps {
    className?: string;
}

// --- Component ---
const Header: React.FC<HeaderProps> = ({ className = '' }) => {
    // --- Hooks ---
    const { user, logout } = useAuth(); // Get user info and logout function
    const { theme, toggleTheme } = useTheme();
    const { toggleSidebar } = useSidebar();
    const navigate = useNavigate();

    // --- Event Handlers ---
    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    // --- Render ---
    const headerClass = `header ${className}`;

    // Get user details safely
    const userName = user?.name ?? 'User'; // Default to 'User' if name is null/undefined
    const userRole = user?.role ?? '';     // Default to empty string if role is null/undefined
    const userInitial = (userName !== 'User' && userName.length > 0) ? userName.charAt(0).toUpperCase() : '?'; // Get initial or '?'

    return (
        <header className={headerClass}>
            {/* Left side: Sidebar Toggle and Logo */}
            <div className="header-left">
                <button
                    onClick={toggleSidebar}
                    className="sidebar-toggle"
                    aria-label="Toggle sidebar"
                >
                    <span></span>
                    <span></span>
                    <span></span>
                </button>
                <Link to="/dashboard" className="logo">
                    HelpDesk
                </Link>
            </div>

            {/* Right side: Theme Toggle, Notifications, User Info, Dropdown */}
            <div className="header-right">
                {/* Theme Toggle Button */}
                <button
                    onClick={toggleTheme}
                    className="theme-toggle-header"
                    aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
                >
                    {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
                </button>

                {/* Notification Bell - Only visible to Admin and Staff roles */}
                {user && (user.role === 'Admin' || user.role === 'Staff') && (
                    <NotificationBell />
                )}

                {/* User Info and Dropdown - Render only if user object exists */}
                {user && ( // Still check if user object exists overall
                    <Dropdown
                        position="right"
                        trigger={
                            <div className="user-info-trigger" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                                {/* Use the safely retrieved values */}
                                <div className="user-info">
                                    <span className="user-name">{userName}</span>
                                    <span className="user-role">{userRole}</span>
                                </div>
                                {/* Use the safely retrieved initial */}
                                <div className="avatar-placeholder" style={{ marginLeft: '8px', background: 'var(--primary-color)', color: 'var(--text-inverted)', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                                    {userInitial}
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
