// src/App.tsx
// ==========================================================================
// Root application component. Sets up routing.
// ==========================================================================

import { BrowserRouter as Router } from 'react-router-dom';
import AppRouter from './router'; // Main application router configuration
import { useTheme } from './hooks/useTheme'; // Hook to manage theme changes
import { useEffect } from 'react';

/**
 * Root Application Component `App`
 *
 * - Sets up the main Router (`BrowserRouter`).
 * - Includes the application's routing logic (`AppRouter`).
 * - Applies the current theme class to the body element.
 */
function App() {
  // --- Hooks ---
  const { theme } = useTheme(); // Get current theme from context

  // --- Effects ---
  // Apply theme class to body when theme changes
  useEffect(() => {
    const body = document.body;
    // Remove previous theme class
    body.classList.remove('light-mode', 'dark-mode');
    // Add current theme class
    body.classList.add(`${theme}-mode`);
    // Optional: Set color scheme preference for browser UI elements
    // document.documentElement.style.setProperty('color-scheme', theme);
  }, [theme]); // Re-run effect when theme changes

  // --- Render ---
  return (
    // BrowserRouter provides routing capabilities
    <Router>
      {/* AppRouter defines the application's routes */}
      <AppRouter />
    </Router>
  );
}

export default App;
