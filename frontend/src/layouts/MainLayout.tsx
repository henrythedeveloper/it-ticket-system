// src/layouts/MainLayout.tsx
// ==========================================================================
// Main application layout component for authenticated users.
// Includes Header, Sidebar, Footer, and the main content area for nested routes.
// Provides TicketContext to all child components.
// REVISED: Added class to root based on sidebar state for SCSS targeting.
// ==========================================================================

import React from 'react';
import { Outlet } from 'react-router-dom'; // Renders nested routes
import Header from '../components/common/Header'; // Application header
import Sidebar from '../components/common/Sidebar'; // Application sidebar
import Footer from '../components/common/Footer'; // Application footer
import { TicketProvider } from '../context/TicketContext'; // Context provider for tickets
import { useSidebar } from '../hooks/useSidebar'; // Import useSidebar hook

// --- Component ---

/**
 * Renders the main layout structure for authenticated sections of the application.
 * Includes the Header, Sidebar, Footer, and uses <Outlet /> to render the specific page component.
 * Provides TicketContext to all child components.
 */
const MainLayout: React.FC = () => {
  const { isOpen } = useSidebar(); // Get sidebar state

  // Add class to the root based on sidebar state for SCSS targeting if needed
  // Note: The SCSS was updated to target .sidebar.sidebar-closed directly,
  // so this root class might not be strictly necessary anymore, but kept for flexibility.
  const layoutClass = `main-layout ${isOpen ? 'sidebar-open' : 'sidebar-closed'}`;

  return (
    // Apply dynamic class to the root layout div
    <div className={layoutClass}>
      <TicketProvider>
        {/* Header remains outside the container */}
        <Header />

        {/* Main Container: holds sidebar and content */}
        <div className="main-container">
          {/* Sidebar */}
          {/* Pass isOpen state as a class for SCSS targeting */}
          <Sidebar className={isOpen ? 'sidebar-open' : 'sidebar-closed'}/>

          {/* Main Content Area */}
          <main className="main-content">
            <Outlet />
          </main>
        </div>

        {/* Footer placed AFTER main-container so it's below the flex container */}
        {/* This ensures it's not part of the scrollable main-content */}
        <Footer />
      </TicketProvider>
    </div>
  );
};

export default MainLayout;
