// src/components/common/Dropdown.tsx
// ==========================================================================
// Reusable Dropdown component (basic example).
// Shows a menu when a trigger element is hovered or clicked.
// Note: This is a basic CSS-hover implementation. For robust accessibility
// and click handling, a library like Headless UI or Radix UI is recommended.
// ==========================================================================

import React from 'react';

// --- Component Props ---

/**
 * Props for the Dropdown component.
 */
interface DropdownProps {
    /** The element that triggers the dropdown (e.g., a button, user avatar). */
    trigger: React.ReactNode;
    /** The content of the dropdown menu. Typically contains links or buttons. */
    children: React.ReactNode;
    /** Optional CSS class name for the main dropdown container. */
    className?: string;
    /** Optional CSS class name for the dropdown menu itself. */
    menuClassName?: string;
    /** Position of the dropdown menu relative to the trigger. Defaults to 'right'. */
    position?: 'left' | 'right';
    /** Trigger mechanism. Defaults to 'hover'. */
    // triggerOn?: 'hover' | 'click'; // Click requires more state/event handling
}

// --- Component ---

/**
 * Renders a dropdown menu that appears when hovering over a trigger element.
 * NOTE: This is a simplified implementation using CSS :hover.
 * For production use, consider accessibility and click handling.
 *
 * @param {DropdownProps} props - The component props.
 * @returns {React.ReactElement} The rendered Dropdown component.
 */
const Dropdown: React.FC<DropdownProps> = ({
    trigger,
    children,
    className = '',
    menuClassName = '',
    position = 'right',
    // triggerOn = 'hover', // Basic implementation only supports hover via CSS
}) => {
    // --- State ---
    // State might be needed for click-based trigger or more complex interactions
    // const [isOpen, setIsOpen] = useState(false);

    // --- Render ---
    const dropdownClass = `dropdown ${className}`;
    const menuClass = `dropdown-menu dropdown-menu-${position} ${menuClassName}`;

    // Basic hover implementation relies on CSS: .dropdown:hover .dropdown-menu { display: block; }
    return (
    <div className={dropdownClass}>
        {/* The element that triggers the dropdown */}
        <div className="dropdown-toggle">
        {trigger}
        </div>

        {/* The dropdown menu content */}
        <div className={menuClass}>
        {children}
        </div>
    </div>
    );
};

export default Dropdown;
