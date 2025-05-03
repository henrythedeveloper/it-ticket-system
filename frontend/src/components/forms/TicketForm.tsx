// src/components/forms/TicketForm.tsx
// ==========================================================================
// Component rendering the form for creating new tickets (public facing).
// Handles text inputs, selections, and file attachments using FormData.
// Uses the useFormSubmit hook for submission logic.
// SIMPLIFIED: Consolidated handlers and improved form management
// ==========================================================================

import React, { useState, useRef, DragEvent } from 'react';
import Input from '../common/Input';
import Textarea from '../common/Textarea';
import Select from '../common/Select';
import Button from '../common/Button';
import Alert from '../common/Alert';
import { useFormSubmit } from '../../hooks/useFormSubmit';
import { Ticket, TicketUrgency, APIResponse } from '../../types';
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
        submitterName: '', 
        endUserEmail: '', 
        subject: '', 
        description: '',
        urgency: 'Medium', 
        issueType: issueTypes[0] || '', 
        tags: [],
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
                if (response?.data?.ticketNumber !== undefined) {
                    // Reset form and call success handler
                    resetForm();
                    onSubmitSuccess(response.data.ticketNumber);
                } else {
                    console.error("[TicketForm] Invalid response structure or missing ticket_number:", response);
                    onSubmitSuccess(0);
                }
            },
            onError: (err) => {
                console.error("Failed to create ticket:", err);
            },
        }
    );

    // --- Reset Form ---
    const resetForm = () => {
        setFormData({
            submitterName: '', 
            endUserEmail: '', 
            subject: '', 
            description: '',
            urgency: 'Medium', 
            issueType: issueTypes[0] || '', 
            tags: [], 
            attachments: []
        });
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    // --- Unified Change Handler ---
    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
    ) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (error) clearError();
    };

    // --- Toggle Tag Selection ---
    const handleTagToggle = (tag: string) => {
        setFormData(prev => {
            const newTags = prev.tags.includes(tag)
                ? prev.tags.filter(t => t !== tag)
                : [...prev.tags, tag];
            return { ...prev, tags: newTags };
        });
        if (error) clearError();
    };

    // --- File Handling ---
    const handleFiles = (files: FileList | File[]) => {
        const newFiles = Array.from(files);
        setFormData(prev => ({
            ...prev,
            attachments: [...prev.attachments, ...newFiles]
        }));
        if (error) clearError();
    };

    const handleRemoveFile = (fileToRemove: File) => {
        setFormData(prev => ({
            ...prev,
            attachments: prev.attachments.filter(file => file !== fileToRemove)
        }));
    };

    // --- File Input Change ---
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            handleFiles(e.target.files);
        }
    };

    // --- Drag and Drop ---
    const handleDragOver = (e: DragEvent<HTMLLabelElement>) => {
        e.preventDefault();
        setIsDraggingOver(true);
    };

    const handleDragLeave = (e: DragEvent<HTMLLabelElement>) => {
        e.preventDefault();
        setIsDraggingOver(false);
    };

    const handleDrop = (e: DragEvent<HTMLLabelElement>) => {
        e.preventDefault();
        setIsDraggingOver(false);
        if (e.dataTransfer.files?.length > 0) {
            handleFiles(e.dataTransfer.files);
        }
    };

    // --- Form Submission ---
    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        
        // Create FormData object
        const submissionData = new FormData();
        
        // Add form field values
        Object.entries(formData).forEach(([key, value]) => {
            if (Array.isArray(value)) {
                if (key === 'tags') {
                    value.forEach(tag => submissionData.append('tags', tag));
                } else if (key === 'attachments') {
                    value.forEach(file => submissionData.append('attachments', file, file.name));
                }
            } else if (value) { // Only append if value exists
                submissionData.append(key, value.toString());
            }
        });
        
        // Validate required fields
        if (!formData.endUserEmail || !formData.subject || !formData.description) {
            console.error("[TicketForm] Error: Missing required fields");
            return;
        }
        
        // Submit the form
        submitNewTicket(submissionData);
    };

    // --- Options ---
    const urgencyOptions = [
        { value: 'Low', label: 'Low' }, 
        { value: 'Medium', label: 'Medium' },
        { value: 'High', label: 'High' }, 
        { value: 'Critical', label: 'Critical' },
    ];
    const issueTypeOptions = issueTypes.map(type => ({ value: type, label: type }));

    // --- Render ---
    return (
        <form onSubmit={handleSubmit} className="ticket-form">
            {error && <Alert type="error" message={error} className="mb-4" />}

            {/* Contact Information */}
            <div className="form-row">
                <Input 
                    label="Your Name" 
                    id="submitterName" 
                    name="submitterName" 
                    type="text"
                    value={formData.submitterName} 
                    onChange={handleChange} 
                    required 
                    disabled={isLoading} 
                />
                <Input 
                    label="Your Email" 
                    id="endUserEmail" 
                    name="endUserEmail" 
                    type="email"
                    value={formData.endUserEmail} 
                    onChange={handleChange} 
                    required 
                    disabled={isLoading} 
                />
            </div>

            {/* Ticket Details */}
            <Input 
                label="Subject" 
                id="subject" 
                name="subject" 
                type="text"
                value={formData.subject} 
                onChange={handleChange} 
                required 
                disabled={isLoading}
                containerClassName="mb-4" 
            />
            <Textarea 
                label="Describe your issue" 
                id="description" 
                name="description"
                value={formData.description} 
                onChange={handleChange} 
                required 
                disabled={isLoading}
                rows={8} 
                containerClassName="mb-4" 
                placeholder="Please provide as much detail as possible..." 
            />

            {/* Classification */}
            <div className="form-row">
                <Select 
                    label="Urgency" 
                    id="urgency" 
                    name="urgency" 
                    options={urgencyOptions}
                    value={formData.urgency} 
                    onChange={handleChange} 
                    required 
                    disabled={isLoading} 
                />
                {issueTypeOptions.length > 0 && (
                    <Select 
                        label="Issue Type / Category" 
                        id="issueType" 
                        name="issueType" 
                        options={issueTypeOptions}
                        value={formData.issueType} 
                        onChange={handleChange} 
                        disabled={isLoading} 
                        placeholder="Select category..." 
                    />
                )}
            </div>

            {/* Tags */}
            {availableTags.length > 0 && (
                <div className="form-group">
                    <label>Tags (Optional)</label>
                    <div className="tags-container">
                        {availableTags.map(tag => (
                            <button 
                                type="button" 
                                key={tag}
                                className={`tag ${formData.tags.includes(tag) ? 'selected' : ''}`}
                                onClick={() => handleTagToggle(tag)} 
                                disabled={isLoading}
                            >
                                {tag}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Attachments */}
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

                {/* File Preview */}
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
            <Button 
                type="submit" 
                variant="primary" 
                isLoading={isLoading} 
                disabled={isLoading}
                className="submit-button mt-6"
            >
                {isLoading ? 'Submitting Ticket...' : 'Submit Ticket'}
            </Button>
        </form>
    );
};

export default TicketForm;
