// src/store/authStore.ts
// ==========================================================================
// Zustand store for managing global authentication state.
// Includes user info, token, auth status, and actions.
// Persists token to localStorage.
// **REVISED**: Removed explicit isAuthenticated state; derived from user object.
// ==========================================================================

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { User } from '../types'; // Shared types

// --- Store State and Actions Interface ---

/**
 * Defines the shape of the authentication store's state.
 * isAuthenticated is no longer stored directly.
 */
interface AuthStoreState {
    user: User | null;
    token: string | null;
    loading: boolean; // For initial auth check
}

/**
 * Defines the actions available in the authentication store.
 */
interface AuthStoreActions {
    login: (token: string, user: User) => void;
    logout: () => void;
    setUser: (user: User | null) => void;
    setToken: (token: string | null) => void; // Keep for potential direct token updates
    setLoading: (loading: boolean) => void;
}

/**
 * Combined interface for the Zustand store.
 */
interface AuthStore extends AuthStoreState, AuthStoreActions {}

// --- Store Implementation ---

/**
 * Zustand store for authentication.
 * - Manages `user`, `token`, `loading` state.
 * - Provides `login`, `logout`, `setUser`, `setToken`, `setLoading` actions.
 * - Persists only the `token` to localStorage.
 */
export const useAuthStore = create<AuthStore>()(
    persist(
    (set) => ({
        // --- Initial State ---
        user: null,
        token: null,
        loading: true, // Start loading until initial check completes

        // --- Actions ---
        login: (token, user) => {
          if (!token || !user) {
            console.error('[AuthStore] Login called with missing token or user');
            return;
          }
          console.log('[AuthStore] Login action called.');
          // Set token, user, and mark loading as complete
          set({ token, user, loading: false });
          console.log('AuthStore: User logged in successfully');
        },

        logout: () => {
          console.log('[AuthStore] Logout action called.');
          // Clear user, token, and mark loading as complete (or false)
          set({ user: null, token: null, loading: false });
          console.log('AuthStore: User logged out.');
        },

        setUser: (user) => set({ user }),

        setToken: (token) => set({ token }), // Only sets token

        setLoading: (loading) => set({ loading }),

    }),
    {
        // --- Persistence Configuration ---
        name: 'auth-storage',
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({ token: state.token }), // Only persist the token
        onRehydrateStorage: () => {
            console.log('AuthStore: Hydration started...');
            return (state, error) => {
                if (error) {
                    console.error('AuthStore: Failed to rehydrate state from storage!', error);
                     // Ensure loading is false even if hydration fails
                    useAuthStore.setState({ loading: false });
                } else {
                    console.log('AuthStore: Hydration finished.');
                    // Loading state will be managed by the AuthContext effect now
                }
            };
        },
    }
    )
);
