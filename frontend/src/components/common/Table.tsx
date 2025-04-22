// src/components/common/Table.tsx
// ==========================================================================
// Reusable Table component for displaying data in rows and columns.
// Handles basic table structure (thead, tbody).
// ==========================================================================

import React from 'react';

// --- Component Props ---

/**
 * Represents the configuration for a single table column.
 */
export interface TableColumn<T> {
    /** Unique key for the column. */
    key: keyof T | string; // Allow string keys for custom columns (e.g., actions)
    /** Header label for the column. */
    header: string;
    /** Optional function to render custom content for a cell in this column. */
    render?: (item: T) => React.ReactNode;
    /** Optional CSS class name for the header cell (th). */
    headerClassName?: string;
    /** Optional CSS class name for the data cells (td) in this column. */
    cellClassName?: string;
}

/**
 * Props for the Table component.
 */
interface TableProps<T> {
    /** Array of data items to display in the table rows. */
    data: T[];
    /** Array of column configuration objects. */
    columns: TableColumn<T>[];
    /** Optional CSS class name for the table container. */
    containerClassName?: string;
    /** Optional CSS class name for the table element itself. */
    tableClassName?: string;
    /** Optional message or component to display when data array is empty. */
    emptyStateMessage?: React.ReactNode;
    /** Optional function to call when a table row is clicked. Receives the data item for that row. */
    onRowClick?: (item: T) => void;
}

// --- Component ---

/**
 * Renders a data table with configurable columns and optional empty state.
 * Uses global table styles defined in SCSS.
 *
 * @template T The type of data items in the table.
 * @param {TableProps<T>} props - The component props.
 * @returns {React.ReactElement} The rendered Table component.
 */
const Table = <T extends { id: string | number }>({ // Assume items have an id for key prop
    data,
    columns,
    containerClassName = '',
    tableClassName = '',
    emptyStateMessage = <p>No data available.</p>,
    onRowClick,
}: TableProps<T>): React.ReactElement => {

    // --- Render Logic ---

    // Determine if a row click handler is provided to add appropriate styling/cursor
    const isRowClickable = !!onRowClick;

    // --- Render ---
    const containerClass = `table-container ${containerClassName}`;
    const tableClass = `data-table ${tableClassName}`; // Use a specific class if needed

    return (
    <div className={containerClass}>
        <table className={tableClass}>
        {/* Table Header */}
        <thead>
            <tr>
            {columns.map((column) => (
                <th key={String(column.key)} className={column.headerClassName}>
                {column.header}
                </th>
            ))}
            </tr>
        </thead>

        {/* Table Body */}
        <tbody>
            {data.length === 0 ? (
            // Empty state row
            <tr>
                <td colSpan={columns.length} className="empty-state">
                {emptyStateMessage}
                </td>
            </tr>
            ) : (
            // Data rows
            data.map((item) => (
                <tr
                key={item.id}
                onClick={() => onRowClick?.(item)} // Optional row click handler
                className={isRowClickable ? 'clickable-row' : ''} // Add class if clickable
                style={isRowClickable ? { cursor: 'pointer' } : {}} // Add pointer cursor if clickable
                >
                {columns.map((column) => (
                    <td key={`${item.id}-${String(column.key)}`} className={column.cellClassName}>
                    {/* Render custom content if render function is provided, otherwise display data directly */}
                    {column.render
                        ? column.render(item)
                        : String(item[column.key as keyof T] ?? '')}
                    </td>
                ))}
                </tr>
            ))
            )}
        </tbody>
        </table>
    </div>
    );
};

export default Table;
