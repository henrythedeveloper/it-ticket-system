// src/utils/helpers.ts
// ==========================================================================
// General utility functions used across the application.
// Updated buildQueryString type.
// ==========================================================================

import { format, parseISO, differenceInDays, formatDistanceToNow } from 'date-fns';

// --------------------------------------------------------------------------
// Date Formatting Functions
// --------------------------------------------------------------------------

/**
 * Formats an ISO date string into a more readable format (e.g., "Apr 21, 2025").
 * @param isoDateString - The ISO date string to format.
 * @param dateFormat - The desired date format string (defaults to 'MMM d, yyyy').
 * @returns The formatted date string, or an empty string if input is invalid.
 */
export const formatDate = (isoDateString?: string | null, dateFormat = 'MMM d, yyyy'): string => {
    if (!isoDateString) {
    return '';
    }
    try {
    const date = parseISO(isoDateString);
    return format(date, dateFormat);
    } catch (error) {
    console.error("Error formatting date:", isoDateString, error);
    return ''; // Return empty string or a placeholder on error
    }
};

/**
 * Formats an ISO date string into a date and time format (e.g., "Apr 21, 2025, 6:58 PM").
 * @param isoDateString - The ISO date string to format.
 * @param dateTimeFormat - The desired format string (defaults to 'MMM d, yyyy, h:mm a').
 * @returns The formatted date and time string, or an empty string if input is invalid.
 */
export const formatDateTime = (isoDateString?: string | null, dateTimeFormat = 'MMM d, yyyy, h:mm a'): string => {
    if (!isoDateString) {
        return '';
        }
        try {
        const date = parseISO(isoDateString);
        return format(date, dateTimeFormat);
        } catch (error) {
        console.error("Error formatting date/time:", isoDateString, error);
        return '';
        }
};

/**
 * Formats an ISO date string to show relative time distance (e.g., "about 2 hours ago").
 * @param isoDateString - The ISO date string.
 * @returns A string representing the relative time, or an empty string if input is invalid.
 */
export const formatRelativeTime = (isoDateString?: string | null): string => {
    if (!isoDateString) {
        return '';
    }
    try {
        const date = parseISO(isoDateString);
        return formatDistanceToNow(date, { addSuffix: true });
    } catch (error) {
        console.error("Error formatting relative time:", isoDateString, error);
        return '';
    }
    };

/**
 * Calculates the difference in days between a date and now.
 * Useful for determining if something is overdue.
 * @param isoDateString - The ISO date string to compare.
 * @returns The number of days difference (positive if future, negative if past), or null if invalid.
 */
export const daysUntil = (isoDateString?: string | null): number | null => {
    if (!isoDateString) {
        return null;
    }
    try {
        const date = parseISO(isoDateString);
        // Compare against the start of today for consistent "overdue" calculation
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return differenceInDays(date, today);
    } catch (error) {
        console.error("Error calculating days until:", isoDateString, error);
        return null;
    }
};


// --------------------------------------------------------------------------
// String Manipulation Functions
// --------------------------------------------------------------------------

/**
 * Truncates a string to a specified maximum length and adds ellipsis if truncated.
 * @param str - The string to truncate.
 * @param maxLength - The maximum allowed length.
 * @returns The truncated string (with ellipsis) or the original string.
 */
export const truncateString = (str: string | null | undefined, maxLength: number): string => {
    if (!str) {
    return '';
    }
    if (str.length <= maxLength) {
    return str;
    }
    return str.substring(0, maxLength) + '...';
};

/**
 * Generates initials from a name string.
 * @param name - The full name string.
 * @returns A string containing the initials (usually 1 or 2 characters).
 */
export const getInitials = (name?: string | null): string => {
    if (!name) {
        return '?';
    }
    const nameParts = name.trim().split(' ');
    if (nameParts.length === 1) {
        return nameParts[0].charAt(0).toUpperCase();
    }
    const firstNameInitial = nameParts[0].charAt(0);
    const lastNameInitial = nameParts[nameParts.length - 1].charAt(0);
    return `${firstNameInitial}${lastNameInitial}`.toUpperCase();
    };

// --------------------------------------------------------------------------
// Other Utility Functions
// --------------------------------------------------------------------------

/**
 * Formats a file size in bytes into a human-readable string (KB, MB, GB).
 * @param bytes - The file size in bytes.
 * @param decimals - The number of decimal places to display (default is 2).
 * @returns A human-readable file size string.
 */
export const formatBytes = (bytes: number, decimals = 2): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

/**
 * Simple debounce function.
 * @param func - The function to debounce.
 * @param delay - The debounce delay in milliseconds.
 * @returns A debounced version of the function.
 */
export const debounce = <T extends (...args: any[]) => void>(func: T, delay: number) => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    return (...args: Parameters<T>) => {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
        timeoutId = setTimeout(() => {
            func(...args);
        }, delay);
    };
};

/**
 * Creates a URL query string from an object of parameters, filtering out null/undefined values.
 * @param params - An object containing query parameters. Accepts any object with string keys.
 * @returns A URL query string (e.g., "?status=Open&page=1").
 */
// FIX: Changed parameter type to Record<string, any> for more flexibility
export const buildQueryString = (params: Record<string, any>): string => {
    const query = Object.entries(params)
        // Filter out null, undefined, or empty string values before encoding
        .filter(([_, value]) => value !== null && value !== undefined && value !== '')
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
        .join('&');
    return query ? `?${query}` : '';
};

/**
 * Recursively converts all object keys from snake_case to camelCase.
 * Handles arrays, nested objects, and leaves primitives untouched.
 * @param obj - The object or array to convert.
 * @returns A new object/array with camelCase keys.
 */
export function keysToCamel<T = any>(obj: any): T {
    if (Array.isArray(obj)) {
        return obj.map(keysToCamel) as any;
    } else if (obj && typeof obj === 'object' && obj.constructor === Object) {
        const newObj: any = {};
        Object.keys(obj).forEach((key) => {
            const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
            newObj[camelKey] = keysToCamel(obj[key]);
        });
        return newObj;
    }
    return obj;
}

