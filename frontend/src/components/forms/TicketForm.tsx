// src/components/forms/TicketForm.tsx
// ==========================================================================
// Component rendering the form for creating new tickets (public facing).
// Handles text inputs, selections, and file attachments using FormData.
// Uses the useFormSubmit hook for submission logic.
// **REVISED**: Added drag-and-drop file upload functionality.
// **REVISED AGAIN**: Removed clearData() from drop handler and added logging.
// **REVISED AGAIN**: Removed FormData iteration loop causing TS error.
// ==========================================================================

import React, { useState, useRef, DragEvent } from 'react';
import Input from '../common/Input';
import Textarea from '../common/Textarea';
import Select from '../common/Select';
import Button from '../common/Button';
import Alert from '../common/Alert';
import { useFormSubmit } from '../../hooks/useFormSubmit';
import { Ticket, TicketUrgency, Tag, APIResponse } from '../../types';
import { createTicket } from '../../services/ticketService';
import { formatBytes } from '../../utils/helpers';
import { UploadCloud, X as CloseIcon } from 'lucide-react';

// --- Component Props ---
interface TicketFormProps {
    onSubmitSuccess: (newTicketNumber: number) => void;
    issueTypes?: string[];
    availableTags?: string[];
}

// --- Form Input Data Structure ---
interface PublicTicketFormInputs {
    submitterName: string;
    endUserEmail: string;
    subject: string;
    description: string;
    urgency: TicketUrgency;
    issueType: string;
    tags: string[];
    attachments: File[];
}

// --- Component ---
const TicketForm: React.FC<TicketFormProps> = ({
    onSubmitSuccess,
    issueTypes = [],
    availableTags = [],
}) => {
    // --- State ---
    const [formData, setFormData] = useState<PublicTicketFormInputs>({
        submitterName: '', endUserEmail: '', subject: '', description: '',
        urgency: 'Medium', issueType: issueTypes[0] || '', tags: [],
        attachments: [],
    });
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isDraggingOver, setIsDraggingOver] = useState(false);

    // --- Custom Hook for Submission ---
    const {
        submit: submitNewTicket,
        isLoading,
        error,
        clearError,
    } = useFormSubmit<FormData, APIResponse<Ticket>>(
        createTicket,
        {
            onSuccess: (response) => {
                console.log("[TicketForm] onSuccess received response:", response);
                if (response?.data?.ticket_number !== undefined) {
                    onSubmitSuccess(response.data.ticket_number);
                    setFormData({
                        submitterName: '', endUserEmail: '', subject: '', description: '',
                        urgency: 'Medium', issueType: issueTypes[0] || '', tags: [], attachments: []
                    });
                    if (fileInputRef.current) {
                        fileInputRef.current.value = '';
                    }
                } else {
                    console.error("[TicketForm] Invalid response structure or missing ticket_number:", response);
                    onSubmitSuccess(0);
                }
            },
            onError: (err) => {
                console.error("Failed to create ticket (hook callback):", err);
            },
        }
    );

    // --- Handlers ---
    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
    ) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
        if (error) clearError();
    };

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

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files);
            addFilesToState(newFiles);
            if (error) clearError();
        }
    };

    const handleRemoveFile = (fileToRemove: File) => {
        setFormData(prev => ({
            ...prev,
            attachments: prev.attachments.filter(file => file !== fileToRemove)
        }));
    };

    // --- Drag and Drop Handlers ---
    const handleDragOver = (e: DragEvent<HTMLLabelElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingOver(true);
    };

    const handleDragLeave = (e: DragEvent<HTMLLabelElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingOver(false);
    };

    const handleDrop = (e: DragEvent<HTMLLabelElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingOver(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const droppedFiles = Array.from(e.dataTransfer.files);
            console.log("[TicketForm] Files dropped:", droppedFiles.map(f => f.name));
            addFilesToState(droppedFiles);
            if (error) clearError();
        }
    };

    // Helper function to add files
    const addFilesToState = (filesToAdd: File[]) => {
         setFormData(prev => ({
            ...prev,
            attachments: [...prev.attachments, ...filesToAdd]
        }));
        console.log("[TicketForm] Updated attachments state:", filesToAdd.map(f=>f.name));
    };

    // --- Form Submission Handler ---
    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        console.log("[TicketForm] handleSubmit triggered. Current formData state:", formData);

        const submissionData = new FormData();

        submissionData.append('submitterName', formData.submitterName);
        submissionData.append('endUserEmail', formData.endUserEmail);
        submissionData.append('subject', formData.subject);
        submissionData.append('description', formData.description);
        submissionData.append('urgency', formData.urgency);
        if (formData.issueType) {
            submissionData.append('issueType', formData.issueType);
        }
        formData.tags.forEach(tag => submissionData.append('tags', tag));
        formData.attachments.forEach((file) => {
            submissionData.append('attachments', file, file.name);
        });

        console.log("[TicketForm] FormData object created for submission:", submissionData);
        // ** REMOVED the problematic logging loop that caused TS error **
        // for (let [key, value] of submissionData.entries()) { ... }

        if (!submissionData.has('endUserEmail') || !submissionData.has('subject') || !submissionData.has('description')) {
             console.error("[TicketForm] Error: Trying to submit FormData missing required fields.");
             return;
        }

        submitNewTicket(submissionData);
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

            {/* Fields remain the same */}
            <div className="form-row">
                <Input label="Your Name" id="submitterName" name="submitterName" type="text"
                    value={formData.submitterName} onChange={handleChange} required disabled={isLoading} />
                <Input label="Your Email" id="endUserEmail" name="endUserEmail" type="email"
                    value={formData.endUserEmail} onChange={handleChange} required disabled={isLoading} />
            </div>
            <Input label="Subject" id="subject" name="subject" type="text"
                value={formData.subject} onChange={handleChange} required disabled={isLoading}
                containerClassName="mb-4" />
            <Textarea label="Describe your issue" id="description" name="description"
                value={formData.description} onChange={handleChange} required disabled={isLoading}
                rows={8} containerClassName="mb-4" placeholder="Please provide as much detail as possible..." />
            <div className="form-row">
                <Select label="Urgency" id="urgency" name="urgency" options={urgencyOptions}
                    value={formData.urgency} onChange={handleChange} required disabled={isLoading} />
                {issueTypeOptions.length > 0 && (
                    <Select label="Issue Type / Category" id="issueType" name="issueType" options={issueTypeOptions}
                        value={formData.issueType} onChange={handleChange} disabled={isLoading} placeholder="Select category..." />
                )}
            </div>
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

            {/* Attachment Input - Handlers added to the label */}
            <div className="form-group">
                <label htmlFor="attachments">Attachments (Optional)</label>
                <div className="attachment-input-area">
                     <input
                        type="file"
                        id="attachments"
                        name="attachments"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        multiple
                        disabled={isLoading}
                        className="file-input-hidden"
                        aria-label="File upload input"
                    />
                    <label
                        htmlFor="attachments"
                        className={`file-input-trigger ${isDraggingOver ? 'drag-over' : ''}`}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                    >
                        <UploadCloud size={20} />
                        <span>{isDraggingOver ? 'Drop files here!' : 'Click or drag files to upload'}</span>
                    </label>
                </div>
                {formData.attachments.length > 0 && (
                    <div className="file-preview-list">
                        {formData.attachments.map((file, index) => (
                            <div key={index} className="file-preview-item">
                                <span className="file-name" title={file.name}>{file.name}</span>
                                <span className="file-size">({formatBytes(file.size)})</span>
                                <button
                                    type="button"
                                    onClick={() => handleRemoveFile(file)}
                                    className="remove-file-btn"
                                    aria-label={`Remove ${file.name}`}
                                    disabled={isLoading}
                                >
                                    <CloseIcon size={16} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Submit Button */}
            <Button type="submit" variant="primary" isLoading={isLoading} disabled={isLoading}
                className="submit-button mt-6">
                {isLoading ? 'Submitting Ticket...' : 'Submit Ticket'}
            </Button>
        </form>
    );
};

export default TicketForm;
