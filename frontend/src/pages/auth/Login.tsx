import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import {
  Button,
  TextField,
  Typography,
  Alert,
  Box,
} from '@mui/material';
import { LoginCredentials } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import axios from 'axios';
import PageContainer from '../../components/layout/PageContainer';

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [error, setError] = React.useState('');
  const { register, handleSubmit, formState: { errors } } = useForm<LoginCredentials>();

  const onSubmit = async (data: LoginCredentials) => {
    try {
      setError(''); // Clear any previous errors
      console.log('Attempting login with:', { email: data.email });
      await login(data);
      navigate('/portal');
    } catch (error) {
      console.error('Login error:', error);
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const message = error.response?.data?.error || error.response?.data?.message;
        
        switch (status) {
          case 404:
            setError('API endpoint not found. Please check server configuration.');
            break;
          case 401:
            setError('Invalid email or password.');
            break;
          case 500:
            setError('Server error. Please try again later.');
            break;
          default:
            setError(message || 'Failed to login. Please try again.');
        }
        
        // Log detailed error for debugging
        console.error('Login failed:', {
          status,
          message,
          url: error.config?.url,
          data: error.response?.data
        });
      } else {
        setError('Network error. Please check your connection.');
      }
    }
  };

  return (
    <PageContainer maxWidth="xs">
      <Typography component="h1" variant="h5" align="center" gutterBottom>
        Help Desk Portal Login
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <TextField
          margin="normal"
          required
          fullWidth
          id="email"
          label="Email Address"
          autoComplete="email"
          autoFocus
          {...register('email', {
            required: 'Email is required',
            pattern: {
              value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
              message: 'Invalid email address',
            },
          })}
          error={!!errors.email}
          helperText={errors.email?.message}
        />
        <TextField
          margin="normal"
          required
          fullWidth
          label="Password"
          type="password"
          id="password"
          autoComplete="current-password"
          {...register('password', {
            required: 'Password is required',
            minLength: {
              value: 6,
              message: 'Password must be at least 6 characters',
            },
          })}
          error={!!errors.password}
          helperText={errors.password?.message}
        />
        <Button
          type="submit"
          fullWidth
          variant="contained"
          sx={{ mt: 3, mb: 2 }}
        >
          Sign In
        </Button>
        <Button
          fullWidth
          variant="text"
          onClick={() => navigate('/register')}
        >
          Don't have an account? Sign Up
        </Button>
      </Box>
    </PageContainer>
  );
}