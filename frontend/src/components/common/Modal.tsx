// src/components/common/Modal.tsx
// ==========================================================================
// Reusable Modal component for displaying content in a dialog overlay.
// Includes basic structure, overlay, and close functionality.
// NOTE: For production, consider using a library for robust accessibility
// features like focus trapping and portal rendering.
// ==========================================================================

import React, { useEffect } from 'react';
import ReactDOM from 'react-dom'; // Needed for portal rendering

// --- Component Props ---

/**
 * Props for the Modal component.
 */
interface ModalProps {
    /** Controls whether the modal is visible. */
    isOpen: boolean;
    /** Function to call when the modal requests to be closed (e.g., overlay click, close button). */
    onClose: () => void;
    /** The content to display inside the modal. */
    children: React.ReactNode;
    /** Optional title for the modal header. */
    title?: string;
    /** Optional CSS class name for the modal container. */
    className?: string;
    /** Optional CSS class name for the modal content area. */
    contentClassName?: string;
    /** Optional: Hide the default close button. Defaults to false. */
    hideCloseButton?: boolean;
    /** Optional: Prevent closing when clicking the overlay. Defaults to false. */
    preventOverlayClose?: boolean;
}

// --- Component ---

/**
 * Renders a modal dialog overlay. Uses React Portal to render outside the main DOM hierarchy.
 * Handles basic close functionality via overlay click or close button.
 *
 * @param {ModalProps} props - The component props.
 * @returns {React.ReactElement | null} The rendered Modal component or null if not open.
 */
const Modal: React.FC<ModalProps> = ({
    isOpen,
    onClose,
    children,
    title,
    className = '',
    contentClassName = '',
    hideCloseButton = false,
    preventOverlayClose = false,
}) => {
    // --- Effects ---
    // Add/remove body class to prevent background scrolling when modal is open
    useEffect(() => {
    if (isOpen) {
        document.body.classList.add('modal-open');
    } else {
        document.body.classList.remove('modal-open');
    }
    // Cleanup function to remove class when component unmounts
    return () => {
        document.body.classList.remove('modal-open');
    };
    }, [isOpen]);

    // Handle Escape key press to close modal
    useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
        onClose();
        }
    };
    if (isOpen) {
        document.addEventListener('keydown', handleEscape);
    }
    return () => {
        document.removeEventListener('keydown', handleEscape);
    };
    }, [isOpen, onClose]);

    // --- Event Handlers ---
    /**
     * Handles clicks on the modal overlay. Closes modal if preventOverlayClose is false.
     */
    const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only close if the click is directly on the overlay, not its children
    if (e.target === e.currentTarget && !preventOverlayClose) {
        onClose();
    }
    };

    // --- Render ---
    // Don't render anything if the modal is not open
    if (!isOpen) {
    return null;
    }

    // Construct CSS classes
    const modalClass = `modal ${className}`;
    const modalContentClass = `modal-content ${contentClassName}`;

    // Use React Portal to render the modal at the end of the body
    // This helps with stacking context and accessibility.
    // Ensure you have a <div id="modal-root"></div> in your public/index.html
    const modalRoot = document.getElementById('modal-root');
    if (!modalRoot) {
        console.error("Modal root element with ID 'modal-root' not found in the DOM.");
        return null; // Or render inline as a fallback, though portal is preferred
    }

    return ReactDOM.createPortal(
    <div className={modalClass} onClick={handleOverlayClick} role="dialog" aria-modal="true" aria-labelledby={title ? 'modal-title' : undefined}>
        <div className={modalContentClass}>
        {/* Modal Header */}
        <div className="modal-header">
            {title && <h2 id="modal-title" className="modal-title">{title}</h2>}
            {!hideCloseButton && (
            <button onClick={onClose} className="modal-close-btn" aria-label="Close modal">
                &times; {/* Simple close icon */}
            </button>
            )}
        </div>

        {/* Modal Body */}
        <div className="modal-body">
            {children}
        </div>

        {/* Optional Modal Footer (could be passed as a prop) */}
        {/* <div className="modal-footer">...</div> */}
        </div>
    </div>,
    modalRoot // Target element for the portal
    );
};

export default Modal;
