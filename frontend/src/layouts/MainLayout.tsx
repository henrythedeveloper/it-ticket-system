// src/components/layouts/MainLayout.tsx
// ==========================================================================
// Main application layout component for authenticated users.
// Includes Header, Sidebar, and the main content area for nested routes.
// ==========================================================================

import React from 'react';
import { Outlet } from 'react-router-dom'; // Renders nested routes
import Header from '../components/common/Header'; // Application header
import Sidebar from '../components/common/Sidebar'; // Application sidebar
import { useSidebar } from '../hooks/useSidebar'; // Hook to get sidebar state

// --- Component ---

/**
 * Renders the main layout structure for authenticated sections of the application.
 * Includes the Header, Sidebar, and uses <Outlet /> to render the specific page component.
 */
const MainLayout: React.FC = () => {
  // --- Hooks ---
  const { isOpen } = useSidebar(); // Get sidebar state for applying class

  // --- Render ---
  // Dynamically apply class based on sidebar state for layout adjustments via CSS
  const layoutClass = `main-layout ${isOpen ? 'sidebar-open' : 'sidebar-closed'}`;

  return (
    <div className={layoutClass}>
      {/* Application Header */}
      <Header />

      {/* Application Sidebar */}
      <Sidebar />

      {/* Main Content Area - Nested routes render here */}
      <main className="main-content">
        <Outlet />
      </main>

      {/* Optional: Main application footer could go here if needed */}
      {/* <Footer /> */}
    </div>
  );
};

export default MainLayout;
