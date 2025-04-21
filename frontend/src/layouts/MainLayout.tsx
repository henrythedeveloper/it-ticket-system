// src/layouts/MainLayout.tsx
import React, { useState } from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../hooks/useTheme'; // Import the theme hook

const MainLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme(); // Use the theme hook
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isAdmin = user?.role === 'Admin';

  return (
    <div className={`main-layout ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
      {/* Header */}
      <header className="header">
        <div className="header-left">
          <button className="sidebar-toggle" onClick={toggleSidebar}>
            <span></span>
            <span></span>
            <span></span>
          </button>
          <h1 className="logo">IT Helpdesk</h1>
        </div>
        <div className="header-right">
          {/* Theme Toggle Button - Placed before user info/dropdown */}
          <button
              onClick={toggleTheme}
              className="theme-toggle-header" // Keep specific class
              aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
              title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          >
              {theme === 'light' ? '🌙' : '☀️'}
          </button>

          {/* User Info */}
          <div className="user-info">
            <span className="user-name">{user?.name}</span>
            <span className="user-role">{user?.role}</span>
          </div>

          {/* Profile Dropdown */}
          <div className="dropdown">
             {/* Original profile icon button */}
            <button className="dropdown-toggle">
              <i className="icon">👤</i>
            </button>
            {/* Dropdown menu */}
            <div className="dropdown-menu">
              <Link to="/profile">Profile</Link>
              <Link to="/settings">Settings</Link>
              <button onClick={handleLogout}>Logout</button>
            </div>
          </div>
        </div>
      </header>

      {/* Sidebar */}
      <aside className={`sidebar ${isSidebarOpen ? 'open' : 'closed'}`}>
         <nav className="sidebar-nav">
          <ul>
            <li>
              <Link to="/dashboard">
                <i className="icon">📊</i>
                <span>Dashboard</span>
              </Link>
            </li>
            <li>
              <Link to="/tickets">
                <i className="icon">🎫</i>
                <span>Tickets</span>
              </Link>
            </li>
            <li>
              <Link to="/tasks">
                <i className="icon">📝</i>
                <span>Tasks</span>
              </Link>
            </li>
            {isAdmin && (
              <li>
                <Link to="/users">
                  <i className="icon">👥</i>
                  <span>Users</span>
                </Link>
              </li>
            )}
            <li>
              <Link to="/settings">
                <i className="icon">⚙️</i>
                <span>Settings</span>
              </Link>
            </li>
          </ul>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
};

export default MainLayout;
