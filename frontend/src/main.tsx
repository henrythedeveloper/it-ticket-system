// src/main.tsx
// ==========================================================================
// Main application entry point.
// Renders the root component and sets up context providers.
// ==========================================================================

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthProvider } from './context/AuthContext'; // Adjust path
import { ThemeProvider } from './context/ThemeContext'; // Adjust path
import { SidebarProvider } from './context/SidebarContext'; // Adjust path
import './styles/global.scss'; // Import global styles

// --- Render Application ---
// Get the root element from the HTML
const rootElement = document.getElementById('root');

// Ensure the root element exists before rendering
if (!rootElement) {
  throw new Error("Failed to find the root element with ID 'root'");
}

// Create a React root
const root = ReactDOM.createRoot(rootElement);

// Render the application within StrictMode and context providers
root.render(
  <React.StrictMode>
    {/* ThemeProvider manages light/dark mode */}
    <ThemeProvider>
      {/* AuthProvider manages user authentication state */}
      <AuthProvider>
        {/* SidebarProvider manages the collapsible sidebar state */}
        <SidebarProvider>
          {/* Main App component */}
          <App />
        </SidebarProvider>
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>
);
