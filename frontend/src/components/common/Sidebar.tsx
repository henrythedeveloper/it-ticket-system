// src/components/common/Sidebar.tsx
// ==========================================================================
// Reusable Sidebar component for main application navigation.
// Uses context for state and displays navigation links.
// **SIMPLIFIED**: Removed tasks-related navigation item.
// ==========================================================================

import React from 'react';
import { NavLink } from 'react-router-dom'; // Use NavLink for active styling
import { useSidebar } from '../../hooks/useSidebar'; // Sidebar context hook
import { useAuth } from '../../hooks/useAuth'; // Auth context hook
import { LayoutDashboard, Ticket, Users, Settings } from 'lucide-react'; // Icons

// --- Component Props ---

/**
 * Props for the Sidebar component.
 */
interface SidebarProps {
    /** Optional CSS class name for custom styling. */
    className?: string;
}

// --- Navigation Link Type ---
/**
 * Defines the structure for a navigation item in the sidebar.
 */
interface NavItem {
    /** The route path for the link. */
    path: string;
    /** The text label for the link. */
    label: string;
    /** The icon element to display next to the label. */
    icon: React.ReactElement;
    /** Optional array of roles allowed to see this link. If undefined or empty, visible to all authenticated users. */
    requiredRole?: ('Admin' | 'Staff')[]; // Only Admin or Staff can be explicitly required
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
    { path: '/users', label: 'Users', icon: <Users size={20} />, requiredRole: ['Admin'] }, // Example: Admin only
    { path: '/settings', label: 'Settings', icon: <Settings size={20} />, requiredRole: ['Admin'] }, // Example: Admin only
    ];

    // --- Filtering Logic ---
    // Filter nav items based on the current user's role
    const filteredNavItems = navItems.filter(item => {
    // If no requiredRole is specified, show the item to everyone logged in
    if (!item.requiredRole || item.requiredRole.length === 0) {
        return true; // Assumes sidebar is only shown to authenticated users anyway
    }
    // If user is not logged in (shouldn't happen if protected route is used, but safe check)
    if (!user) {
        return false;
    }
    // FIX: Check if user's role is one of the valid types *before* calling includes
    // This satisfies TypeScript because we ensure user.role is 'Admin' or 'Staff'
    // before checking if it's included in an array of ('Admin' | 'Staff')[]
    if (user.role === 'Admin' || user.role === 'Staff') {
            return item.requiredRole.includes(user.role);
    }
    // If user role is 'User', they cannot match any requiredRole of 'Admin' or 'Staff'
    return false;
    });


    // --- Render ---
    const sidebarClass = `sidebar ${isOpen ? 'sidebar-open' : 'sidebar-closed'} ${className}`;

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
