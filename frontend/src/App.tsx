// src/App.tsx
// ==========================================================================
// Root application component. Sets up routing.
// ==========================================================================

import { BrowserRouter as Router } from 'react-router-dom';
// Correct the import path for AppRouter
import AppRouter from './components/router'; // Main application router configuration


/**
 * Root Application Component `App`
 *
 * - Sets up the main Router (`BrowserRouter`).
 * - Includes the application's routing logic (`AppRouter`).
 * - Theme class application is handled by ThemeProvider.
 */
function App() {
  // --- Hooks ---
  // Theme state is accessed where needed via useTheme(),
  // but the body class manipulation is handled within ThemeProvider.

  // --- Effects ---
  // The useEffect to apply theme class to body has been removed from here
  // and is correctly placed within ThemeProvider (ThemeContext.tsx).

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
