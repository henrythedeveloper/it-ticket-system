import React, { createContext, useContext, useEffect, useState } from 'react';
import api from '../utils/axios';
import { isAxiosError } from 'axios';
import { User, LoginCredentials, RegisterCredentials } from '../types';

interface AuthContextType {
  user: User | null;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (credentials: RegisterCredentials) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  isAuthenticated: boolean;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isVerifying, setIsVerifying] = useState(true);

  useEffect(() => {
    const verifyAuth = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          setIsVerifying(false);
          setIsLoading(false);
          return;
        }

        // Set the token in axios defaults
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

        const response = await api.get('/auth/verify');
        setUser(response.data);
      } catch (error) {
        console.error('Auth verification failed:', error);
        // Only remove token if it's an authentication error
        if (isAxiosError(error) && error.response?.status === 401) {
          localStorage.removeItem('token');
          delete api.defaults.headers.common['Authorization'];
        }
      } finally {
        setIsVerifying(false);
        setIsLoading(false);
      }
    };

    verifyAuth();
  }, []);

  const login = async (credentials: LoginCredentials) => {
    try {
      const response = await api.post('/auth/login', credentials);
      const { token, user } = response.data;
      localStorage.setItem('token', token);
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setUser(user);
    } catch (err) {
      if (isAxiosError(err)) {
        console.error('Login error:', {
          status: err.response?.status,
          data: err.response?.data,
          config: err.config
        });
      } else {
        console.error('Non-Axios error:', err);
      }
      throw err;
    }
  };

  const register = async (credentials: RegisterCredentials) => {
    try {
      const response = await api.post('/auth/register', credentials);
      const { token, user } = response.data;
      localStorage.setItem('token', token);
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setUser(user);
    } catch (error) {
      console.error('Registration failed:', error);
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    delete api.defaults.headers.common['Authorization'];
    setUser(null);
  };

  if (isVerifying) {
    return <div>Loading...</div>;
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        register,
        logout,
        isLoading,
        isAuthenticated: !!user
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}