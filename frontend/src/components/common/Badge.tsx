// src/components/common/Badge.tsx
// ==========================================================================
// Reusable Badge component for displaying status, urgency, roles, etc.
// ==========================================================================

import React from 'react';

// --- Component Props ---

/**
 * Defines the possible color schemes/types for the Badge.
 * These should correspond to CSS classes (e.g., .badge-primary, .badge-critical).
 */
type BadgeType =
    | 'primary'
    | 'secondary'
    | 'success'
    | 'warning'
    | 'error'
    | 'info'
    | 'muted' // Generic gray/muted badge
    // Status specific
    | 'unassigned'
    | 'assigned'
    | 'progress'
    | 'closed'
    // Urgency specific
    | 'low'
    | 'medium'
    | 'high'
    | 'critical'
    // Role specific
    | 'admin'
    | 'staff';

/**
 * Props for the Badge component.
 */
interface BadgeProps {
    /** The content/text to display inside the badge. */
    children: React.ReactNode;
    /** The type of badge, determining its style (e.g., 'success', 'critical'). Defaults to 'muted'. */
    type?: BadgeType;
    /** Optional CSS class name for additional custom styling. */
    className?: string;
    /** Optional title attribute for tooltip on hover. */
    title?: string;
}

// --- Component ---

/**
 * Renders a small, styled badge, typically used for statuses, urgencies, or tags.
 *
 * @param {BadgeProps} props - The component props.
 * @returns {React.ReactElement} The rendered Badge component.
 */
const Badge: React.FC<BadgeProps> = ({
    children,
    type = 'muted', // Default to a muted/gray style
    className = '',
    title,
}) => {
    // --- Render ---
    // Construct the CSS class name based on the type and any additional classes
    // Assumes corresponding SCSS classes like .badge, .badge-critical, .status-badge, .urgency-badge exist
    // The specific base class (.status-badge, .urgency-badge, .role-badge) might need adjustment
    // depending on how the SCSS mixins/styles are applied. Using a generic .badge here.
    const badgeClass = `badge badge-${type} ${className}`;

    return (
    <span className={badgeClass} title={title}>
        {children}
    </span>
    );
};

export default Badge;
