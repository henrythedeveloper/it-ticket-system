import React, { useRef, useState, DragEvent } from 'react';
import { UploadCloud, X as CloseIcon } from 'lucide-react';
import api from '../../services/api';

interface AttachmentUploadProps {
  uploadUrl: string;
  onUploadSuccess: () => void;
  multiple?: boolean;
  buttonLabel?: string;
  disabled?: boolean;
}

const AttachmentUpload: React.FC<AttachmentUploadProps> = ({
  uploadUrl,
  onUploadSuccess,
  multiple = false,
  buttonLabel = 'Upload',
  disabled = false,
}) => {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const handleFiles = (fileList: FileList | File[]) => {
    const newFiles = Array.from(fileList);
    setFiles(prev => multiple ? [...prev, ...newFiles] : newFiles.slice(0, 1));
    setError(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) handleFiles(e.target.files);
  };

  const handleRemoveFile = (fileToRemove: File) => {
    setFiles(prev => prev.filter(file => file !== fileToRemove));
  };

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!files.length) {
      setError('Please select a file.');
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      files.forEach(file => formData.append('file', file));
      await api.post(uploadUrl, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        withCredentials: true,
      });
      setFiles([]);
      onUploadSuccess();
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="attachment-upload-form" style={{ marginBottom: 12 }}>
      <div className="attachment-input-area">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          multiple={multiple}
          disabled={uploading || disabled}
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
      {files.length > 0 && (
        <div className="file-preview-list">
          {files.map((file, idx) => (
            <div key={idx} className="file-preview-item">
              <span className="file-name" title={file.name}>{file.name}</span>
              <span className="file-size">({Math.round(file.size / 1024)} KB)</span>
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
      <button
        type="submit"
        disabled={uploading || !files.length || disabled}
        className="btn btn-primary"
        style={{ marginLeft: 8 }}
      >
        {uploading ? 'Uploading...' : buttonLabel}
      </button>
      {error && <div style={{ color: 'red', marginTop: 4 }}>{error}</div>}
    </form>
  );
};

export default AttachmentUpload;