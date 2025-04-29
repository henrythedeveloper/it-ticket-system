// src/context/ThemeContext.tsx
// ==========================================================================
// Provides theme state ('light' | 'dark') and toggle function via React Context,
// using the Zustand theme store for state management and persistence.
// Correctly applies/removes the 'dark-mode' class to the body.
// Refactored Zustand state selection.
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
    // Select state and actions individually from the store
    const theme = useThemeStore((state) => state.theme);
    const toggleTheme = useThemeStore((state) => state.toggleTheme);
    const initializeTheme = useThemeStore((state) => state.initializeTheme);

    // --- Effects ---
    // Initialize theme from localStorage or system preference on mount
    useEffect(() => {
        initializeTheme();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Run only once on initial mount

    // Apply/Remove the 'dark-mode' class to the body whenever the theme state changes
    useEffect(() => {
        const body = document.body;
        if (theme === 'dark') {
            body.classList.add('dark-mode');
            console.log('ThemeContext: Added dark-mode class.');
        } else {
            // Ensure 'dark-mode' is removed if theme is light
            body.classList.remove('dark-mode');
            console.log('ThemeContext: Removed dark-mode class.');
        }
        // Cleanup function to remove class if component unmounts (optional but good practice)
        return () => {
            body.classList.remove('dark-mode');
        };
    }, [theme]); // Re-run when theme changes

    // --- Context Value ---
    // Memoize context value if necessary, but likely okay here
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