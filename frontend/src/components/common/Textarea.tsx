    // src/components/common/Textarea.tsx
    // ==========================================================================
    // Reusable Textarea component for multi-line text input in forms.
    // Includes label, error message display, and forwards standard textarea props.
    // ==========================================================================

    import React, { TextareaHTMLAttributes } from 'react';
    // Optional: If using react-hook-form
    // import { UseFormRegisterReturn } from 'react-hook-form';

    // --- Component Props ---

    /**
     * Props for the Textarea component. Extends standard HTML textarea attributes.
     */
    interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
      /** The label text associated with the textarea field. */
      label: string;
      /** The unique ID for the textarea field, used for label association. */
      id: string;
      /** Optional error message to display below the textarea. */
      error?: string | null;
      /** Optional CSS class name for the textarea container. */
      containerClassName?: string;
      /** Optional CSS class name for the textarea element itself. */
      className?: string;
      /** Optional: Registration object from react-hook-form. */
      // register?: UseFormRegisterReturn;
    }

    // --- Component ---

    /**
     * Renders a labeled textarea field with optional error message display.
     * Forwards standard HTML textarea attributes like `placeholder`, `value`, `onChange`, `rows`, etc.
     *
     * @param {TextareaProps} props - The component props.
     * @returns {React.ReactElement} The rendered Textarea component.
     */
    const Textarea: React.FC<TextareaProps> = ({
      label,
      id,
      error = null,
      containerClassName = '',
      className = '',
      // register, // Example if using react-hook-form
      ...props // Pass down remaining standard textarea props
    }) => {
      // --- Render ---
      const formGroupClass = `form-group ${containerClassName}`;
      // Use form-input-base mixin styles via the textarea element selector in SCSS
      const textareaClass = `textarea-field ${className} ${error ? 'textarea-error' : ''}`;

      return (
        <div className={formGroupClass}>
          {/* Label for the textarea field */}
          <label htmlFor={id}>{label}</label>

          {/* Textarea element */}
          <textarea
            id={id}
            className={textareaClass}
            aria-invalid={error ? 'true' : 'false'} // Accessibility: indicate invalid state
            aria-describedby={error ? `${id}-error` : undefined} // Accessibility: link error message
            // {...register} // Spread registration props if using react-hook-form
            {...props} // Spread the rest of the props (e.g., value, onChange, rows)
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

    export default Textarea;
    