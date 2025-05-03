// src/services/authService.ts
// ==========================================================================
// Service functions for handling authentication-related API calls.
// **FIXED**: Changed fetchUserProfile endpoint from /auth/profile to /users/me.
// ==========================================================================

import api from './api'; // Import the configured Axios instance
import { User, LoginFormInputs } from '../types'; // Import relevant types
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
        interface APIResponse {
            success: boolean;
            message: string;
            data: {
                access_token: string;
                token_type: string;
                expires_at: string;
                user: User;
            };
        }

        // Make the POST request to the login endpoint
        const response = await api.post<APIResponse>('/auth/login', credentials);
        const { data } = response.data; // Extract the nested data object

        // Return the token and user details in the expected LoginResponse format
        return {
            token: data.access_token,
            user: keysToCamel(data.user)
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
        const response = await api.get('/users/me');
        // The backend returns { success, data }, so return only the user object
        return keysToCamel(response.data.data);
    } catch (error) {
        // Handle potential errors during profile fetch
        console.error('Fetch user profile API error:', error);
        // Re-throw the error to be handled by the calling code (e.g., AuthContext)
        throw error;
    }
};

// TODO: Add other auth-related functions if needed (e.g., register, refreshToken, forgotPassword)

