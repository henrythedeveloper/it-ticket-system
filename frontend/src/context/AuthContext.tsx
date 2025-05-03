// src/context/AuthContext.tsx
// ==========================================================================
// Provides authentication state and actions to the application using React Context
// and integrates with the Zustand auth store.
// Handles initial authentication check on app load.
// **REVISED**: Derives isAuthenticated, simplifies effect, waits for loading.
// ==========================================================================

import React, { createContext, useEffect, ReactNode, useMemo } from 'react';
import { useAuthStore } from '../store/authStore';
import { AuthContextType, User } from '../types';
import { fetchUserProfile } from '../services/authService';
import Loader from '../components/common/Loader'; // Import Loader

// --- Create Context ---
export const AuthContext = createContext<AuthContextType | undefined>(undefined);

// --- Context Provider Component ---
interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  // --- Get State & Actions from Store ---
  // Use individual selectors for better performance if components re-render often
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const loading = useAuthStore((state) => state.loading);
  const storeLogin = useAuthStore((state) => state.login);
  const storeLogout = useAuthStore((state) => state.logout);
  const storeSetUser = useAuthStore((state) => state.setUser);
  const setLoading = useAuthStore((state) => state.setLoading);

  // --- Derive isAuthenticated ---
  // isAuthenticated is true only if the user object exists
  const isAuthenticated = useMemo(() => !!user, [user]);

  // --- Initial Auth Check Effect ---
  useEffect(() => {
    let isMounted = true; // Flag to prevent state updates on unmounted component

    const verifyTokenAndFetchUser = async () => {
      // Get current state directly inside effect
      const currentToken = useAuthStore.getState().token;
      const currentUser = useAuthStore.getState().user;

      console.log('[AuthContext] verifyEffect running. Token:', !!currentToken, 'User:', !!currentUser);

      // Only proceed if token exists and user data is missing
      if (currentToken && !currentUser) {
        console.log('[AuthContext] Token found, user missing. Fetching profile...');
        // Ensure loading is true while fetching (might be redundant if store default is true)
        if (isMounted) setLoading(true);
        try {
          const userProfileResponse = await fetchUserProfile();
          const userProfile = userProfileResponse;
          console.log('[AuthContext] Profile fetch successful:', userProfile);
          // Use storeLogin to set token, user, and loading=false atomically
          if (isMounted) storeLogin(currentToken, userProfile);
        } catch (error) {
          console.error('[AuthContext] Profile fetch failed:', error);
          // Logout if token is invalid or profile fetch fails
          if (isMounted) storeLogout();
        }
        // No finally block needed as storeLogin/storeLogout set loading=false
      } else {
        // No token, or user already exists. Initial check is done.
        console.log('[AuthContext] No token or user already loaded. Setting loading false.');
        if (isMounted && useAuthStore.getState().loading) { // Only set loading if it's currently true
             setLoading(false);
        }
      }
    };

    verifyTokenAndFetchUser();

    // Cleanup function to set isMounted to false
    return () => {
      isMounted = false;
    };
    // Dependencies: Only run when token potentially changes (initial load/hydration)
    // Avoid depending on `user` or `loading` here to prevent infinite loops.
  }, [token, storeLogin, storeLogout, setLoading]);

  // --- Context Value ---
  // Memoize the context value to prevent unnecessary re-renders of consumers
  const contextValue: AuthContextType = useMemo(() => ({
    user,
    token,
    isAuthenticated, // Derived value
    login: storeLogin,
    logout: storeLogout,
    setUser: storeSetUser,
    loading, // Loading state from store
  }), [user, token, isAuthenticated, storeLogin, storeLogout, storeSetUser, loading]);

  console.log('[AuthContext] Provider rendering with state:', { user: !!user, token: !!token, isAuthenticated, loading });

  // --- Render ---
  return (
    <AuthContext.Provider value={contextValue}>
      {/* Render children only after initial loading is complete */}
      {loading ? <Loader text="Initializing..." /> : children}
    </AuthContext.Provider>
  );
};

