// src/components/forms/TicketStatusForm.tsx
// ==========================================================================
// Component rendering the form for updating a ticket's status and assignee.
// Often used within a modal or sidebar on the Ticket Detail page.
// Refactored to use the useFormSubmit hook.
// Simplified to use Open/In Progress/Closed status model.
// ==========================================================================

import React, { useState, useEffect } from 'react';
import Select from '../common/Select';
import Textarea from '../common/Textarea';
import Button from '../common/Button';
import Alert from '../common/Alert';
import { useFormSubmit } from '../../hooks/useFormSubmit'; // Custom hook
import { Ticket, User, TicketStatus } from '../../types'; // Import types
import { updateTicketStatus } from '../../services/ticketService'; // API service call

// --- Component Props ---
interface TicketStatusFormProps {
    ticket: Ticket;
    assignableUsers: Pick<User, 'id' | 'name'>[];
    onUpdateSuccess: (updatedTicket: Ticket) => void;
    onCancel: () => void;
}

// --- Form Input Data Structure ---
interface StatusFormInputs {
    status: TicketStatus;
    assignedToId: string; // Store ID, empty string ('') if unassigned
    resolutionNotes: string; // Required only when closing
}

// --- API Payload Structure ---
interface UpdateTicketStatusApiPayload {
    status: Ticket['status'];
    assignedToId?: string | null; // Backend expects null for unassigned
    resolutionNotes?: string; // Required if status is 'Closed'
}

// --- Component ---

/**
 * Renders a form for updating a ticket's status, assignee, and resolution notes
 * using the useFormSubmit hook.
 *
 * @param {TicketStatusFormProps} props - The component props.
 * @returns {React.ReactElement} The rendered TicketStatusForm component.
 */
const TicketStatusForm: React.FC<TicketStatusFormProps> = ({
    ticket,
    assignableUsers,
    onUpdateSuccess,
    onCancel,
}) => {
    // --- State ---
    const [formData, setFormData] = useState<StatusFormInputs>({
    status: ticket.status || 'Open',
    // Initialize with current assignee ID or empty string if none
    assignedToId: ticket.assignedTo?.id || '',
    resolutionNotes: ticket.resolutionNotes || '',
    });

    // --- Custom Hook for Submission ---
    const {
        submit: submitStatusUpdate,
        isLoading,
        error,
        clearError,
        // successMessage not needed, onUpdateSuccess handles UI change
    } = useFormSubmit<UpdateTicketStatusApiPayload, Ticket>(
        // Partially apply ticketId to the service function
        (statusData) => updateTicketStatus(ticket.id, statusData),
        {
            onSuccess: (updatedTicket) => {
                onUpdateSuccess(updatedTicket); // Notify parent
            },
            onError: (err) => {
                console.error("Failed to update ticket status (hook callback):", err);
                // Error message handled by hook state
            },
        }
    );

    // --- Derived State ---
    const isClosing = formData.status === 'Closed';

    // --- Effects ---
    // Reset form when the ticket prop changes (e.g., opening modal for different ticket)
    useEffect(() => {
        console.log("[TicketStatusForm] useEffect running. Initializing form state from ticket:", ticket);
        setFormData({
            status: ticket.status || 'Open',
            assignedToId: ticket.assignedTo?.id || '', // Correctly initialize
            resolutionNotes: ticket.resolutionNotes || '',
        });
        clearError(); // Clear errors when ticket context changes
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ticket.id]); // Depend only on ticket ID to reset when ticket changes

    // --- Handlers ---
    /**
     * Handles changes in form input/select/textarea fields. Clears hook error.
     */
    const handleChange = (
    e: React.ChangeEvent<HTMLSelectElement | HTMLTextAreaElement>
    ) => {
        const { name, value } = e.target;
        console.log(`[TicketStatusForm] handleChange: name=${name}, value=${value}`);
        setFormData((prev) => ({ ...prev, [name]: value }));
        if (error) clearError();
    };

    /**
     * Handles form submission to update the ticket status.
     */
    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (isClosing && !formData.resolutionNotes.trim()) {
            alert('Resolution notes are required to close the ticket.'); // Simple validation
            return;
        }

        console.log("[TicketStatusForm] handleSubmit: Current formData state:", formData);

        // Prepare payload for the API
        const payload: UpdateTicketStatusApiPayload = {
            status: formData.status,
            assignedToId: formData.assignedToId ? formData.assignedToId : null,
            resolutionNotes: isClosing ? formData.resolutionNotes : undefined,
        };

        console.log("[TicketStatusForm] Submitting status update payload:", payload); // Log the final payload
        submitStatusUpdate(payload); // Call the hook's submit function
    };

    // --- Options ---
    const statusOptions: { value: TicketStatus; label: string }[] = [
    { value: 'Open', label: 'Open' },
    { value: 'In Progress', label: 'In Progress' }, 
    { value: 'Closed', label: 'Closed' },
    ];
    
    // Ensure the "Unassigned" option has value=""
    const assigneeOptions = [
    { value: '', label: 'Unassigned / Keep Unassigned' },
    ...assignableUsers.map(user => ({ value: user.id, label: user.name })),
    ];

    // --- Render ---
    return (
    <form onSubmit={handleSubmit} className="status-form">
        {error && <Alert type="error" message={error} className="mb-4" />}

        {/* Status Select */}
        <Select label="Ticket Status" id="status" name="status" options={statusOptions}
        value={formData.status} onChange={handleChange} required disabled={isLoading}
        containerClassName="mb-4" />

        {/* Assignee Select */}
        <Select label="Assign To" id="assignedToId" name="assignedToId" options={assigneeOptions}
        value={formData.assignedToId} onChange={handleChange} disabled={isLoading}
        containerClassName="mb-4" placeholder="Select Assignee..." />

        {/* Resolution Notes Textarea (conditional) */}
        {isClosing && (
        <Textarea label="Resolution Notes (Required to Close)" id="resolutionNotes" name="resolutionNotes"
            value={formData.resolutionNotes} onChange={handleChange} rows={5} required={isClosing}
            disabled={isLoading} containerClassName="mb-6"
            placeholder="Enter details about how the issue was resolved..." />
        )}

        {/* Form Actions */}
        <div className="form-actions">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
            Cancel
        </Button>
        <Button type="submit" variant="primary" isLoading={isLoading} disabled={isLoading}>
            {isLoading ? 'Updating...' : 'Update Status'}
        </Button>
        </div>
    </form>
    );
};

export default TicketStatusForm;
