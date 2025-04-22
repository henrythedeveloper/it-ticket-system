// src/components/common/Alert.tsx
// ==========================================================================
// Reusable Alert component for displaying messages (info, success, warning, error).
// ==========================================================================

import React from 'react';

// --- Component Props ---

/**
 * Defines the possible types (styles) for the Alert component.
 */
type AlertType = 'info' | 'success' | 'warning' | 'error';

/**
 * Props for the Alert component.
 */
interface AlertProps {
    /** The type of alert, determining its style (e.g., 'success', 'error'). Defaults to 'info'. */
    type?: AlertType;
    /** The main message content of the alert. */
    message: React.ReactNode; // Allow complex content like links
    /** Optional title for the alert. */
    title?: string;
    /** Optional CSS class name for custom styling. */
    className?: string;
    /** Optional: Function to call when the alert is closed (if a close button is added). */
    // onClose?: () => void; // Example if adding a close button later
}

// --- Component ---

/**
 * Renders a styled alert box to display messages to the user.
 *
 * @param {AlertProps} props - The component props.
 * @returns {React.ReactElement} The rendered Alert component.
 */
const Alert: React.FC<AlertProps> = ({
    type = 'info', // Default to 'info' type
    message,
    title,
    className = '',
    // onClose, // Example for close button
}) => {
    // --- Render ---
    // Determine the CSS class based on the alert type
    const alertClass = `alert alert-${type} ${className}`;

    return (
    <div className={alertClass} role="alert">
        {/* Optional: Add an icon based on type */}
        {/* Optional: Add a close button */}
        {/* {onClose && (
        <button onClick={onClose} className="alert-close-btn">&times;</button>
        )} */}

        {/* Display title if provided */}
        {title && <strong className="alert-title">{title}</strong>}

        {/* Display the main message */}
        <div className="alert-message">{message}</div>
    </div>
    );
};

export default Alert;
