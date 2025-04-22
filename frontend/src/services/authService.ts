// src/services/authService.ts
// ==========================================================================
// Service functions for handling authentication-related API calls.
// ==========================================================================

import api from './api'; // Import the configured Axios instance
import { User, LoginFormInputs } from '../types'; // Import relevant types

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
    const response = await api.post<LoginResponse>('/auth/login', credentials);
    return response.data; // Return token and user object
    } catch (error) {
    console.error('Login API error:', error);
    // Rethrow the error to be handled by the calling component/hook
    throw error;
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
        const response = await api.get<User>('/auth/profile');
        return response.data;
    } catch (error) {
        console.error('Fetch user profile API error:', error);
        throw error;
    }
};

//TODO Add other auth-related functions if needed (e.g., register, refreshToken, forgotPassword)

