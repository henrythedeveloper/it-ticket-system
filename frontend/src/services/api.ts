// src/services/api.ts
// ==========================================================================
// Axios instance setup and configuration for API communication.
// Includes base URL, interceptors for adding auth tokens and handling errors.
// **REVISED**: Removed default 'Content-Type' header to allow Axios to set
//              it automatically (e.g., for FormData uploads).
// ==========================================================================

import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosError } from 'axios';
import { useAuthStore } from '../store/authStore'; // Zustand store for auth state

// --- Constants ---
const API_BASE_URL = import.meta.env.PUBLIC_API_URL || 'http://localhost:8080/api';

// --- Create Axios Instance ---
/**
 * Base Axios instance configured for the application's API.
 */
const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  // ** REMOVED default Content-Type header **
  // headers: {
  //   'Content-Type': 'application/json', // <-- REMOVE THIS LINE
  // },
  // timeout: 10000, // Optional: Add a request timeout
});

// --- Request Interceptor ---
// Intercepts requests before they are sent to add the authentication token.
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = useAuthStore.getState().token;

    // Add auth token if available
    if (token && config.headers) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }

    // ** Important: Do NOT manually set Content-Type here if data is FormData **
    // Axios will handle setting 'multipart/form-data' with the correct boundary
    // automatically when the 'data' payload is a FormData instance.
    // If you were setting it here previously, remove that logic as well.

    return config;
  },
  (error: AxiosError) => {
    console.error('Axios request error:', error);
    return Promise.reject(error);
  }
);

// --- Response Interceptor ---
// Intercepts responses to handle common scenarios like authorization errors.
api.interceptors.response.use(
  (response) => {
    // Successful response
    return response;
  },
  (error: AxiosError) => {
    // Handle errors
    console.error('Axios response error:', error.response?.status, error.message);
    if (error.response?.status === 401) {
      console.warn('Unauthorized request (401). Logging out.');
      useAuthStore.getState().logout();
    } else if (error.response?.status === 403) {
      console.warn('Forbidden request (403). User lacks permission.');
    }
    return Promise.reject(error);
  }
);

export default api;
