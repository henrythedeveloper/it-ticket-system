// src/components/common/Input.tsx
// ==========================================================================
// Reusable Input component for form fields.
// Includes label, error message display, and forwards standard input props.
// ==========================================================================

import React, { InputHTMLAttributes } from 'react';
// Optional: If using react-hook-form
// import { UseFormRegisterReturn } from 'react-hook-form';

// --- Component Props ---

/**
 * Props for the Input component. Extends standard HTML input attributes.
 */
interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    /** The label text associated with the input field. */
    label: string;
    /** The unique ID for the input field, used for label association. */
    id: string;
    /** Optional error message to display below the input. */
    error?: string | null;
    /** Optional CSS class name for the input container. */
    containerClassName?: string;
    /** Optional CSS class name for the input element itself. */
    className?: string;
    /** Optional: Registration object from react-hook-form. */
    // register?: UseFormRegisterReturn;
}

// --- Component ---

/**
 * Renders a labeled input field with optional error message display.
 * Forwards standard HTML input attributes like `type`, `placeholder`, `value`, `onChange`, etc.
 *
 * @param {InputProps} props - The component props.
 * @returns {React.ReactElement} The rendered Input component.
 */
const Input: React.FC<InputProps> = ({
    label,
    id,
    error = null,
    containerClassName = '',
    className = '',
    type = 'text', // Default input type to 'text'
    // register, // Example if using react-hook-form
    ...props // Pass down remaining standard input props
}) => {
    // --- Render ---
    const formGroupClass = `form-group ${containerClassName}`;
    const inputClass = `input-field ${className} ${error ? 'input-error' : ''}`; // Add error class if needed

    return (
    <div className={formGroupClass}>
        {/* Label for the input field */}
        <label htmlFor={id}>{label}</label>

        {/* Input element */}
        <input
        id={id}
        type={type}
        className={inputClass}
        aria-invalid={error ? 'true' : 'false'} // Accessibility: indicate invalid state
        aria-describedby={error ? `${id}-error` : undefined} // Accessibility: link error message
        // {...register} // Spread registration props if using react-hook-form
        {...props} // Spread the rest of the props
        />

        {/* Error message display */}
        {error && (
        <div id={`${id}-error`} className="error" role="alert">
            {error}
        </div>
        )}
    </div>
    );
};

export default Input;
