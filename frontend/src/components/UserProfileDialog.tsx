import React, { useState } from 'react';
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
} from '@mui/material';
import api from '../utils/axios';
import { User } from '../types';
import { useAuth } from '../hooks/useAuth';

interface UserProfileDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function UserProfileDialog({ open, onClose }: UserProfileDialogProps) {
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
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Edit Profile</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
        
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle1" gutterBottom>
            Profile Information
          </Typography>
          <TextField
            fullWidth
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            margin="normal"
          />
          <TextField
            fullWidth
            label="Email"
            value={user?.email}
            disabled
            margin="normal"
            helperText="Email cannot be changed"
          />
        </Box>

        <Divider sx={{ my: 3 }} />

        <Box>
          <Typography variant="subtitle1" gutterBottom>
            Change Password
          </Typography>
          <TextField
            fullWidth
            type="password"
            label="Current Password"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            margin="normal"
          />
          <TextField
            fullWidth
            type="password"
            label="New Password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            margin="normal"
          />
          <TextField
            fullWidth
            type="password"
            label="Confirm New Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            margin="normal"
            error={newPassword !== confirmPassword && confirmPassword !== ''}
            helperText={
              newPassword !== confirmPassword && confirmPassword !== ''
                ? 'Passwords do not match'
                : ''
            }
          />
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 3 }}>
        <Button onClick={handleClose}>Cancel</Button>
        <Button 
          onClick={handleUpdateProfile}
          variant="outlined"
          disabled={!name || name === user?.name}
        >
          Update Profile
        </Button>
        <Button
          onClick={handleChangePassword}
          variant="contained"
          disabled={!oldPassword || !newPassword || !confirmPassword}
        >
          Change Password
        </Button>
      </DialogActions>
    </Dialog>
  );
}