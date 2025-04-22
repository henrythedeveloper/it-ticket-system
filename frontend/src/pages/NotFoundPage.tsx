// src/pages/NotFoundPage.tsx
// ==========================================================================
// Component displayed when a route is not found (404 error).
// ==========================================================================

import React from 'react';
import { Link } from 'react-router-dom';
import Button from '../components/common/Button'; // Reusable Button
import { AlertTriangle } from 'lucide-react'; // Icon

// --- Component ---

/**
 * Renders a standard 404 Not Found page.
 */
const NotFoundPage: React.FC = () => {
    // --- Render ---
    // Basic styling for centering, assuming some global styles might apply
    // Or add specific styles via a dedicated SCSS file if needed
    const containerStyle: React.CSSProperties = {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '80vh', // Take up most viewport height
        textAlign: 'center',
        padding: '2rem',
        color: 'var(--text-secondary)', // Use theme variable
    };

    const iconStyle: React.CSSProperties = {
        color: 'var(--warning-color)', // Use theme variable
        marginBottom: '1rem',
    };

    const headingStyle: React.CSSProperties = {
        color: 'var(--text-primary)', // Use theme variable
        marginBottom: '0.5rem',
    };

    const paragraphStyle: React.CSSProperties = {
        marginBottom: '1.5rem',
    };


    return (
    <div style={containerStyle} className="not-found-page">
        <AlertTriangle size={64} style={iconStyle} />
        <h1 style={headingStyle}>404 - Page Not Found</h1>
        <p style={paragraphStyle}>
        Sorry, the page you are looking for does not exist or may have been moved.
        </p>
        <Link to="/"> {/* Link back to homepage or dashboard */}
        <Button variant="primary">
            Go Back Home
        </Button>
        </Link>
    </div>
    );
};

export default NotFoundPage;
