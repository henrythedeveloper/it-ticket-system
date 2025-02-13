import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Typography,
  Divider,
  Alert,
  IconButton,
  useTheme,
  alpha,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import api from '../utils/axios';
import { User } from '../types';
import { useAuth } from '../hooks/useAuth';
import { 
  colors, 
  shadows, 
  chipStyles, 
  sectionTitleStyles,
} from '../styles/common';

interface UserProfileDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function UserProfileDialog({ open, onClose }: UserProfileDialogProps) {
  const theme = useTheme();
  const { user, login } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleUpdateProfile = async () => {
    try {
      setError(null);
      await api.patch<{ user: User }>(`/users/${user?.id}`, {
        name,
      });
      await login({ email: user?.email || '', password: oldPassword });
      setSuccess('Profile updated successfully');
    } catch {
      setError('Failed to update profile');
    }
  };

  const handleChangePassword = async () => {
    try {
      setError(null);
      if (newPassword !== confirmPassword) {
        setError('New passwords do not match');
        return;
      }

      await api.post(`/auth/change-password`, {
        oldPassword,
        newPassword,
      });

      setSuccess('Password changed successfully');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch {
      setError('Failed to change password. Make sure your current password is correct.');
    }
  };

  const handleClose = () => {
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setError(null);
    setSuccess(null);
    onClose();
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose} 
      maxWidth="sm" 
      fullWidth
      PaperProps={{
        elevation: 0,
        sx: {
          borderRadius: 3,
          backgroundColor: theme.palette.background.default,
          boxShadow: shadows.strong,
        }
      }}
    >
      <DialogTitle sx={{ p: 3, pb: 2 }}>
        <Box 
          sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between' 
          }}
        >
          <Typography sx={sectionTitleStyles}>
            Edit Profile
          </Typography>
          <IconButton 
            onClick={handleClose} 
            size="small"
            sx={{
              ...chipStyles,
              backgroundColor: alpha(theme.palette.text.primary, 0.1),
              '&:hover': {
                backgroundColor: alpha(theme.palette.text.primary, 0.2),
              }
            }}
          >
            <CloseIcon sx={{ color: theme.palette.text.primary }} />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ px: 3 }}>
        {error && (
          <Alert 
            severity="error" 
            sx={{ 
              mb: 2,
              borderRadius: 2,
              bgcolor: alpha(colors.errorRed, 0.1),
              color: colors.errorRed,
              border: `1px solid ${alpha(colors.errorRed, 0.2)}`,
            }}
          >
            {error}
          </Alert>
        )}
        {success && (
          <Alert 
            severity="success" 
            sx={{ 
              mb: 2,
              borderRadius: 2,
              bgcolor: alpha(colors.successGreen, 0.1),
              color: colors.successGreen,
              border: `1px solid ${alpha(colors.successGreen, 0.2)}`,
            }}
          >
            {success}
          </Alert>
        )}
        
        <Box sx={{ mb: 3 }}>
          <Typography 
            variant="subtitle1" 
            sx={{ 
              mb: 2, 
              fontWeight: 600,
              color: theme.palette.text.primary,
            }}
          >
            Profile Information
          </Typography>
          <TextField
            fullWidth
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            sx={{
              mb: 2,
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
              },
            }}
          />
          <TextField
            fullWidth
            label="Email"
            value={user?.email}
            disabled
            helperText="Email cannot be changed"
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
              },
            }}
          />
        </Box>

        <Divider sx={{ 
          my: 3,
          borderColor: theme.palette.divider,
        }} />

        <Box>
          <Typography 
            variant="subtitle1" 
            sx={{ 
              mb: 2,
              fontWeight: 600,
              color: theme.palette.text.primary,
            }}
          >
            Change Password
          </Typography>
          <TextField
            fullWidth
            type="password"
            label="Current Password"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            sx={{
              mb: 2,
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
              },
            }}
          />
          <TextField
            fullWidth
            type="password"
            label="New Password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            sx={{
              mb: 2,
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
              },
            }}
          />
          <TextField
            fullWidth
            type="password"
            label="Confirm New Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            error={newPassword !== confirmPassword && confirmPassword !== ''}
            helperText={
              newPassword !== confirmPassword && confirmPassword !== ''
                ? 'Passwords do not match'
                : ''
            }
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
              },
            }}
          />
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 3, pt: 2, gap: 1 }}>
        <Button 
          onClick={handleClose}
          sx={{
            ...chipStyles,
            color: theme.palette.text.primary,
            '&:hover': {
              backgroundColor: alpha(theme.palette.text.primary, 0.1),
            }
          }}
        >
          Cancel
        </Button>
        <Button 
          onClick={handleUpdateProfile}
          variant="outlined"
          disabled={!name || name === user?.name}
          sx={{
            ...chipStyles,
            borderColor: colors.primaryBlue,
            color: colors.primaryBlue,
            '&:hover': {
              borderColor: colors.primaryBlue,
              backgroundColor: alpha(colors.primaryBlue, 0.1),
            },
            '&:disabled': {
              borderColor: alpha(colors.primaryBlue, 0.5),
              color: alpha(colors.primaryBlue, 0.5),
            }
          }}
        >
          Update Profile
        </Button>
        <Button
          onClick={handleChangePassword}
          variant="contained"
          disabled={!oldPassword || !newPassword || !confirmPassword}
          sx={{
            ...chipStyles,
            backgroundColor: colors.primaryBlue,
            color: 'white',
            '&:hover': {
              backgroundColor: alpha(colors.primaryBlue, 0.9),
            },
            '&:disabled': {
              backgroundColor: alpha(colors.primaryBlue, 0.5),
            }
          }}
        >
          Change Password
        </Button>
      </DialogActions>
    </Dialog>
  );
}