// src/pages/public/CreateTicketPage.tsx
// ==========================================================================
// Component representing the public page for creating a new support ticket.
// Displays the TicketForm component.
// FIX: Display ticket number instead of ID on success.
// ==========================================================================

import React, { useState, useEffect } from 'react';
import Button from '../../components/common/Button';
import { Link } from 'react-router-dom';
import TicketForm from '../../components/forms/TicketForm'; // The actual form component
import Loader from '../../components/common/Loader'; // Reusable Loader
import Alert from '../../components/common/Alert'; // Reusable Alert
import { AppSettings } from '../../types'; // Import AppSettings type

// --- Mock Settings Data (Replace with API call) ---
// interface PublicSettings { // Replaced with AppSettings for consistency
//     allowPublicSubmission: boolean;
//     issueTypes: string[];
//     availableTags: string[];
// }

// Assuming settings fetched from backend match AppSettings structure
const MOCK_SETTINGS: AppSettings = {
    notifications: { emailOnNewTicket: true, emailOnAssignment: true, emailOnUpdate: false }, // Example data
    tickets: {
        allowPublicSubmission: true,
        defaultUrgency: 'Medium', // Example data
        issueTypes: ['General Inquiry', 'Bug Report', 'Feature Request', 'Password Reset', 'Hardware Issue'],
        // availableTags: ['urgent', 'billing', 'account', 'software', 'printer'], // Tags might come from a separate endpoint
    }
};

// --- Component ---

/**
 * Renders the page for public ticket submission.
 * Fetches necessary settings (like allowed issue types) and displays the TicketForm.
 * Handles the success state after submission.
 */
const CreateTicketPage: React.FC = () => {
  // --- State ---
  const [settings, setSettings] = useState<AppSettings | null>(null); // Use AppSettings type
  const [availableTags, setAvailableTags] = useState<string[]>([]); // State for tags, potentially fetched separately
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  // FIX: Change state variable name and type to store ticket number
  const [submittedTicketNumber, setSubmittedTicketNumber] = useState<number | null>(null);

  // --- Data Fetching ---
  useEffect(() => {
    const loadPageData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // TODO: Replace with actual API calls
        // Fetch settings (e.g., issue types, allow public submission)
        // const fetchedSettings = await fetchPublicSettings(); // Example
        await new Promise(resolve => setTimeout(resolve, 300)); // Simulate loading
        const fetchedSettings = MOCK_SETTINGS; // Using mock for now

        // Fetch available tags (might be separate endpoint)
        // const fetchedTags = await fetchAvailableTags(); // Example
        const fetchedTags = ['urgent', 'billing', 'account', 'software', 'printer']; // Using mock

        // Basic validation
        if (!fetchedSettings.tickets.allowPublicSubmission) {
            throw new Error("Public ticket submission is currently disabled.");
        }
        setSettings(fetchedSettings);
        setAvailableTags(fetchedTags);

      } catch (err: any) {
        console.error("Failed to load data for ticket creation:", err);
        setError(err.message || 'Could not load ticket submission form.');
      } finally {
        setIsLoading(false);
      }
    };
    loadPageData();
  }, []); // Fetch on initial mount

  // --- Handlers ---
  /**
   * Handles the successful submission of the ticket form.
   * Sets the submitted ticket number to display the success message.
   * @param newTicketNumber - The number of the newly created ticket.
   */
  // FIX: Update function signature and state setter
  const handleSuccess = (newTicketNumber: number) => {
    console.log("[CreateTicketPage] handleSuccess called with Number:", newTicketNumber);
    if (newTicketNumber > 0) { // Check if a valid number was received
        setSubmittedTicketNumber(newTicketNumber);
        window.scrollTo(0, 0);
    } else {
        // Handle the case where an invalid number (e.g., 0) was passed from the form
        console.error("[CreateTicketPage] Received invalid ticket number:", newTicketNumber);
        setError("Ticket submitted, but failed to retrieve ticket number.");
        setSubmittedTicketNumber(null); // Ensure success message isn't shown
    }
  };

  /**
   * Resets the state to allow submitting another ticket.
   */
  const handleSubmitAnother = () => {
      // FIX: Reset the correct state variable
      setSubmittedTicketNumber(null);
      // Optionally reset form state within TicketForm if needed,
      // but remounting/clearing might be handled by parent logic
  };

  // --- Render ---
  return (
    <div className="create-ticket-page">
      {/* --- Loading State --- */}
      {isLoading && <Loader text="Loading form..." />}

      {/* --- Error State --- */}
      {/* Display general errors OR the specific error from handleSuccess */}
      {(error && !isLoading) && (
        <Alert type="error" title="Error" message={error} className="mt-6" />
      )}

      {/* --- Main Content (Form or Success Message) --- */}
      {/* FIX: Check settings?.tickets before accessing its properties */}
      {!isLoading && !error && settings?.tickets && (
        <>
          {/* FIX: Check submittedTicketNumber state */}
          {submittedTicketNumber ? (
            <div className="success-message">
              <h2>Ticket Submitted Successfully!</h2>
              <p>
                Your ticket has been received. Your Ticket Number is{' '}
                {/* FIX: Display submittedTicketNumber */}
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
                // FIX: Pass correct properties from settings
                issueTypes={settings.tickets.issueTypes}
                availableTags={availableTags} // Pass fetched/mocked tags
              />
            </>
          )}
        </>
      )}
    </div>
  );
};

export default CreateTicketPage;
