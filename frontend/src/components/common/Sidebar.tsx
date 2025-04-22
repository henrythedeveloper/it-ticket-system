// src/components/common/Sidebar.tsx
// ==========================================================================
// Reusable Sidebar component for main application navigation.
// Uses context for state and displays navigation links.
// ==========================================================================

import React from 'react';
import { NavLink } from 'react-router-dom'; // Use NavLink for active styling
import { useSidebar } from '../../hooks/useSidebar'; // Sidebar context hook
import { useAuth } from '../../hooks/useAuth'; // Auth context hook
import { LayoutDashboard, Ticket, CheckSquare, Users, Settings } from 'lucide-react'; // Icons

// --- Component Props ---

/**
 * Props for the Sidebar component.
 */
interface SidebarProps {
    /** Optional CSS class name for custom styling. */
    className?: string;
}

// --- Navigation Link Type ---
interface NavItem {
    path: string;
    label: string;
    icon: React.ReactElement;
    requiredRole?: ('Admin' | 'Staff')[]; // Optional roles required to see the link
}

// --- Component ---

/**
 * Renders the main collapsible sidebar navigation menu.
 * Displays links based on user role.
 * Uses `useSidebar` hook to determine if it's open or closed.
 *
 * @param {SidebarProps} props - The component props.
 * @returns {React.ReactElement} The rendered Sidebar component.
 */
const Sidebar: React.FC<SidebarProps> = ({ className = '' }) => {
    // --- Hooks ---
    const { isOpen } = useSidebar(); // Get sidebar open state
    const { user } = useAuth(); // Get current user for role checks

    // --- Navigation Data ---
    // Define navigation items with paths, labels, icons, and optional role restrictions
    const navItems: NavItem[] = [
    { path: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
    { path: '/tickets', label: 'Tickets', icon: <Ticket size={20} /> },
    { path: '/tasks', label: 'Tasks', icon: <CheckSquare size={20} />, requiredRole: ['Admin', 'Staff'] }, // Example: Staff/Admin only
    { path: '/users', label: 'Users', icon: <Users size={20} />, requiredRole: ['Admin'] }, // Example: Admin only
    { path: '/settings', label: 'Settings', icon: <Settings size={20} />, requiredRole: ['Admin'] }, // Example: Admin only
    ];

    // --- Filtering Logic ---
    // Filter nav items based on the current user's role
    const filteredNavItems = navItems.filter(item => {
    // If no requiredRole is specified, show the item to everyone
    if (!item.requiredRole || item.requiredRole.length === 0) {
        return true;
    }
    // If user is not logged in, don't show role-restricted items
    if (!user) {
        return false;
    }
    // Show item if the user's role is included in the requiredRole array
    return item.requiredRole.includes(user.role);
    });


    // --- Render ---
    const sidebarClass = `sidebar ${isOpen ? 'open' : 'closed'} ${className}`;

    return (
    <aside className={sidebarClass}>
        <nav className="sidebar-nav">
        <ul>
            {filteredNavItems.map((item) => (
            <li key={item.path}>
                <NavLink
                to={item.path}
                className={({ isActive }) => (isActive ? 'active' : '')} // Apply 'active' class using NavLink prop
                title={item.label} // Tooltip, especially useful when collapsed
                >
                <span className="icon">{item.icon}</span>
                {/* Text label, hidden via CSS when sidebar is collapsed */}
                <span>{item.label}</span>
                </NavLink>
            </li>
            ))}
        </ul>
        </nav>
    </aside>
    );
};

export default Sidebar;
