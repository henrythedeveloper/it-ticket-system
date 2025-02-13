import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import {
  Button,
  TextField,
  Typography,
  Alert,
  Box,
  useTheme,
  alpha,
  CircularProgress,
} from '@mui/material';
import { LoginCredentials } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import axios from 'axios';
import PageContainer from '../../components/layout/PageContainer';
import { 
  colors, 
  shadows, 
  chipStyles, 
  sectionTitleStyles 
} from '../../styles/common';

export default function Login() {
  const theme = useTheme();
  const navigate = useNavigate();
  const { login } = useAuth();
  const [error, setError] = React.useState('');
  const { 
    register, 
    handleSubmit, 
    formState: { errors, isSubmitting, isValid, isDirty }
  } = useForm<LoginCredentials>({
    mode: 'onChange'
  });

  const onSubmit = async (data: LoginCredentials) => {
    try {
      setError('');
      await login(data);
      navigate('/portal');
    } catch (error) {
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
      } else {
        setError('Network error. Please check your connection.');
      }
    }
  };

  const inputStyles = {
    '& .MuiOutlinedInput-root': {
      borderRadius: 2,
      backgroundColor: alpha(theme.palette.background.paper, 0.5),
      backdropFilter: 'blur(8px)',
      transition: 'all 0.2s ease-in-out',
      '&:hover': {
        backgroundColor: alpha(theme.palette.background.paper, 0.7),
        boxShadow: shadows.subtle,
      },
      '&.Mui-focused': {
        backgroundColor: alpha(theme.palette.background.paper, 0.9),
        boxShadow: shadows.medium,
      },
      '&.Mui-error': {
        backgroundColor: alpha(colors.errorRed, 0.05),
        '&:hover': {
          backgroundColor: alpha(colors.errorRed, 0.08),
        },
      },
    },
    '& .MuiOutlinedInput-notchedOutline': {
      borderColor: alpha(theme.palette.text.primary, 0.2),
      transition: 'border-color 0.2s ease-in-out',
    },
    '& .Mui-focused .MuiOutlinedInput-notchedOutline': {
      borderColor: colors.primaryBlue,
      borderWidth: 2,
    },
    '& .Mui-error .MuiOutlinedInput-notchedOutline': {
      borderColor: colors.errorRed,
    },
    '& .MuiInputLabel-root': {
      color: alpha(theme.palette.text.primary, 0.7),
      '&.Mui-focused': {
        color: colors.primaryBlue,
      },
      '&.Mui-error': {
        color: colors.errorRed,
      },
    },
    '& .MuiFormHelperText-root': {
      marginLeft: 0,
      '&.Mui-error': {
        color: colors.errorRed,
      },
    },
  };

  return (
    <PageContainer maxWidth="xs">
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          p: 4,
          backgroundColor: alpha(theme.palette.background.paper, 0.8),
          backdropFilter: 'blur(20px)',
          borderRadius: 3,
          boxShadow: shadows.medium,
          border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
        }}
      >
        <Typography 
          component="h1" 
          sx={{
            ...sectionTitleStyles,
            fontSize: '2rem',
            mb: 4,
            textAlign: 'center',
          }}
        >
          Help Desk Portal
        </Typography>

        {error && (
          <Alert 
            severity="error" 
            sx={{ 
              width: '100%',
              mb: 3,
              borderRadius: 2,
              bgcolor: alpha(colors.errorRed, 0.1),
              color: colors.errorRed,
              border: `1px solid ${alpha(colors.errorRed, 0.2)}`,
              '& .MuiAlert-icon': {
                color: colors.errorRed,
              },
            }}
          >
            {error}
          </Alert>
        )}

        <Box 
          component="form" 
          onSubmit={handleSubmit(onSubmit)} 
          noValidate
          sx={{ width: '100%' }}
        >
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
            sx={inputStyles}
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
            sx={inputStyles}
          />

          <Button
            type="submit"
            fullWidth
            variant="contained"
            disabled={isSubmitting || !isValid || !isDirty}
            sx={{
              ...chipStyles,
              mt: 3,
              mb: 2,
              height: 48,
              backgroundColor: colors.primaryBlue,
              color: 'white',
              fontSize: '1rem',
              fontWeight: 600,
              position: 'relative',
              transition: 'all 0.2s ease-in-out',
              transform: 'translateY(0)',
              '&:hover': {
                backgroundColor: alpha(colors.primaryBlue, 0.9),
                transform: 'translateY(-1px)',
                boxShadow: shadows.medium,
              },
              '&:active': {
                transform: 'translateY(0)',
                boxShadow: 'none',
              },
              '&:disabled': {
                backgroundColor: alpha(colors.primaryBlue, 0.5),
              },
            }}
          >
            {isSubmitting ? (
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <CircularProgress 
                  size={20} 
                  sx={{ 
                    color: 'white',
                    mr: 1,
                  }} 
                />
                Signing in...
              </Box>
            ) : (
              'Sign In'
            )}
          </Button>

          <Button
            fullWidth
            onClick={() => navigate('/register')}
            sx={{
              ...chipStyles,
              height: 48,
              color: colors.primaryBlue,
              backgroundColor: alpha(colors.primaryBlue, 0.1),
              transition: 'all 0.2s ease-in-out',
              transform: 'translateY(0)',
              '&:hover': {
                backgroundColor: alpha(colors.primaryBlue, 0.15),
                transform: 'translateY(-1px)',
                boxShadow: shadows.subtle,
              },
              '&:active': {
                transform: 'translateY(0)',
                boxShadow: 'none',
              },
            }}
          >
            Create an Account
          </Button>
        </Box>
      </Box>
    </PageContainer>
  );
}