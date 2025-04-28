// src/store/authStore.ts
// ==========================================================================
// Zustand store for managing global authentication state.
// Includes user info, token, auth status, and actions.
// Persists token to localStorage.
// ==========================================================================

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { AuthState, User } from '../types'; // Shared types
// Note: API calls (like fetchUserProfile) should ideally be done in components/hooks
// or dedicated action creators, not directly within the store state definition.
// The context provider (AuthContext.tsx) currently handles the initial profile fetch.

// --- Store State and Actions Interface ---

/**
 * Defines the shape of the authentication store, including state and actions.
 */
interface AuthStore extends AuthState {
    loading: boolean; // Added loading state for initial check
    login: (token: string, user: User) => void;
    logout: () => void;
    setUser: (user: User | null) => void;
    setToken: (token: string | null) => void;
    setLoading: (loading: boolean) => void;
    checkAuthStatus: () => void; // Action to potentially re-validate or load initial state
}

// --- Store Implementation ---

/**
 * Zustand store for authentication.
 * - Manages `user`, `token`, `isAuthenticated`, `loading` state.
 * - Provides `login`, `logout`, `setUser`, `setToken`, `setLoading`, `checkAuthStatus` actions.
 * - Persists only the `token` to localStorage.
 */
export const useAuthStore = create<AuthStore>()(
    persist(
    (set, get) => ({
        // --- Initial State ---
        user: null,
        token: null,
        isAuthenticated: false,
        loading: true, // Start in loading state until initial check is done

        // --- Actions ---
        /**
         * Updates state upon successful login.
         * @param token - The authentication token received from the API.
         * @param user - The user object received from the API.
         */
        login: (token, user) => {
          if (!token || !user) {
            console.error('[AuthStore] Login called with missing token or user');
            return;
          }
          console.log('[AuthStore] Login action called. Setting state:', { token: !!token, user: !!user });
          // Set all state at once to prevent race conditions
          set({
            token,
            user,
            isAuthenticated: true,
            loading: false
          });
          console.log('AuthStore: User logged in successfully');
        },

        /**
         * Clears authentication state upon logout.
         */
        logout: () => {
        // Clear token from localStorage (handled by persist middleware via setting null)
        // Reset state
        console.log('[AuthStore] Logout action called. Clearing state.');
        set({ user: null, token: null, isAuthenticated: false, loading: false });
        console.log('AuthStore: User logged out.');
            // Optionally clear other related application state here if needed
        },

        /**
         * Updates the user object in the state.
         * @param user - The new user object or null.
         */
        setUser: (user) => set({ user }),

        /**
         * Updates the token in the state (and localStorage via middleware).
         * @param token - The new token or null.
         */
        setToken: (token) => set({ token, isAuthenticated: !!token }),

        /**
         * Sets the loading state, typically used during initial auth check.
         * @param loading - Boolean indicating loading status.
         */
        setLoading: (loading) => set({ loading }),

        /**
         * Checks the initial authentication status.
         * NOTE: The primary logic for this moved to AuthContext.tsx for better integration
         * with async profile fetching. This function might be simplified or removed
         * if AuthContext handles everything reliably.
         */
        checkAuthStatus: () => {
            // Logic example if kept here (simpler version):
            const token = get().token; // Get token possibly restored from localStorage
            if (token) {
                // Assume authenticated if token exists, profile fetch validates
                set({ isAuthenticated: true });
                console.log('AuthStore: Initial check found token.');
            } else {
                set({ isAuthenticated: false });
                console.log('AuthStore: Initial check found no token.');
            }
            set({ loading: false }); // Mark initial check as complete
        },
    }),
    {
        // --- Persistence Configuration ---
        name: 'auth-storage', // Unique name for localStorage key
        storage: createJSONStorage(() => localStorage), // Use localStorage
        partialize: (state) => ({ token: state.token }), // Only persist the token
        onRehydrateStorage: () => {
            console.log('AuthStore: Hydration started...');
            return (state, error) => {
            if (error) {
                console.error('AuthStore: Failed to rehydrate state from storage!', error);
            } else if (state) {
                console.log('AuthStore: Hydration finished.');
                // state.checkAuthStatus(); // Initial check could potentially run here after rehydration
                                            // But prefer handling in AuthContext effect for async needs
            } else {
                console.log('AuthStore: No persisted state found during hydration.');
                // Ensure loading is set correctly if no state is hydrated
                useAuthStore.setState({ loading: false });
            }
            };
        },
    }
    )
);
