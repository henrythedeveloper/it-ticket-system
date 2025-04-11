import React, { createContext, useState, useEffect, useContext } from 'react';
import api from '../services/api';
import { User } from '../types/models';

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
}

interface UserResponse {
  success: boolean;
  data: User;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStoredData = () => {
      const storedToken = localStorage.getItem('@Helpdesk:token');
      if (storedToken) {
        api.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
      }
      setLoading(false);
    };
    
    loadStoredData();
  }, []);
  
  const login = async (email: string, password: string) => {
    const response = await api.post<AuthResponse & { user: User }>('/auth/login', { email, password });
    
    if (response.data.success) {
      const { access_token, user } = response.data.data;
      
      localStorage.setItem('@Helpdesk:token', access_token);
      api.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
      
      setUser(user);
    } else {
      throw new Error('Invalid credentials');
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