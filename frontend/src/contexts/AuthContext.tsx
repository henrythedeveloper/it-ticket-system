import React, { createContext, useState, useEffect, useContext } from 'react';
import api from '../services/api';
import { User, APIResponse  } from '../types/models';

interface AuthContextData {
  isAuthenticated: boolean;
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  updateUser: (user: User) => void;
}

interface AuthResponse {
  success: boolean;
  data: {
    access_token: string;
    token_type: string;
    expires_at: string;
    user: User;
  };
  error?: string; // Optional error message
}

// Define response type for /users/me if different from APIResponse<User>
interface UserMeResponse extends APIResponse<User> {}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUserFromToken = async () => {
      const storedToken = localStorage.getItem('@Helpdesk:token');

      if (storedToken) {
        console.log("Token found in localStorage, attempting verification..."); // Debug log
        // Set header immediately for the verification request
        api.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`; 
        
        try {
          // Attempt to fetch user data using the stored token
          const response = await api.get<UserMeResponse>('/users/me'); // Use your /me endpoint
          
          if (response.data.success && response.data.data) {
            console.log("Token verified, setting user:", response.data.data); // Debug log
            setUser(response.data.data); // Set user state if token is valid
          } else {
            // Token might be invalid or expired server-side
            console.log("Token verification failed or no user data:", response.data.error); // Debug log
            localStorage.removeItem('@Helpdesk:token'); // Clear invalid token
            delete api.defaults.headers.common['Authorization']; // Clear header
            setUser(null);
          }
        } catch (error: any) {
          // API call failed (e.g., 401 Unauthorized)
           console.error("Error verifying token:", error.response?.data?.error || error.message); // Debug log
           localStorage.removeItem('@Helpdesk:token'); // Clear invalid token
           delete api.defaults.headers.common['Authorization']; // Clear header
           setUser(null);
        }
      } else {
         console.log("No token found in localStorage."); // Debug log
         // Ensure user is null if no token exists
         setUser(null);
      }
      // Set loading to false only after the verification attempt is done
      setLoading(false); 
    };

    loadUserFromToken();
  }, []); // Run only once on initial load
  
  const login = async (email: string, password: string) => {
    // Wrap in try/catch to handle API errors properly
    try {
        const response = await api.post<AuthResponse>('/auth/login', { email, password }); // Adjusted type here

        if (response.data.success && response.data.data) {
            const { access_token, user: loggedInUser } = response.data.data; // Renamed user to avoid conflict

            localStorage.setItem('@Helpdesk:token', access_token);
            api.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
            setUser(loggedInUser); // Use the user object from the response
        } else {
            // Throw error with message from API if available
            throw new Error(response.data.error || 'Login failed: Invalid credentials'); 
        }
    } catch (error: any) {
         console.error('Login API error:', error);
         // Rethrow a more specific error message if possible
         throw new Error(error.response?.data?.error || error.message || 'Login failed');
    }
  };
  
  const logout = () => {
    localStorage.removeItem('@Helpdesk:token');
    api.defaults.headers.common['Authorization'] = '';
    setUser(null);
  };

  const updateUser = (updatedUser: User) => {
    setUser(updatedUser);
  };
  
  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: !!user,
        user,
        loading,
        login,
        logout,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextData {
  const context = useContext(AuthContext);
  
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
}