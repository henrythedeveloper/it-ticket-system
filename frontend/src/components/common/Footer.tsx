// src/components/common/Footer.tsx
// ==========================================================================
// Reusable Footer component for application layouts.
// Displays copyright information and potentially links.
// ==========================================================================

import React from 'react';
import { Link } from 'react-router-dom'; // Assuming usage of React Router for links

// --- Component Props ---

/**
 * Props for the Footer component.
 * Currently simple, but could be extended for more complex footers.
 */
interface FooterProps {
    /** Optional CSS class name for custom styling. */
    className?: string;
}

// --- Component ---

/**
 * Renders the application footer.
 * Includes copyright notice and potentially navigation links.
 * Assumes corresponding styles are defined in SCSS (e.g., .public-footer).
 *
 * @param {FooterProps} props - The component props.
 * @returns {React.ReactElement} The rendered Footer component.
 */
const Footer: React.FC<FooterProps> = ({ className = '' }) => {
    // --- Render ---
    const currentYear = new Date().getFullYear();
    const footerClass = `public-footer ${className}`; // Use class from PublicLayout SCSS

    return (
    <footer className={footerClass}>
        {/* Optional: Add footer content sections like in PublicLayout SCSS */}
        {/* <div className="footer-content"> ... sections ... </div> */}

        {/* Bottom copyright section */}
        <div className="footer-bottom">
        <p>
            &copy; {currentYear} HelpDesk System. All rights reserved. |{' '}
            <Link to="/privacy">Privacy Policy</Link> |{' '}
            <Link to="/terms">Terms of Service</Link>
        </p>
        </div>
    </footer>
    );
};

export default Footer;
