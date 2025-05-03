// src/pages/public/CreateTicketPage.tsx
// ==========================================================================
// Component representing the public page for creating a new support ticket.
// Displays the TicketForm component.
// **REVISED**: Fetch available tags from API instead of using mock data.
// ==========================================================================

import React, { useState, useEffect } from 'react';
import Button from '../../components/common/Button';
import { Link } from 'react-router-dom';
import TicketForm from '../../components/forms/TicketForm'; // The actual form component
import Loader from '../../components/common/Loader'; // Reusable Loader
import Alert from '../../components/common/Alert'; // Reusable Alert
import { AppSettings, Tag } from '../../types'; // Import AppSettings and Tag types
import { fetchTags } from '../../services/tagService'; // Import fetchTags

// --- Mock Settings Data (Replace with API call for settings if needed) ---
const MOCK_SETTINGS: AppSettings = {
    notifications: { emailOnNewTicket: true, emailOnAssignment: true, emailOnUpdate: false },
    tickets: {
        allowPublicSubmission: true,
        defaultUrgency: 'Medium',
        issueTypes: ['General Inquiry', 'Bug Report', 'Feature Request', 'Password Reset', 'Hardware Issue'],
    }
};

// --- Component ---

/**
 * Renders the page for public ticket submission.
 * Fetches necessary settings and available tags, then displays the TicketForm.
 * Handles the success state after submission.
 */
const CreateTicketPage: React.FC = () => {
  // --- State ---
  const [settings, setSettings] = useState<AppSettings | null>(null);
  // State to hold fetched Tag objects
  const [availableTags, setAvailableTags] = useState<Tag[]>([]); // Changed type to Tag[]
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [submittedTicketNumber, setSubmittedTicketNumber] = useState<number | null>(null);

  // --- Data Fetching ---
  useEffect(() => {
    const loadPageData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // Simulate fetching settings (replace with actual API call if needed)
        await new Promise(resolve => setTimeout(resolve, 100)); // Short delay for settings
        const fetchedSettings = MOCK_SETTINGS; // Using mock settings for now

        // Fetch available tags from the API
        const fetchedTags = await fetchTags(); // Call the service function

        // Basic validation for settings
        if (!fetchedSettings.tickets.allowPublicSubmission) {
            throw new Error("Public ticket submission is currently disabled.");
        }
        setSettings(fetchedSettings);
        setAvailableTags(fetchedTags); // Store the fetched Tag objects

      } catch (err: any) {
        console.error("Failed to load data for ticket creation:", err);
        setError(err.message || 'Could not load ticket submission form.');
        setAvailableTags([]); // Ensure tags are empty on error
      } finally {
        setIsLoading(false);
      }
    };
    loadPageData();
  }, []); // Fetch on initial mount

  // --- Handlers ---
  const handleSuccess = (newTicketNumber: number) => {
    console.log("[CreateTicketPage] handleSuccess called with Number:", newTicketNumber);
    if (newTicketNumber > 0) {
        setSubmittedTicketNumber(newTicketNumber);
        window.scrollTo(0, 0);
    } else {
        console.error("[CreateTicketPage] Received invalid ticket number:", newTicketNumber);
        setError("Ticket submitted, but failed to retrieve ticket number.");
        setSubmittedTicketNumber(null);
    }
  };

  const handleSubmitAnother = () => {
      setSubmittedTicketNumber(null);
  };

  // --- Render ---
  return (
    <div className="create-ticket-page">
      {/* --- Loading State --- */}
      {isLoading && <Loader text="Loading form..." />}

      {/* --- Error State --- */}
      {(error && !isLoading) && (
        <Alert type="error" title="Error" message={error} className="mt-6" />
      )}

      {/* --- Main Content (Form or Success Message) --- */}
      {!isLoading && !error && settings?.tickets && (
        <>
          {submittedTicketNumber ? (
            <div className="success-message">
              <h2>Ticket Submitted Successfully!</h2>
              <p>
                Your ticket has been received. Your Ticket Number is{' '}
                <strong>#{submittedTicketNumber}</strong>.
              </p>
              <p>
                You should receive an email confirmation shortly. Please refer to your Ticket Number
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
                issueTypes={settings.tickets.issueTypes}
                // Pass the array of Tag objects to the form
                // The form component will need to extract the 'name' for display/value
                availableTags={availableTags.map(tag => tag.name)} // Pass only names if TicketForm expects string[]
                // OR if TicketForm is updated to handle Tag[]:
                // availableTags={availableTags}
              />
            </>
          )}
        </>
      )}
    </div>
  );
};

export default CreateTicketPage;
