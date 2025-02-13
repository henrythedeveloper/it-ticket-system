import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import {
  Box,
  Button,
  TextField,
  Typography,
  Alert,
  useTheme,
  alpha,
  CircularProgress,
} from '@mui/material';
import { RegisterCredentials } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import PageContainer from '../../components/layout/PageContainer';
import { 
  colors, 
  shadows, 
  chipStyles, 
  sectionTitleStyles 
} from '../../styles/common';

export default function Register() {
  const theme = useTheme();
  const navigate = useNavigate();
  const { register: registerUser } = useAuth();
  const [error, setError] = React.useState('');
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isValid, isDirty },
  } = useForm<RegisterCredentials>({
    mode: 'onChange',
  });

  const onSubmit = async (data: RegisterCredentials) => {
    try {
      await registerUser(data);
      navigate('/portal');
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('Registration failed. Please try again.');
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
          IT Staff Registration
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
            id="name"
            label="Full Name"
            autoComplete="name"
            autoFocus
            {...register('name', {
              required: 'Full name is required',
              minLength: {
                value: 2,
                message: 'Name must be at least 2 characters',
              },
            })}
            error={!!errors.name}
            helperText={errors.name?.message}
            sx={inputStyles}
          />

          <TextField
            margin="normal"
            required
            fullWidth
            id="email"
            label="Email Address"
            autoComplete="email"
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
            autoComplete="new-password"
            {...register('password', {
              required: 'Password is required',
              minLength: {
                value: 8,
                message: 'Password must be at least 8 characters',
              },
              pattern: {
                value: /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{8,}$/,
                message: 'Password must contain at least one letter and one number',
              },
            })}
            error={!!errors.password}
            helperText={errors.password?.message}
            sx={inputStyles}
          />

          <Box sx={{ 
            mt: 2, 
            mb: 3,
            p: 2,
            borderRadius: 2,
            backgroundColor: alpha(colors.warningYellow, 0.1),
            border: `1px solid ${alpha(colors.warningYellow, 0.2)}`,
          }}>
            <Typography 
              variant="body2" 
              sx={{ 
                color: alpha(theme.palette.text.primary, 0.7),
                textAlign: 'center',
              }}
            >
              Note: Registration is for IT staff members only.
            </Typography>
          </Box>

          <Button
            type="submit"
            fullWidth
            variant="contained"
            disabled={isSubmitting || !isValid || !isDirty}
            sx={{
              ...chipStyles,
              height: 48,
              backgroundColor: colors.primaryBlue,
              color: 'white',
              fontSize: '1rem',
              fontWeight: 600,
              mb: 2,
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
                Creating Account...
              </Box>
            ) : (
              'Create Account'
            )}
          </Button>
          
          <Button
            fullWidth
            onClick={() => navigate('/login')}
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
            Already have an account? Sign In
          </Button>
        </Box>
      </Box>
    </PageContainer>
  );
}