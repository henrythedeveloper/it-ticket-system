// src/store/sidebarStore.ts
// ==========================================================================
// Zustand store for managing the collapsible sidebar state.
// ==========================================================================

import { create } from 'zustand';

// --- Store State and Actions Interface ---

/**
 * Defines the shape of the sidebar store, including state and actions.
 */
interface SidebarStore {
    isOpen: boolean;
    toggleSidebar: () => void;
    openSidebar: () => void;
    closeSidebar: () => void;
    setSidebarState: (isOpen: boolean) => void; // Action to directly set state
}

// --- Store Implementation ---

/**
 * Zustand store for sidebar state.
 * - Manages `isOpen` state (boolean).
 * - Provides `toggleSidebar`, `openSidebar`, `closeSidebar`, `setSidebarState` actions.
 */
export const useSidebarStore = create<SidebarStore>((set) => ({
    // --- Initial State ---
    isOpen: true, // Default to open sidebar

    // --- Actions ---
    /**
     * Toggles the sidebar's open/closed state.
     */
    toggleSidebar: () => set((state) => ({ isOpen: !state.isOpen })),

    /**
     * Explicitly opens the sidebar.
     */
    openSidebar: () => set({ isOpen: true }),

    /**
     * Explicitly closes the sidebar.
     */
    closeSidebar: () => set({ isOpen: false }),

    /**
     * Directly sets the sidebar state.
     * @param isOpen - The desired boolean state for the sidebar.
     */
    setSidebarState: (isOpen: boolean) => set({ isOpen }),
}));
