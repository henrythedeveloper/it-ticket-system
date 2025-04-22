// src/components/common/Loader.tsx
// ==========================================================================
// Reusable Loader component for indicating loading states.
// Displays a spinner and optional text.
// ==========================================================================

import React from 'react';

// --- Component Props ---

/**
 * Props for the Loader component.
 */
interface LoaderProps {
    /** Optional text to display below the spinner. */
    text?: string;
    /** Optional CSS class name for the container. */
    className?: string;
    /** Size of the loader spinner. Defaults to 'md'. */
    size?: 'sm' | 'md' | 'lg';
}

// --- Component ---

/**
 * Renders a loading indicator, typically a spinner with optional text.
 * Uses CSS classes defined in global styles for the spinner animation.
 *
 * @param {LoaderProps} props - The component props.
 * @returns {React.ReactElement} The rendered Loader component.
 */
const Loader: React.FC<LoaderProps> = ({
    text,
    className = '',
    size = 'md'
}) => {
    // --- Render ---
    const containerClass = `loading ${className}`; // Base class from global.scss
    const spinnerClass = `loader loader-${size}`; // Base spinner + size class

    return (
    <div className={containerClass}>
        {/* The CSS spinner element */}
        <div className={spinnerClass} aria-label="Loading..."></div>
        {/* Optional loading text */}
        {text && <p>{text}</p>}
    </div>
    );
};

export default Loader;
