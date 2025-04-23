    // src/components/common/Button.tsx
    // ==========================================================================
    // Reusable Button component with different variants, sizes, and loading state.
    // Ensures the base 'btn' class is always applied.
    // ==========================================================================

    import React from 'react';

    // --- Component Props ---

    /**
     * Defines the possible style variants for the Button.
     */
    type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'outline' | 'ghost' | 'link';
    /**
     * Defines the possible sizes for the Button.
     */
    type ButtonSize = 'sm' | 'md' | 'lg';

    /**
     * Props for the Button component. Extends standard HTML button attributes.
     */
    interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
        /** The content to display inside the button. */
        children: React.ReactNode;
        /** The style variant of the button. Defaults to 'primary'. */
        variant?: ButtonVariant;
        /** The size of the button. Defaults to 'md'. */
        size?: ButtonSize;
        /** If true, shows a loading spinner and disables the button. Defaults to false. */
        isLoading?: boolean;
        /** Optional icon element to display before the text. */
        leftIcon?: React.ReactElement;
        /** Optional icon element to display after the text. */
        rightIcon?: React.ReactElement;
        /** Optional CSS class name for additional custom styling. */
        className?: string;
    }

    // --- Component ---

    /**
     * Renders a styled button element with support for variants, sizes, icons,
     * and loading states. It forwards standard button attributes like `onClick`, `type`, etc.
     * Automatically applies the base 'btn' class.
     *
     * @param {ButtonProps} props - The component props.
     * @returns {React.ReactElement} The rendered Button component.
     */
    const Button: React.FC<ButtonProps> = ({
        children,
        variant = 'primary',
        size = 'md',
        isLoading = false,
        leftIcon,
        rightIcon,
        className = '', // User-provided classes
        disabled,
        ...props // Pass down remaining standard button props (onClick, type, etc.)
    }) => {
        // --- Render ---
        // Construct the CSS class name based on props
        // *** Always include the base 'btn' class ***
        const buttonClass = `
        btn
        btn-${variant}
        btn-${size}
        ${isLoading ? 'loading' : ''}
        ${className}
        `.trim().replace(/\s+/g, ' '); // Combine classes cleanly

        return (
        <button
            className={buttonClass}
            disabled={isLoading || disabled} // Disable button if loading or explicitly disabled
            {...props} // Spread the rest of the props (e.g., onClick, type)
        >
            {/* Show loading spinner if isLoading is true */}
            {isLoading ? (
            <span className="btn-spinner" aria-hidden="true"></span> // Spinner styled by CSS .btn.loading::before
            ) : (
            <>
                {/* Render left icon if provided */}
                {leftIcon && <span className="btn-icon btn-icon-left" aria-hidden="true">{leftIcon}</span>}
                {/* Render button text/children */}
                <span className="btn-text">{children}</span>
                {/* Render right icon if provided */}
                {rightIcon && <span className="btn-icon btn-icon-right" aria-hidden="true">{rightIcon}</span>}
            </>
            )}
        </button>
        );
    };

    export default Button;
    