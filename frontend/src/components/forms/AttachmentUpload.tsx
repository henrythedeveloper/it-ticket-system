// src/components/forms/AttachmentUpload.tsx
// ==========================================================================
// Reusable component for handling file uploads (single or multiple).
// Includes drag-and-drop functionality and file previews.
// **REVISED**: Refactored JSX structure to match TicketForm's attachment section.
// ==========================================================================

import React, { useRef, useState, DragEvent } from 'react';
import { UploadCloud, X as CloseIcon } from 'lucide-react';
import api from '../../services/api'; // Assuming api service is configured
import { formatBytes } from '../../utils/helpers'; // Helper for file size formatting
import Button from '../common/Button'; // Use Button component
import Alert from '../common/Alert'; // Use Alert component

// --- Component Props ---
interface AttachmentUploadProps {
  /** The API endpoint URL to POST the file(s) to. */
  uploadUrl: string;
  /** Callback function triggered after a successful upload. */
  onUploadSuccess: () => void;
  /** Allow multiple file selection. Defaults to false. */
  multiple?: boolean;
  /** Label for the upload button. Defaults to 'Upload'. */
  buttonLabel?: string;
  /** Disable the upload functionality. Defaults to false. */
  disabled?: boolean;
  /** Optional CSS class name for the form container. */
  className?: string;
  /** Optional: ID for the file input, useful if label is external. */
  inputId?: string;
}

// --- Component ---
const AttachmentUpload: React.FC<AttachmentUploadProps> = ({
  uploadUrl,
  onUploadSuccess,
  multiple = false,
  buttonLabel = 'Upload',
  disabled = false,
  className = '',
  inputId = 'attachment-upload-input', // Default ID
}) => {
  // --- State ---
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // --- File Handling Logic ---
  const handleFiles = (fileList: FileList | File[]) => {
    const newFiles = Array.from(fileList);
    // Limit validation could be added here if needed
    setFiles(prev => multiple ? [...prev, ...newFiles] : newFiles.slice(0, 1));
    setError(null); // Clear error when new files are selected
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) handleFiles(e.target.files);
  };

  const handleRemoveFile = (fileToRemove: File) => {
    setFiles(prev => prev.filter(file => file !== fileToRemove));
     // Also reset the input visually if all files are removed
     if (files.length === 1 && fileInputRef.current) {
        fileInputRef.current.value = '';
     }
  };

  // --- Drag & Drop Handlers ---
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
    if (e.dataTransfer.files?.length > 0) handleFiles(e.dataTransfer.files);
  };

  // --- Form Submission ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!files.length) {
      setError('Please select at least one file to upload.');
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      // Use 'attachments' as the key, consistent with TicketForm backend expectation
      files.forEach(file => formData.append('attachments', file, file.name));

      // Use the API service to post the form data
      await api.post(uploadUrl, formData, {
        // Axios automatically sets Content-Type to multipart/form-data
        withCredentials: true, // Include if needed for auth
      });

      setFiles([]); // Clear files on success
      if (fileInputRef.current) {
        fileInputRef.current.value = ''; // Reset file input visually
      }
      onUploadSuccess(); // Trigger callback

    } catch (err: any) {
      // Handle errors from the API call
      const message = err?.response?.data?.message || err.message || 'File upload failed.';
      setError(message);
      console.error("Attachment upload error:", err);
    } finally {
      setUploading(false);
    }
  };

  // --- Render ---
  const formClass = `attachment-upload-form ${className}`;

  return (
    // Use a form element for semantic structure and submission handling
    <form onSubmit={handleSubmit} className={formClass}>

      {/* --- Structure mirroring TicketForm --- */}
      <div className="attachment-input-area">
        <input
          type="file"
          id={inputId} // Use the passed or default ID
          name="attachments" // Match name used in TicketForm
          ref={fileInputRef}
          onChange={handleFileChange}
          multiple={multiple}
          disabled={uploading || disabled}
          className="file-input-hidden" // Use the standard hiding class
          aria-label="File upload input"
        />
        <label
          htmlFor={inputId} // Match the input ID
          className={`file-input-trigger ${isDraggingOver ? 'drag-over' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <UploadCloud size={20} />
          <span>{isDraggingOver ? 'Drop files here!' : 'Click or drag files to upload'}</span>
        </label>
      </div>

      {/* File Preview (Identical structure to TicketForm) */}
      {files.length > 0 && (
        <div className="file-preview-list">
          {files.map((file, index) => (
            <div key={index} className="file-preview-item">
              <span className="file-name" title={file.name}>{file.name}</span>
              <span className="file-size">({formatBytes(file.size)})</span>
              <button
                type="button"
                onClick={() => handleRemoveFile(file)}
                className="remove-file-btn"
                aria-label={`Remove ${file.name}`}
                disabled={uploading || disabled}
              >
                <CloseIcon size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
      {/* --- End Structure mirroring TicketForm --- */}


      {/* Error Display */}
      {error && <Alert type="error" message={error} className="mt-3 mb-0" />}

      {/* Submit Button */}
      <Button
        type="submit"
        variant="primary" // Or choose another variant
        isLoading={uploading}
        disabled={uploading || !files.length || disabled}
        className="mt-3 w-full" // Example styling: margin-top, full-width
      >
        {uploading ? 'Uploading...' : buttonLabel}
      </Button>
    </form>
  );
};

export default AttachmentUpload;
