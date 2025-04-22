// src/components/common/Select.tsx
// ==========================================================================
// Reusable Select (dropdown) component for form fields.
// Includes label, options, error message display, and forwards standard select props.
// ==========================================================================

import React, { SelectHTMLAttributes } from 'react';
// Optional: If using react-hook-form
// import { UseFormRegisterReturn } from 'react-hook-form';

// --- Component Props ---

/**
 * Represents a single option in the select dropdown.
 */
interface SelectOption {
    value: string | number;
    label: string;
}

/**
 * Props for the Select component. Extends standard HTML select attributes.
 */
interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
    /** The label text associated with the select field. */
    label: string;
    /** The unique ID for the select field, used for label association. */
    id: string;
    /** An array of options to display in the dropdown. */
    options: SelectOption[];
    /** Optional error message to display below the select field. */
    error?: string | null;
    /** Optional CSS class name for the select container. */
    containerClassName?: string;
    /** Optional CSS class name for the select element itself. */
    className?: string;
    /** Optional placeholder text (rendered as a disabled option). */
    placeholder?: string;
    /** Optional: Registration object from react-hook-form. */
    // register?: UseFormRegisterReturn;
}

// --- Component ---

/**
 * Renders a labeled select dropdown field with options and optional error message display.
 * Forwards standard HTML select attributes like `value`, `onChange`, `disabled`, etc.
 *
 * @param {SelectProps} props - The component props.
 * @returns {React.ReactElement} The rendered Select component.
 */
const Select: React.FC<SelectProps> = ({
    label,
    id,
    options,
    error = null,
    containerClassName = '',
    className = '',
    placeholder,
    // register, // Example if using react-hook-form
    ...props // Pass down remaining standard select props
}) => {
    // --- Render ---
    const formGroupClass = `form-group ${containerClassName}`;
    // SCSS mixin handles the arrow styling based on the select element itself
    const selectClass = `select-field ${className} ${error ? 'select-error' : ''}`;

    return (
    <div className={formGroupClass}>
        {/* Label for the select field */}
        <label htmlFor={id}>{label}</label>

        {/* Select element */}
        <select
        id={id}
        className={selectClass}
        aria-invalid={error ? 'true' : 'false'} // Accessibility: indicate invalid state
        aria-describedby={error ? `${id}-error` : undefined} // Accessibility: link error message
        // {...register} // Spread registration props if using react-hook-form
        {...props} // Spread the rest of the props (e.g., value, onChange, disabled)
        >
        {/* Optional placeholder option */}
        {placeholder && (
            <option value="" disabled>
            {placeholder}
            </option>
        )}

        {/* Map through options array to render <option> elements */}
        {options.map((option) => (
            <option key={option.value} value={option.value}>
            {option.label}
            </option>
        ))}
        </select>

        {/* Error message display */}
        {error && (
        <div id={`${id}-error`} className="error" role="alert">
            {error}
        </div>
        )}
    </div>
    );
};

export default Select;
