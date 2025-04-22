// src/hooks/useSidebar.ts
// ==========================================================================
// Custom hook to access sidebar context.
// Provides easy access to sidebar state and control functions.
// ==========================================================================

import { useContext } from 'react';
import { SidebarContext } from '../context/SideBarContext'; // Adjust path if needed
import { SidebarContextType } from '../types'; // Adjust path if needed

/**
 * Custom hook `useSidebar`
 *
 * Provides access to the sidebar context (`SidebarContext`).
 * It ensures that the hook is used within a component wrapped by `SidebarProvider`.
 *
 * @returns {SidebarContextType} The sidebar context value, including:
 * - `isOpen`: Boolean indicating if the sidebar is currently open.
 * - `toggleSidebar`: Function to toggle the sidebar's open/closed state.
 * - `openSidebar`: Function to explicitly open the sidebar.
 * - `closeSidebar`: Function to explicitly close the sidebar.
 *
 * @throws {Error} If used outside of a `SidebarProvider`.
 */
export const useSidebar = (): SidebarContextType => {
    // Get the context value
    const context = useContext(SidebarContext);

    // Ensure the context exists
    if (context === undefined) {
    throw new Error('useSidebar must be used within a SidebarProvider');
    }

    // Return the context value
    return context;
};
