// src/context/ThemeContext.tsx
// ==========================================================================
// Provides theme state ('light' | 'dark') and toggle function via React Context,
// using the Zustand theme store for state management and persistence.
// ==========================================================================

import React, { createContext, ReactNode, useEffect } from 'react';
import { useThemeStore } from '../store/themeStore'; // Zustand store
import { ThemeContextType } from '../types'; // Shared types

// --- Create Context ---
/**
 * React Context for theme state.
 * Initial value is undefined to detect usage outside the provider.
 */
export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// --- Context Provider Component ---

/**
 * Props for the ThemeProvider component.
 */
interface ThemeProviderProps {
    children: ReactNode;
}

/**
 * Provides theme state (`theme`) and the `toggleTheme` function to its children components
 * via context. It uses the `useThemeStore` (Zustand) for state logic and persistence.
 * It also applies the theme class to the document body initially and on changes.
 */
export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
    // --- State & Actions from Store ---
    const { theme, toggleTheme, initializeTheme } = useThemeStore();

    // --- Effects ---
    // Initialize theme from localStorage or system preference on mount
    useEffect(() => {
    initializeTheme();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Run only once on initial mount

    // Apply the theme class to the body whenever the theme state changes
    // NOTE: This logic might be duplicated in App.tsx. Consider having it in one place.
    // If App.tsx handles it, this useEffect can be removed. If kept here, remove from App.tsx.
    useEffect(() => {
    const body = document.body;
    body.classList.remove('light-mode', 'dark-mode');
    body.classList.add(`${theme}-mode`);
    console.log(`ThemeContext: Applied ${theme}-mode class.`);
    }, [theme]); // Re-run when theme changes

    // --- Context Value ---
    const contextValue: ThemeContextType = {
    theme,
    toggleTheme,
    };

    // --- Render ---
    return (
    <ThemeContext.Provider value={contextValue}>
        {children}
    </ThemeContext.Provider>
    );
};
