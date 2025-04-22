// src/pages/public/CreateTicketPage.tsx
// ==========================================================================
// Component representing the public page for creating a new support ticket.
// Displays the TicketForm component.
// ==========================================================================

import React, { useState, useEffect } from 'react';
import Button from '../../components/common/Button';
import { Link } from 'react-router-dom';
import TicketForm from '../../components/forms/TicketForm'; // The actual form component
import Loader from '../../components/common/Loader'; // Reusable Loader
import Alert from '../../components/common/Alert'; // Reusable Alert
// import { fetchPublicSettings } from '../../services/settingsService'; // Example API call

// --- Mock Settings Data (Replace with API call) ---
interface PublicSettings {
    allowPublicSubmission: boolean;
    issueTypes: string[];
    availableTags: string[];
}

const MOCK_SETTINGS: PublicSettings = {
    allowPublicSubmission: true,
    issueTypes: ['General Inquiry', 'Bug Report', 'Feature Request', 'Password Reset', 'Hardware Issue'],
    availableTags: ['urgent', 'billing', 'account', 'software', 'printer'],
};

// --- Component ---

/**
 * Renders the page for public ticket submission.
 * Fetches necessary settings (like allowed issue types) and displays the TicketForm.
 * Handles the success state after submission.
 */
const CreateTicketPage: React.FC = () => {
  // --- State ---
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [submittedTicketId, setSubmittedTicketId] = useState<string | null>(null); // Store ID after success

  // --- Data Fetching ---
  useEffect(() => {
    const loadSettings = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // Replace with actual API call: const fetchedSettings = await fetchPublicSettings();
        await new Promise(resolve => setTimeout(resolve, 300)); // Simulate loading
        // Basic validation if needed
        if (!MOCK_SETTINGS.allowPublicSubmission) {
            throw new Error("Public ticket submission is currently disabled.");
        }
        setSettings(MOCK_SETTINGS);
      } catch (err: any) {
        console.error("Failed to load settings for ticket creation:", err);
        setError(err.message || 'Could not load ticket submission form.');
      } finally {
        setIsLoading(false);
      }
    };
    loadSettings();
  }, []); // Fetch on initial mount

  // --- Handlers ---
  /**
   * Handles the successful submission of the ticket form.
   * Sets the submitted ticket ID to display the success message.
   * @param newTicketId - The ID of the newly created ticket.
   */
  const handleSuccess = (newTicketId: string) => {
    setSubmittedTicketId(newTicketId);
    window.scrollTo(0, 0); // Scroll to top to show success message
  };

  /**
   * Resets the state to allow submitting another ticket.
   */
  const handleSubmitAnother = () => {
      setSubmittedTicketId(null);
      // Optionally reset form state within TicketForm if needed,
      // but remounting/clearing might be handled by parent logic
  };

  // --- Render ---
  return (
    <div className="create-ticket-page">
      {/* --- Loading State --- */}
      {isLoading && <Loader text="Loading form..." />}

      {/* --- Error State --- */}
      {error && !isLoading && (
        <Alert type="error" title="Error" message={error} className="mt-6" />
      )}

      {/* --- Main Content (Form or Success Message) --- */}
      {!isLoading && !error && settings && (
        <>
          {/* Success Message */}
          {submittedTicketId ? (
            <div className="success-message">
              <h2>Ticket Submitted Successfully!</h2>
              <p>
                Your ticket has been received. Your Ticket ID is{' '}
                <strong>#{submittedTicketId}</strong>.
              </p>
              <p>
                You should receive an email confirmation shortly. Please refer to your Ticket ID
                if you need to contact support about this issue.
              </p>
              <Button onClick={handleSubmitAnother} className="new-ticket-btn">
                Submit Another Ticket
              </Button>
            </div>
          ) : (
            <>
              {/* Page Header (only show if form is visible) */}
              <div className="page-header">
                <h1>Submit a New Support Ticket</h1>
                <p>
                  Please fill out the form below with details about your issue.
                  We'll get back to you as soon as possible.
                </p>
              </div>
              {/* Ticket Form */}
              <TicketForm
                onSubmitSuccess={handleSuccess}
                issueTypes={settings.issueTypes}
                availableTags={settings.availableTags}
              />
            </>
          )}
        </>
      )}
    </div>
  );
};

export default CreateTicketPage;