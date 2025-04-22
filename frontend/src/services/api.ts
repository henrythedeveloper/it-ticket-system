// src/services/api.ts
// ==========================================================================
// Axios instance setup and configuration for API communication.
// Includes base URL, interceptors for adding auth tokens and handling errors.
// ==========================================================================

import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosError } from 'axios';
import { useAuthStore } from '../store/authStore'; // Zustand store for auth state

// --- Constants ---
// Determine API base URL from environment variables (Vite specific)
// Fallback to a default development URL if not set.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

// --- Create Axios Instance ---
/**
 * Base Axios instance configured for the application's API.
 */
const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    // Other default headers can be added here
  },
  // timeout: 10000, // Optional: Add a request timeout
});

// --- Request Interceptor ---
// Intercepts requests before they are sent to add the authentication token.
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Get the token from the Zustand auth store
    const token = useAuthStore.getState().token;

    // If a token exists, add it to the Authorization header
    if (token && config.headers) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config; // Continue with the modified request config
  },
  (error: AxiosError) => {
    // Handle request configuration errors (e.g., invalid headers)
    console.error('Axios request error:', error);
    return Promise.reject(error);
  }
);

// --- Response Interceptor ---
// Intercepts responses to handle common scenarios like authorization errors.
api.interceptors.response.use(
  (response) => {
    // Any status code within the range of 2xx causes this function to trigger
    // Simply return the successful response
    return response;
  },
  (error: AxiosError) => {
    // Any status codes outside the range of 2xx cause this function to trigger
    console.error('Axios response error:', error.response?.status, error.message);

    // Handle specific error statuses
    if (error.response?.status === 401) {
      // Unauthorized: Token might be invalid or expired.
      // Clear the auth state using the Zustand store's logout action.
      // Redirecting to login is usually handled by components checking auth state.
      console.warn('Unauthorized request (401). Logging out.');
      useAuthStore.getState().logout();
      // Optional: Could trigger a redirect here, but often better handled in UI layer
      // window.location.href = '/login';
    } else if (error.response?.status === 403) {
      // Forbidden: User does not have permission for this action.
      console.warn('Forbidden request (403). User lacks permission.');
      // Optional: Show a notification to the user
    }
    // ... handle other common errors like 500, 404 etc. if needed ...

    // Reject the promise so the error can be caught by the calling function
    return Promise.reject(error);
  }
);

export default api;
