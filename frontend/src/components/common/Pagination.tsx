// src/components/common/Pagination.tsx
// ==========================================================================
// Reusable Pagination component for navigating through paginated data.
// ==========================================================================

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react'; // Icons

// --- Component Props ---

/**
 * Props for the Pagination component.
 */
interface PaginationProps {
    /** The current active page number (1-based). */
    currentPage: number;
    /** The total number of pages available. */
    totalPages: number;
    /** Function to call when the page changes. Receives the new page number as an argument. */
    onPageChange: (page: number) => void;
    /** Optional CSS class name for the container. */
    className?: string;
}

// --- Component ---

/**
 * Renders pagination controls (Previous/Next buttons, page numbers - basic version).
 * Allows users to navigate between pages of data.
 *
 * @param {PaginationProps} props - The component props.
 * @returns {React.ReactElement | null} The rendered Pagination component or null if only one page.
 */
const Pagination: React.FC<PaginationProps> = ({
    currentPage,
    totalPages,
    onPageChange,
    className = '',
}) => {
    // --- Logic ---
    // Don't render pagination if there's only one page or less
    if (totalPages <= 1) {
    return null;
    }

    // --- Event Handlers ---
    const handlePrevious = () => {
    if (currentPage > 1) {
        onPageChange(currentPage - 1);
    }
    };

    const handleNext = () => {
    if (currentPage < totalPages) {
        onPageChange(currentPage + 1);
    }
    };

    // --- Render ---
    const paginationClass = `pagination ${className}`;

    return (
    <nav className={paginationClass} aria-label="Pagination">
        {/* Previous Button */}
        <button
        onClick={handlePrevious}
        disabled={currentPage === 1}
        className="pagination-button prev-button"
        aria-label="Go to previous page"
        >
        <ChevronLeft size={18} />
        <span>Previous</span>
        </button>

        {/* Page Number Display (Simple Version) */}
        <span className="pagination-info" aria-live="polite">
        Page {currentPage} of {totalPages}
        </span>
        {/* TODO: Add more complex page number rendering if needed (e.g., first, last, ellipsis) */}

        {/* Next Button */}
        <button
        onClick={handleNext}
        disabled={currentPage === totalPages}
        className="pagination-button next-button"
        aria-label="Go to next page"
        >
        <span>Next</span>
        <ChevronRight size={18} />
        </button>
    </nav>
    );
};

export default Pagination;
