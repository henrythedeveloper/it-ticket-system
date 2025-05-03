// src/components/forms/TicketCommentForm.tsx
// ==========================================================================
// Component rendering the form for adding comments/updates to a ticket.
// Refactored to use the useFormSubmit hook.
// **REVISED**: Removed the 'Internal Note' checkbox option. All comments
//              submitted via this form are now implicitly internal notes.
// ==========================================================================

import React, { useState } from 'react';
import Textarea from '../common/Textarea'; // Reusable Textarea component
import Button from '../common/Button'; // Reusable Button component
import Alert from '../common/Alert'; // Reusable Alert component
import { useFormSubmit } from '../../hooks/useFormSubmit'; // Custom hook
import { addTicketUpdate } from '../../services/ticketService'; // API service call
import { TicketUpdate } from '../../types'; // Type definition

// --- Component Props ---
interface TicketCommentFormProps {
    ticketId: string;
    onCommentAdded: (newUpdate: TicketUpdate) => void;
    onCancel: () => void;
}

// --- Form Input Data Structure ---
interface CommentFormInputs {
    content: string;
}

// --- API Payload Structure ---
interface AddTicketUpdateInput {
    content: string;
    isInternalNote: boolean; // Always true now
}

// --- Component ---

/**
 * Renders a form for adding internal notes to a ticket
 * using the useFormSubmit hook. The option to make it a public comment
 * has been removed; all submissions are internal.
 *
 * @param {TicketCommentFormProps} props - The component props.
 * @returns {React.ReactElement} The rendered TicketCommentForm component.
 */
const TicketCommentForm: React.FC<TicketCommentFormProps> = ({
    ticketId,
    onCommentAdded,
    onCancel,
}) => {
    // --- State ---
    const [formData, setFormData] = useState<CommentFormInputs>({
        content: '',
    });

    // --- Custom Hook for Submission ---
    const {
        submit: submitComment,
        isLoading,
        error,
        clearError,
        // successMessage not needed, calls onCommentAdded
    } = useFormSubmit<AddTicketUpdateInput, TicketUpdate>(
        // Partially apply ticketId to the service function
        (updateData) => addTicketUpdate(ticketId, updateData),
        {
            onSuccess: (newUpdate) => {
                onCommentAdded(newUpdate); // Notify parent
                // Optionally clear form here or rely on parent to close/clear
                // setFormData({ content: '' });
            },
            onError: (err) => {
                console.error("Failed to add internal note (hook callback):", err);
                // Error message handled by hook state
            },
        }
    );

    // --- Handlers ---
    /**
     * Handles changes in the textarea field. Clears hook error.
     */
    const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setFormData((prev) => ({ ...prev, content: e.target.value }));
        if (error) clearError();
    };

    /**
     * Handles form submission to add the internal note.
     */
    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!formData.content.trim()) {
            // Use the hook's error state or a local one
            alert('Note cannot be empty.'); // Simple alert for now
            return;
        }
        // Payload always sets isInternalNote to true
        const payload: AddTicketUpdateInput = {
            content: formData.content,
            isInternalNote: true, // Always true
        };
        submitComment(payload); // Call the hook's submit function
    };

    // --- Render ---
    return (
        <form onSubmit={handleSubmit} className="comment-form">
            {error && <Alert type="error" message={error} className="mb-3" />}

            {/* Comment Textarea - Label updated */}
            <Textarea
                label="Internal Note" // Label is always "Internal Note"
                id="content" name="content" value={formData.content}
                onChange={handleContentChange} rows={5} required disabled={isLoading}
                placeholder="Add an internal note visible only to staff..." // Placeholder updated
                containerClassName="mb-3"
            />

            {/* Form Actions */}
            <div className="form-actions">
                <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
                    Cancel
                </Button>
                <Button type="submit" variant="primary" isLoading={isLoading} disabled={isLoading}>
                    {/* Button text updated */}
                    {isLoading ? 'Adding...' : 'Add Note'}
                </Button>
            </div>
        </form>
    );
};

export default TicketCommentForm;