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
      setLoading(true);
      const storedToken = localStorage.getItem('authToken'); // Or wherever token is stored

      if (storedToken) {
        try {
            // Set token in store first, so interceptor can use it
            useAuthStore.setState({ token: storedToken, isAuthenticated: true });
            // Validate token by fetching user profile
            const userProfile = await fetchUserProfile();
            // If fetch succeeds, token is valid, update user state using store action
            storeSetUser(userProfile); // Use store action here too
            useAuthStore.setState({ isAuthenticated: true, loading: false }); // Update loading via store is also an option
            console.log("AuthContext: User profile fetched successfully.");
        } catch (error) {
            // Token invalid or expired, or profile fetch failed
            console.warn("AuthContext: Token validation failed or profile fetch error.", error);
            storeLogout(); // Clear invalid state from store and localStorage
        }
      } else {
        // No token found, ensure user is logged out
          if (isAuthenticated) { // If zustand state is somehow true, correct it
            storeLogout();
          }
        console.log("AuthContext: No stored token found.");
      }
      setLoading(false); // Finish loading check
      // checkAuthStatus(); // This might be redundant now
    };

    verifyAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount

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
  return (
    <AuthContext.Provider value={contextValue}>
      {/* Render children only after initial auth check is complete */}
      {/* Or show a global loading spinner: loading ? <GlobalSpinner /> : children */}
      {children}
    </AuthContext.Provider>
  );
};
