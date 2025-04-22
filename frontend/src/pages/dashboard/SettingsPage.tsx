// src/pages/dashboard/SettingsPage.tsx
// ==========================================================================
// Component representing the application settings page (Admin only).
// Fetches current settings and renders the SettingsForm.
// ==========================================================================

import React, { useState, useEffect } from 'react';
import SettingsForm from '../../components/forms/SettingsForm'; // The settings form component
import Loader from '../../components/common/Loader'; // Loader component
import Alert from '../../components/common/Alert'; // Alert component
import { useAuth } from '../../hooks/useAuth'; // Auth hook for role check
// import { fetchSettings } from '../../services/settingsService'; // Example API service

// --- Types --- (Should match types used in SettingsForm)
interface NotificationSettings {
  emailOnNewTicket: boolean; emailOnAssignment: boolean; emailOnUpdate: boolean;
}
interface TicketSettings {
  defaultUrgency: 'Low' | 'Medium' | 'High'; allowPublicSubmission: boolean; issueTypes: string[];
}
interface AppSettings {
  notifications: NotificationSettings; tickets: TicketSettings;
}

// --- Mock Data (Replace with API call) ---
const MOCK_INITIAL_SETTINGS: AppSettings = {
    notifications: { emailOnNewTicket: true, emailOnAssignment: true, emailOnUpdate: false },
    tickets: { defaultUrgency: 'Medium', allowPublicSubmission: true, issueTypes: ['Bug Report', 'Feature Request', 'General Inquiry'] }
};

// --- Component ---

/**
 * Renders the application settings page.
 * Handles fetching settings data and displays the SettingsForm.
 * Includes role-based access control.
 */
const SettingsPage: React.FC = () => {
  // --- Hooks ---
  const { user, loading: authLoading } = useAuth(); // Get user for role check

  // --- State ---
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false); // For feedback after save

  // --- Data Fetching ---
  useEffect(() => {
    // Only fetch settings if the user is an Admin
    if (user?.role === 'Admin') {
      const loadSettings = async () => {
        setIsLoading(true);
        setError(null);
        setSaveSuccess(false); // Reset success message on load
        try {
          // Replace with actual API call: const fetchedSettings = await fetchSettings();
          await new Promise(resolve => setTimeout(resolve, 400)); // Simulate loading
          setSettings(MOCK_INITIAL_SETTINGS);
        } catch (err: any) {
          console.error("Failed to load application settings:", err);
          setError(err.message || 'Could not load settings.');
        } finally {
          setIsLoading(false);
        }
      };
      loadSettings();
    } else if (!authLoading) {
        // If auth is loaded but user is not Admin
        setIsLoading(false);
        setError("Access Denied: You do not have permission to view settings.");
    }
  }, [user, authLoading]); // Re-run if user or auth loading state changes

  // --- Handlers ---
  /**
   * Callback function triggered when the SettingsForm successfully saves.
   * @param savedSettings - The updated settings object from the form/API.
   */
  const handleSaveSuccess = (savedSettings: AppSettings) => {
    console.log("Settings updated successfully in parent:", savedSettings);
    setSettings(savedSettings); // Update local state to reflect saved data
    setSaveSuccess(true);
    // Optional: Clear success message after a delay
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  // --- Render Logic ---
  // Show loader during initial auth check or settings fetch
  if (authLoading || isLoading) {
    return <Loader text="Loading settings..." />;
  }

  // Show error message if fetching failed or access denied
  if (error) {
    return <Alert type="error" title="Error" message={error} />;
  }

  // Show message if user is not an admin (should ideally be caught by routing)
  if (user?.role !== 'Admin') {
        return <Alert type="warning" title="Access Denied" message="You do not have permission to access this page." />;
  }

  // Show message if settings data is missing after loading
  if (!settings) {
      return <Alert type="error" message="Could not load settings data." />;
  }


  // --- Render ---
  return (
    <div className="settings-page">
      {/* Page Header */}
      <div className="page-header">
        <h1>Application Settings</h1>
      </div>

        {/* Optional: Display success message after save */}
        {saveSuccess && (
          <Alert type="success" message="Settings saved successfully!" className="mb-4" />
        )}

      {/* Settings Form Container */}
      <div className="settings-container">
        <SettingsForm
          initialSettings={settings}
          onSaveSuccess={handleSaveSuccess}
        />
      </div>
    </div>
  );
};

export default SettingsPage;
