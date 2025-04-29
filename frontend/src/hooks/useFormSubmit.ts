// src/hooks/useFormSubmit.ts
// ==========================================================================
// Custom hook to abstract common form submission logic.
// Handles loading state, error handling, success feedback, and API calls.
// **REVISED**: Ensure FormData is passed directly to submitFn without modification.
// ==========================================================================

import { useState, useCallback } from 'react';
import { AxiosError } from 'axios';

// --- Hook Configuration ---
type SubmitFunction<TData, TResponse> = (data: TData) => Promise<TResponse>;

interface UseFormSubmitOptions<TResponse> {
    onSuccess?: (response: TResponse) => void;
    onError?: (error: Error | AxiosError) => void;
    successMessage?: string | null;
}

interface UseFormSubmitResult<TData> {
    isLoading: boolean;
    error: string | null;
    successMessage: string | null;
    submit: (data: TData) => Promise<void>;
    clearError: () => void;
    clearSuccessMessage: () => void;
}

// --- Custom Hook Implementation ---
export const useFormSubmit = <TData, TResponse>(
    submitFn: SubmitFunction<TData, TResponse>,
    options: UseFormSubmitOptions<TResponse> = {}
): UseFormSubmitResult<TData> => {
    const { onSuccess, onError, successMessage: successMsgOption = null } = options;

    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const clearError = useCallback(() => setError(null), []);
    const clearSuccessMessage = useCallback(() => setSuccessMessage(null), []);

    const submit = useCallback(async (data: TData): Promise<void> => {
        // Basic check to prevent accidental event object submission
        if (typeof data === 'object' && data !== null && !(data instanceof FormData) && typeof (data as any).preventDefault === 'function') {
            console.error('[useFormSubmit] Error: Submit function received an event object instead of data. Aborting submission.', data);
            setError('Internal error: Invalid form submission.');
            setIsLoading(false);
            return;
        }

        // Log the data type being submitted
        const dataType = data instanceof FormData ? 'FormData' : typeof data;
        console.log(`[useFormSubmit] Submit called with data type: ${dataType}`, data instanceof FormData ? '(FormData content not fully loggable)' : data);

        setIsLoading(true);
        setError(null);
        setSuccessMessage(null);

        try {
            console.log('[useFormSubmit] Calling submitFn...');
            // ** Ensure 'data' is passed directly to submitFn **
            // No JSON.stringify or other processing should happen here if data is FormData
            const response = await submitFn(data);
            console.log('[useFormSubmit] submitFn successful. Response:', response); // Response might be JSON

            setSuccessMessage(successMsgOption);

            console.log('[useFormSubmit] About to call onSuccess callback...');
            if (onSuccess) {
                onSuccess(response);
                console.log('[useFormSubmit] onSuccess callback executed.');
            } else {
                console.log('[useFormSubmit] No onSuccess callback provided.');
            }

        } catch (err: unknown) {
            console.error("[useFormSubmit] Form submission error caught in hook:", err);
            let errorMessage = 'An unexpected error occurred.';
            if (typeof err === 'object' && err !== null && 'isAxiosError' in err && err.isAxiosError) {
                const axiosError = err as AxiosError<any>;
                errorMessage = axiosError.response?.data?.message || axiosError.message || 'Request failed.';
            } else if (err instanceof Error) {
                errorMessage = err.message;
            }
            setError(errorMessage);

            console.log('[useFormSubmit] About to call onError callback...');
            if (onError) {
                onError(err as Error | AxiosError);
                console.log('[useFormSubmit] onError callback executed.');
            } else {
                console.log('[useFormSubmit] No onError callback provided.');
            }

        } finally {
            console.log('[useFormSubmit] Setting isLoading to false.');
            setIsLoading(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [submitFn, onSuccess, onError, successMsgOption]); // Dependencies for useCallback

    return {
        isLoading,
        error,
        successMessage,
        submit,
        clearError,
        clearSuccessMessage,
    };
};
