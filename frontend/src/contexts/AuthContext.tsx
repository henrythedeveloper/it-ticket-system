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

  useEffect(() => {
    const verifyAuth = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          setIsLoading(false);
          return;
        }

        const response = await api.get('/auth/verify');
        setUser(response.data);
      } catch (error) {
        console.error('Auth verification failed:', error);
        localStorage.removeItem('token');
      } finally {
        setIsLoading(false);
      }
    };

    verifyAuth();
  }, []);

  const login = async (credentials: LoginCredentials) => {
    console.log('Attempting login:', `${api.defaults.baseURL}/auth/login`);
    try {
      const response = await api.post('/auth/login', credentials);
      console.log('Login response:', response);
      const { token, user } = response.data;
      localStorage.setItem('token', token);
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
      setUser(user);
    } catch (error) {
      console.error('Registration failed:', error);
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

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