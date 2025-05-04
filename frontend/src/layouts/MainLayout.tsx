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
import { TicketProvider } from '../context/TicketContext'; // Context provider for tickets

// --- Component ---

/**
 * Renders the main layout structure for authenticated sections of the application.
 * Includes the Header, Sidebar, Footer, and uses <Outlet /> to render the specific page component.
 * Provides TicketContext to all child components.
 */
const MainLayout: React.FC = () => {
  // --- Render ---
  return (
    <div className="main-layout">
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

        {/* Application Footer */}
        <Footer />
      </TicketProvider>
    </div>
  );
};

export default MainLayout;
