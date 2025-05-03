// src/components/layouts/MainLayout.tsx
// ==========================================================================
// Main application layout component for authenticated users.
// Includes Header, Sidebar, Footer, and the main content area for nested routes.
// Provides TicketContext to all child components.
// ==========================================================================

import React from 'react';
import { Outlet } from 'react-router-dom'; // Renders nested routes
import Header from '../components/common/Header'; // Application header
import Sidebar from '../components/common/Sidebar'; // Application sidebar
import Footer from '../components/common/Footer'; // Application footer
import { useAuth } from '../hooks/useAuth'; // Hook to get user authentication state
import { useSidebar } from '../hooks/useSidebar'; // Hook to get sidebar state
import { TicketProvider } from '../context/TicketContext'; // Context provider for tickets

// --- Component ---

/**
 * Renders the main layout structure for authenticated sections of the application.
 * Includes the Header, Sidebar, Footer, and uses <Outlet /> to render the specific page component.
 * Provides TicketContext to all child components.
 */
const MainLayout: React.FC = () => {
  // --- Hooks ---
  const { user } = useAuth(); // Get user authentication state
  const { isOpen } = useSidebar(); // Get sidebar state for applying class

  // --- Render ---
  // Dynamically apply class based on sidebar state for layout adjustments via CSS
  const layoutClass = `main-layout ${isOpen ? 'sidebar-open' : 'sidebar-closed'}`;

  return (
    <div className={layoutClass}>
      <TicketProvider>
        {/* Application Header */}
        <Header />

        {/* Main Container */}
        <div className="main-container">
          {/* Application Sidebar */}
          <Sidebar />

          {/* Main Content Area - Nested routes render here */}
          <main className="main-content">
            <Outlet />
          </main>
        </div>

        {/* Application Footer - moved back outside main-container */}
        <Footer />
      </TicketProvider>
    </div>
  );
};

export default MainLayout;
