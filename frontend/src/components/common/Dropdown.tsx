// src/components/common/Dropdown.tsx
// ==========================================================================
// Reusable Dropdown component.
// REVISED: Changed to click-based toggle using state and useEffect for outside clicks.
// ==========================================================================

import React, { useState, useEffect, useRef, ReactNode } from 'react'; // Import hooks

// --- Component Props ---
interface DropdownProps {
    trigger: ReactNode;
    children: ReactNode;
    className?: string;
    menuClassName?: string;
    position?: 'left' | 'right';
}

// --- Component ---
const Dropdown: React.FC<DropdownProps> = ({
    trigger,
    children,
    className = '',
    menuClassName = '',
    position = 'right',
}) => {
    // --- State ---
    const [isOpen, setIsOpen] = useState(false); // State to manage dropdown visibility
    const dropdownRef = useRef<HTMLDivElement>(null); // Ref to the dropdown container

    // --- Event Handlers ---
    const toggleDropdown = (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent triggering outside click listener
        setIsOpen(!isOpen);
    };

    // --- Effects ---
    // Effect to handle clicks outside the dropdown
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            // Close if clicked outside the dropdown container
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        // Add listener if dropdown is open
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        } else {
            // Remove listener if dropdown is closed
            document.removeEventListener('mousedown', handleClickOutside);
        }

        // Cleanup listener on component unmount or when isOpen changes
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]); // Re-run effect when isOpen changes

    // --- Render ---
    // Add 'is-open' class when state is true
    const dropdownClass = `dropdown ${className} ${isOpen ? 'is-open' : ''}`;
    const menuClass = `dropdown-menu dropdown-menu-${position} ${menuClassName}`;

    return (
        // Attach ref to the main container
        <div className={dropdownClass} ref={dropdownRef}>
            {/* Attach onClick handler to the trigger */}
            <div className="dropdown-toggle" onClick={toggleDropdown} role="button" aria-haspopup="true" aria-expanded={isOpen}>
                {trigger}
            </div>

            {/* The dropdown menu content (conditionally rendered or hidden via CSS) */}
            {/* CSS will handle display based on .is-open class */}
            <div className={menuClass}>
                {children}
            </div>
        </div>
    );
};

export default Dropdown;