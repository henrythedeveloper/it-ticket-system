// src/components/common/Card.tsx
// ==========================================================================
// Reusable Card component for displaying content in a bordered container.
// Includes optional header and footer sections.
// ==========================================================================

import React from 'react';

// --- Component Props ---

/**
 * Props for the Card component.
 */
interface CardProps {
    /** The main content of the card. */
    children: React.ReactNode;
    /** Optional content for the card header section. */
    header?: React.ReactNode;
    /** Optional content for the card footer section. */
    footer?: React.ReactNode;
    /** Optional CSS class name for the main card container. */
    className?: string;
    /** Optional CSS class name for the card body section. */
    bodyClassName?: string;
    /** Optional: Removes default padding from the card body if set to true. */
    noBodyPadding?: boolean;
}

// --- Component ---

/**
 * Renders a card container with optional header and footer sections.
 * Uses the global `.card` class for base styling (defined via mixin in SCSS).
 *
 * @param {CardProps} props - The component props.
 * @returns {React.ReactElement} The rendered Card component.
 */
const Card: React.FC<CardProps> = ({
    children,
    header,
    footer,
    className = '',
    bodyClassName = '',
    noBodyPadding = false,
}) => {
    // --- Render ---
    const cardClass = `card ${className}`;
    const bodyClass = `card-body ${bodyClassName} ${noBodyPadding ? 'no-padding' : ''}`; // Add no-padding class if needed

    return (
    <div className={cardClass}>
        {/* Render header if provided */}
        {header && (
        <div className="card-header">
            {header}
        </div>
        )}

        {/* Render main body content */}
        <div className={bodyClass}>
        {children}
        </div>

        {/* Render footer if provided */}
        {footer && (
        <div className="card-footer">
            {footer}
        </div>
        )}
    </div>
    );
};

export default Card;
