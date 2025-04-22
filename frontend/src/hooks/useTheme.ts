// src/hooks/useTheme.ts
// ==========================================================================
// Custom hook to access theme context.
// Provides easy access to the current theme and the toggle function.
// ==========================================================================

import { useContext } from 'react';
import { ThemeContext } from '../context/ThemeContext';
import { ThemeContextType } from '../types'; 

/**
 * Custom hook `useTheme`
 *
 * Provides access to the theme context (`ThemeContext`).
 * It ensures that the hook is used within a component wrapped by `ThemeProvider`.
 *
 * @returns {ThemeContextType} The theme context value, including:
 * - `theme`: The current theme ('light' or 'dark').
 * - `toggleTheme`: Function to switch between light and dark themes.
 *
 * @throws {Error} If used outside of a `ThemeProvider`.
 */
export const useTheme = (): ThemeContextType => {
  // Get the context value
  const context = useContext(ThemeContext);

  // Ensure the context exists
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }

  // Return the context value
  return context;
};
