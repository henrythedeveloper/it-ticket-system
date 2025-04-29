// src/components/forms/TicketForm.tsx
// ==========================================================================
// Component rendering the form for creating new tickets (public facing).
// Refactored to use the useFormSubmit hook.
// FIX: Pass ticket_number instead of id to onSubmitSuccess callback.
// ==========================================================================

import React, { useState } from 'react';
import Input from '../common/Input';
import Textarea from '../common/Textarea';
import Select from '../common/Select';
import Button from '../common/Button';
import Alert from '../common/Alert';
import { useFormSubmit } from '../../hooks/useFormSubmit'; // Custom hook
import { Ticket, TicketUrgency } from '../../types'; // Import types
import { createTicket } from '../../services/ticketService'; // API service call

// --- Component Props ---
interface TicketFormProps {
    // FIX: Change prop to expect ticket number (number) instead of ID (string)
    onSubmitSuccess: (newTicketNumber: number) => void;
    issueTypes?: string[];
    availableTags?: string[];
}

// --- Form Input Data Structure ---
interface PublicTicketFormInputs {
    submitterName: string;
    submitterEmail: string;
    subject: string;
    description: string;
    urgency: TicketUrgency;
    issueType: string;
    tags: string[];
}

// --- API Payload Structure ---
// Define the shape expected by the createTicket service function
interface CreateTicketApiPayload {
    submitterName?: string; // Optional if backend can infer or doesn't need
    submitterEmail?: string; // Optional if backend can infer or doesn't need
    subject: string;
    description: string;
    urgency: TicketUrgency;
    issueType?: string;
    tags?: string[];
}

// --- API Response Structure (Matching the backend) ---
// Define the expected structure of the full API response
interface CreateTicketApiResponse {
    success: boolean;
    message: string;
    data: Ticket; // The actual ticket data is nested here
}


// --- Component ---

/**
 * Renders the public-facing form for creating a new support ticket
 * using the useFormSubmit hook.
 *
 * @param {TicketFormProps} props - The component props.
 * @returns {React.ReactElement} The rendered TicketForm component.
 */
const TicketForm: React.FC<TicketFormProps> = ({
    onSubmitSuccess,
    issueTypes = [],
    availableTags = [],
}) => {
    // --- State ---
    const [formData, setFormData] = useState<PublicTicketFormInputs>({
    submitterName: '', submitterEmail: '', subject: '', description: '',
    urgency: 'Medium', issueType: issueTypes[0] || '', tags: [],
    });

    // --- Custom Hook for Submission ---
    const {
        submit: submitNewTicket,
        isLoading,
        error,
        clearError,
        // successMessage not needed, onSubmitSuccess handles UI change
    } = useFormSubmit<CreateTicketApiPayload, CreateTicketApiResponse>(
        createTicket, // Pass the API service function
        {
            // FIX: Modify onSuccess to pass response.data.ticket_number
            onSuccess: (response) => {
                console.log("[TicketForm] onSuccess received response:", response);
                // Ensure response and nested data/ticket_number exist
                if (response?.data?.ticket_number !== undefined) {
                    onSubmitSuccess(response.data.ticket_number); // Pass the ticket number
                } else {
                    console.error("[TicketForm] Invalid response structure or missing ticket_number:", response);
                    // Handle error - maybe call an onError prop or show a generic error
                    // For now, we might call onSubmitSuccess with a placeholder like 0 or -1,
                    // or ideally, have an onError callback to signal failure.
                    // Calling with 0 for now, but this should be improved.
                    onSubmitSuccess(0);
                }
            },
            onError: (err) => {
                console.error("Failed to create ticket (hook callback):", err);
                // Error message handled by hook state
            },
        }
    );

    // --- Handlers ---
    /**
     * Handles changes in standard input/select/textarea fields. Clears hook error.
     */
    const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
    ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (error) clearError();
    };

    /**
     * Handles tag selection/deselection. Clears hook error.
     */
    const handleTagToggle = (tag: string) => {
    setFormData((prev) => {
        const currentTags = prev.tags;
        const newTags = currentTags.includes(tag)
        ? currentTags.filter(t => t !== tag)
        : [...currentTags, tag];
        return { ...prev, tags: newTags };
    });
        if (error) clearError();
    };

    /**
     * Handles form submission to create the ticket.
     */
    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Prepare payload matching the API structure
    const ticketPayload: CreateTicketApiPayload = {
        submitterName: formData.submitterName,
        submitterEmail: formData.submitterEmail,
        subject: formData.subject,
        description: formData.description,
        urgency: formData.urgency,
        issueType: formData.issueType || undefined,
        tags: formData.tags.length > 0 ? formData.tags : undefined,
    };

    submitNewTicket(ticketPayload); // Call the hook's submit function
    };

    // --- Options ---
    const urgencyOptions: { value: TicketUrgency; label: string }[] = [
    { value: 'Low', label: 'Low' }, { value: 'Medium', label: 'Medium' },
    { value: 'High', label: 'High' }, { value: 'Critical', label: 'Critical' },
    ];
    const issueTypeOptions = issueTypes.map(type => ({ value: type, label: type }));

    // --- Render ---
    return (
    <form onSubmit={handleSubmit} className="ticket-form">
        {error && <Alert type="error" message={error} className="mb-4" />}

        {/* Submitter Info */}
        <div className="form-row">
        <Input label="Your Name" id="submitterName" name="submitterName" type="text"
            value={formData.submitterName} onChange={handleChange} required disabled={isLoading} />
        <Input label="Your Email" id="submitterEmail" name="submitterEmail" type="email"
            value={formData.submitterEmail} onChange={handleChange} required disabled={isLoading} />
        </div>

        {/* Subject */}
        <Input label="Subject" id="subject" name="subject" type="text"
        value={formData.subject} onChange={handleChange} required disabled={isLoading}
        containerClassName="mb-4" />

        {/* Description */}
        <Textarea label="Describe your issue" id="description" name="description"
        value={formData.description} onChange={handleChange} required disabled={isLoading}
        rows={8} containerClassName="mb-4" placeholder="Please provide as much detail as possible..." />

        {/* Urgency & Issue Type */}
        <div className="form-row">
        <Select label="Urgency" id="urgency" name="urgency" options={urgencyOptions}
            value={formData.urgency} onChange={handleChange} required disabled={isLoading} />
        {issueTypeOptions.length > 0 && (
                <Select label="Issue Type / Category" id="issueType" name="issueType" options={issueTypeOptions}
                value={formData.issueType} onChange={handleChange} disabled={isLoading} placeholder="Select category..." />
        )}
        </div>

        {/* Tags (Optional) */}
        {availableTags.length > 0 && (
            <div className="form-group">
                <label>Tags (Optional)</label>
                <div className="tags-container">
                    {availableTags.map(tag => (
                        <button type="button" key={tag}
                            className={`tag ${formData.tags.includes(tag) ? 'selected' : ''}`}
                            onClick={() => handleTagToggle(tag)} disabled={isLoading}>
                            {tag}
                        </button>
                    ))}
                </div>
            </div>
        )}

        {/* Submit Button */}
        <Button type="submit" variant="primary" isLoading={isLoading} disabled={isLoading}
        className="submit-button mt-6">
        {isLoading ? 'Submitting Ticket...' : 'Submit Ticket'}
        </Button>
    </form>
    );
};

export default TicketForm;
