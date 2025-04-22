// src/components/forms/TicketCommentForm.tsx
// ==========================================================================
// Component rendering the form for adding comments/updates to a ticket.
// Refactored to use the useFormSubmit hook.
// ==========================================================================

import React, { useState } from 'react';
import Textarea from '../common/Textarea'; // Reusable Textarea component
import Button from '../common/Button'; // Reusable Button component
import Alert from '../common/Alert'; // Reusable Alert component
import { useFormSubmit } from '../../hooks/useFormSubmit'; // Custom hook
// import Checkbox from '../common/Checkbox'; // Assuming a Checkbox component exists
import { addTicketUpdate } from '../../services/ticketService'; // API service call
import { TicketUpdate } from '../../types'; // Type definition

// --- Component Props ---
interface TicketCommentFormProps {
    ticketId: string;
    onCommentAdded: (newUpdate: TicketUpdate) => void;
    onCancel: () => void;
    canAddInternalNote?: boolean;
}

// --- Form Input Data Structure ---
interface CommentFormInputs {
    content: string;
    isInternalNote: boolean;
}

// --- API Payload Structure ---
interface AddTicketUpdateInput {
    content: string;
    isInternalNote?: boolean;
}

// --- Component ---

/**
 * Renders a form for adding comments or internal notes to a ticket
 * using the useFormSubmit hook.
 *
 * @param {TicketCommentFormProps} props - The component props.
 * @returns {React.ReactElement} The rendered TicketCommentForm component.
 */
const TicketCommentForm: React.FC<TicketCommentFormProps> = ({
    ticketId,
    onCommentAdded,
    onCancel,
    canAddInternalNote = false,
}) => {
    // --- State ---
    const [formData, setFormData] = useState<CommentFormInputs>({
    content: '',
    isInternalNote: false,
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
                // setFormData({ content: '', isInternalNote: false });
            },
            onError: (err) => {
                console.error("Failed to add comment (hook callback):", err);
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
     * Handles changes in the internal note checkbox. Clears hook error.
     */
    const handleInternalNoteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, isInternalNote: e.target.checked }));
        if (error) clearError();
    };

    /**
     * Handles form submission to add the comment/update.
     */
    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!formData.content.trim()) {
        // Use the hook's error state or a local one
        alert('Comment cannot be empty.'); // Simple alert for now
        return;
    }
    const payload: AddTicketUpdateInput = {
        content: formData.content,
        isInternalNote: formData.isInternalNote,
    };
    submitComment(payload); // Call the hook's submit function
    };

    // --- Render ---
    return (
    <form onSubmit={handleSubmit} className="comment-form">
        {error && <Alert type="error" message={error} className="mb-3" />}

        {/* Comment Textarea */}
        <Textarea
        label={formData.isInternalNote ? "Internal Note" : "Add Comment / Update"}
        id="content" name="content" value={formData.content}
        onChange={handleContentChange} rows={5} required disabled={isLoading}
        placeholder={formData.isInternalNote ? "Add an internal note visible only to staff..." : "Add a comment or update for the ticket..."}
        containerClassName="mb-3"
        />

        {/* Internal Note Checkbox (conditional) */}
        {canAddInternalNote && (
            <div className="form-group checkbox mb-4">
            <label htmlFor="isInternalNote">
                <input
                    type="checkbox" id="isInternalNote" name="isInternalNote"
                    checked={formData.isInternalNote} onChange={handleInternalNoteChange}
                    disabled={isLoading}
                />
                Internal Note (Visible to staff only)
            </label>
            </div>
        )}

        {/* Form Actions */}
        <div className="form-actions">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
            Cancel
        </Button>
        <Button type="submit" variant="primary" isLoading={isLoading} disabled={isLoading}>
            {isLoading ? 'Adding...' : (formData.isInternalNote ? 'Add Note' : 'Add Comment')}
        </Button>
        </div>
    </form>
    );
};

export default TicketCommentForm;
