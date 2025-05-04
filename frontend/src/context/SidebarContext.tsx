// src/context/SidebarContext.tsx
// ==========================================================================
// Provides sidebar state (isOpen) and control functions via React Context,
// using the Zustand sidebar store for state management.
// ==========================================================================

import React, { createContext, ReactNode } from 'react';
import { useSidebarStore } from '../store/sidebarStore'; // Zustand store
import { SidebarContextType } from '../types'; // Shared types

// --- Create Context ---
/**
 * React Context for sidebar state.
 * Initial value is undefined to detect usage outside the provider.
 */
export const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

// --- Context Provider Component ---

/**
 * Props for the SidebarProvider component.
 */
interface SidebarProviderProps {
    children: ReactNode;
}

/**
 * Provides sidebar state (`isOpen`) and control functions (`toggleSidebar`, `openSidebar`, `closeSidebar`)
 * to its children components via context. It uses the `useSidebarStore` (Zustand)
 * for the actual state logic.
 */
export const SidebarProvider: React.FC<SidebarProviderProps> = ({ children }) => {
    // --- State & Actions from Store ---
    // Get state and actions directly from the Zustand store hook
    const { isOpen, toggleSidebar, openSidebar, closeSidebar } = useSidebarStore();

    // --- Context Value ---
    // The value provided includes the state and the actions from the store
    const contextValue: SidebarContextType = {
    isOpen,
    toggleSidebar,
    openSidebar,
    closeSidebar,
    };

    // --- Render ---
    return (
    <SidebarContext.Provider value={contextValue}>
        {children}
    </SidebarContext.Provider>
    );
};
