// src/hooks/useFormSubmit.ts
// ==========================================================================
// Custom hook to abstract common form submission logic.
// Handles loading state, error handling, success feedback, and API calls.
// ==========================================================================

import { useState, useCallback } from 'react';
import { AxiosError } from 'axios'; // Import AxiosError for better error typing

// --- Hook Configuration ---

/**
 * Defines the structure for the API submission function passed to the hook.
 * @template TData The type of data expected as input for the API call.
 * @template TResponse The type of response expected from the API call upon success.
 */
type SubmitFunction<TData, TResponse> = (data: TData) => Promise<TResponse>;

/**
 * Optional configuration options for the useFormSubmit hook.
 * @template TResponse The type of response expected from the API call.
 */
interface UseFormSubmitOptions<TResponse> {
    /** Callback function executed upon successful submission. Receives the API response. */
    onSuccess?: (response: TResponse) => void;
    /** Callback function executed upon submission error. Receives the error object. */
    onError?: (error: Error | AxiosError) => void;
    /** Optional success message to display via the hook's state. */
    successMessage?: string | null;
}

/**
 * Defines the return value structure of the useFormSubmit hook.
 */
interface UseFormSubmitResult<TData> {
    /** Boolean indicating if the submission is currently in progress. */
    isLoading: boolean;
    /** Error object or message if the last submission failed, otherwise null. */
    error: string | null;
    /** Success message if provided in options and submission was successful, otherwise null. */
    successMessage: string | null;
    /** Function to trigger the form submission process. Takes the form data as input. */
    submit: (data: TData) => Promise<void>;
    /** Function to manually clear the error state. */
    clearError: () => void;
    /** Function to manually clear the success message state. */
    clearSuccessMessage: () => void;
}

// --- Custom Hook Implementation ---

/**
 * Custom hook `useFormSubmit`
 *
 * Encapsulates the logic for handling asynchronous form submissions,
 * including loading states, error handling, success messages, and API calls.
 *
 * @template TData The type of data passed to the submission function.
 * @template TResponse The type of response expected from the submission function.
 * @param {SubmitFunction<TData, TResponse>} submitFn The asynchronous function that performs the API call.
 * @param {UseFormSubmitOptions<TResponse>} [options={}] Optional configuration for callbacks and messages.
 * @returns {UseFormSubmitResult<TData>} An object containing state and functions for form submission.
 */
export const useFormSubmit = <TData, TResponse>(
    submitFn: SubmitFunction<TData, TResponse>,
    options: UseFormSubmitOptions<TResponse> = {}
): UseFormSubmitResult<TData> => {
    // --- Options ---
    const { onSuccess, onError, successMessage: successMsgOption = null } = options;

    // --- State ---
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // --- Callbacks ---
    /**
     * Clears the current error state.
     */
    const clearError = useCallback(() => setError(null), []);

    /**
     * Clears the current success message state.
     */
    const clearSuccessMessage = useCallback(() => setSuccessMessage(null), []);

    /**
     * The main submission handler function returned by the hook.
     * @param data - The data to be passed to the `submitFn`.
     */
    const submit = useCallback(async (data: TData): Promise<void> => {
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
        const response = await submitFn(data);
        setSuccessMessage(successMsgOption); // Set success message from options
        onSuccess?.(response); // Call success callback if provided
    } catch (err: unknown) {
        console.error("Form submission error:", err);
        let errorMessage = 'An unexpected error occurred.';
        // Type guard for AxiosError
        if (typeof err === 'object' && err !== null && 'isAxiosError' in err && err.isAxiosError) {
            const axiosError = err as AxiosError<any>; // Type assertion
            errorMessage = axiosError.response?.data?.message || axiosError.message || 'Request failed.';
        } else if (err instanceof Error) {
            errorMessage = err.message;
        }
        setError(errorMessage);
        onError?.(err as Error | AxiosError); // Call error callback if provided
    } finally {
        setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [submitFn, onSuccess, onError, successMsgOption]); // Dependencies for useCallback

    // --- Return Value ---
    return {
    isLoading,
    error,
    successMessage,
    submit,
    clearError,
    clearSuccessMessage,
    };
};
