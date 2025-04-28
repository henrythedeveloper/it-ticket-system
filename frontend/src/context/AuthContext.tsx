// src/context/AuthContext.tsx
// ==========================================================================
// Provides authentication state and actions to the application using React Context
// and integrates with the Zustand auth store.
// Also handles initial authentication check on app load.
// Updated to include setUser in context value.
// ==========================================================================

import React, { createContext, useEffect, useState, ReactNode } from 'react';
import { useAuthStore } from '../store/authStore'; // Zustand store
import { AuthContextType, User } from '../types'; // Shared types
import { fetchUserProfile } from '../services/authService'; // API service

// --- Create Context ---
/**
 * React Context for authentication state.
 * Initial value is undefined to detect usage outside the provider.
 */
export const AuthContext = createContext<AuthContextType | undefined>(undefined);

// --- Context Provider Component ---

/**
 * Props for the AuthProvider component.
 */
interface AuthProviderProps {
  children: ReactNode; // Allow component nesting
}

/**
 * Provides authentication state (user, token, isAuthenticated) and actions (login, logout, setUser)
 * to its children components via context. It utilizes the `useAuthStore` (Zustand)
 * for state management and performs initial token/profile validation.
 */
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  // --- State ---
  // Local loading state for initial auth check
  const [loading, setLoading] = useState<boolean>(true);

  // Get state and actions from Zustand store
  // FIX: Destructure setUser from the store
  const { user, token, isAuthenticated, login: storeLogin, logout: storeLogout, setUser: storeSetUser, checkAuthStatus } = useAuthStore();

  // --- Effects ---
  // Perform initial authentication check on component mount
  useEffect(() => {
    const verifyAuth = async () => {
      console.log('[AuthContext] useEffect verifyAuth started.');
      setLoading(true);
      
      // Get token from store instead of localStorage
      const token = useAuthStore.getState().token;
      console.log('[AuthContext] Token from store:', !!token);

      if (!token) {
        console.log('[AuthContext] No token in store. Ensuring logged out state.');
        if (isAuthenticated) {
          storeLogout();
        }
        setLoading(false);
        return;
      }

      // Only verify profile if we don't have user data
      if (!user) {
        try {
          console.log('[AuthContext] No user data, fetching profile...');
          const userProfile = await fetchUserProfile();
          console.log('[AuthContext] Profile fetch successful:', userProfile);
          storeSetUser(userProfile);
          useAuthStore.setState({ isAuthenticated: true });
        } catch (error) {
          console.error('[AuthContext] Profile fetch failed:', error);
          storeLogout();
        }
      }
      
      setLoading(false);
    };

    verifyAuth();
  }, [storeLogout, storeSetUser, isAuthenticated, user]);

  // --- Context Value ---
  // Assemble the value to be provided by the context
  const contextValue: AuthContextType = {
    user,
    token,
    isAuthenticated,
    login: storeLogin, // Use login action from Zustand store
    logout: storeLogout, // Use logout action from Zustand store
    setUser: storeSetUser, // FIX: Pass setUser action from Zustand store
    loading, // Provide the initial loading state
  };

  // --- Render ---
  console.log('[AuthContext] Provider rendering with state:', { user: !!user, token: !!token, isAuthenticated, loading });
  return (
    <AuthContext.Provider value={contextValue}>
      {/* Render children only after initial auth check is complete */}
      {/* Or show a global loading spinner: loading ? <GlobalSpinner /> : children */}
      {children}
    </AuthContext.Provider>
  );
};
