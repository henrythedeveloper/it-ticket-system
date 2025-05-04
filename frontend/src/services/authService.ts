// src/services/authService.ts
// ==========================================================================
// Service functions for handling authentication-related API calls.
// **REVISED**: Added register, requestPasswordReset, resetPassword functions.
// ==========================================================================

import api from './api'; // Import the configured Axios instance
import { User, LoginFormInputs, UserRegister, PasswordResetRequest, PasswordResetPayload, APIResponse } from '../types'; // Import relevant types
import { keysToCamel } from '../utils/helpers'; // Import keysToCamel

/**
 * Represents the expected response structure for a successful login.
 */
interface LoginResponse {
    token: string;
    user: User;
}

// --- Service Functions ---

/**
 * Sends login credentials to the API.
 * @param credentials - The user's login credentials (email, password).
 * @returns A Promise resolving with the LoginResponse (token and user data).
 */
export const login = async (credentials: LoginFormInputs): Promise<LoginResponse> => {
    try {
        // Define the expected structure of the backend's login API response
        interface APILoginResponse {
            success: boolean;
            message: string;
            data: {
                access_token: string;
                token_type: string;
                expires_at: string;
                user: any; // Use 'any' initially, then map
            };
        }

        // Make the POST request to the login endpoint
        const response = await api.post<APILoginResponse>('/auth/login', credentials);
        const { data } = response.data; // Extract the nested data object

        if (!data || !data.access_token || !data.user) {
            throw new Error("Invalid login response structure from API.");
        }

        // Return the token and user details in the expected LoginResponse format
        return {
            token: data.access_token,
            user: keysToCamel<User>(data.user) // Map user data
        };
    } catch (error: any) {
        // Handle potential errors during login
        const errorMessage = error.response?.data?.message || error.message || 'Login failed';
        console.error('Login API error:', {
            message: errorMessage,
            response: error.response?.data,
            error
        });
        // Throw a new error with a user-friendly message
        throw new Error(errorMessage);
    }
};

/**
 * Fetches the profile of the currently authenticated user.
 * Assumes the auth token is added by the Axios interceptor.
 * @returns A Promise resolving with the User object.
 */
export const fetchUserProfile = async (): Promise<User> => {
    try {
        // The token is automatically added by the interceptor
        // Backend returns { success, data: User }
        const response = await api.get<APIResponse<any>>('/users/me');

        if (!response.data?.success || !response.data.data) {
             throw new Error(response.data?.message || "Failed to fetch user profile.");
        }
        return keysToCamel<User>(response.data.data);
    } catch (error: any) {
        // Handle potential errors during profile fetch
        const errorMessage = error.response?.data?.message || error.message || 'Failed to fetch profile.';
        console.error('Fetch user profile API error:', { message: errorMessage, error });
        // Re-throw the error to be handled by the calling code (e.g., AuthContext)
        throw new Error(errorMessage);
    }
};

/**
 * Sends registration details to the API.
 * @param registrationData - User's name, email, and password.
 * @returns A Promise resolving with the newly created User object.
 */
export const register = async (registrationData: UserRegister): Promise<User> => {
    try {
        // Backend returns { success, message, data: User }
        const response = await api.post<APIResponse<any>>('/auth/register', registrationData);

        if (!response.data?.success || !response.data.data) {
            throw new Error(response.data?.message || "Registration failed.");
        }
        return keysToCamel<User>(response.data.data);
    } catch (error: any) {
        const errorMessage = error.response?.data?.message || error.message || 'Registration failed.';
        console.error('Registration API error:', { message: errorMessage, error });
        throw new Error(errorMessage);
    }
};

/**
 * Sends a request to the API to initiate the password reset process for an email.
 * @param resetRequest - Object containing the user's email.
 * @returns A Promise resolving with the API response message.
 */
export const requestPasswordReset = async (resetRequest: PasswordResetRequest): Promise<string> => {
    try {
        // Backend returns { success, message }
        const response = await api.post<APIResponse<never>>('/auth/forgot-password', resetRequest);

        if (!response.data?.success) {
            throw new Error(response.data?.message || "Password reset request failed.");
        }
        return response.data.message || "Password reset request sent successfully."; // Return the success message
    } catch (error: any) {
        const errorMessage = error.response?.data?.message || error.message || 'Password reset request failed.';
        console.error('Request password reset API error:', { message: errorMessage, error });
        throw new Error(errorMessage);
    }
};

/**
 * Sends the password reset token and new password to the API.
 * @param resetPayload - Object containing the token and new password details.
 * @returns A Promise resolving with the API response message.
 */
export const resetPassword = async (resetPayload: PasswordResetPayload): Promise<string> => {
    try {
        // Backend returns { success, message }
        const response = await api.post<APIResponse<never>>('/auth/reset-password', resetPayload);

        if (!response.data?.success) {
            throw new Error(response.data?.message || "Password reset failed.");
        }
        return response.data.message || "Password reset successfully."; // Return the success message
    } catch (error: any) {
        const errorMessage = error.response?.data?.message || error.message || 'Password reset failed.';
        console.error('Reset password API error:', { message: errorMessage, error });
        throw new Error(errorMessage);
    }
};

