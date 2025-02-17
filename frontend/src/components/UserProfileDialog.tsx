import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  Box,
} from '@mui/material';
import { useTheme } from '../contexts/ThemeContext';
import { getCommonDialogStyles } from '../contexts/ThemeContext';
import { User } from '../types';

type Props = {
  open: boolean;
  onClose: () => void;
  onSave: (data: Partial<User>) => void;
  user: User | undefined | null;  // Make user prop optional
  isNew?: boolean;
  currentUser: User;
};

interface UserFormData {
  name: string;
  email: string;
  role: 'admin' | 'staff';
  password?: string;
}

const UserProfileDialog: React.FC<Props> = ({
  open,
  onClose,
  onSave,
  user,
  isNew = false,
  currentUser,
}) => {
  const { theme } = useTheme();
  const [formData, setFormData] = useState<UserFormData>({
    name: user?.name || '',
    email: user?.email || '',
    role: user?.role || 'staff',
    password: '',
  });

  const handleChange = (field: keyof UserFormData) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [field]: event.target.value,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const submitData = { ...formData };
    if (!isNew || !submitData.password) {
      delete submitData.password;
    }
    onSave(submitData);
  };

  const canChangeRole = currentUser.role === 'admin';

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      sx={getCommonDialogStyles(theme)}
    >
      <DialogTitle>{isNew ? 'Create User' : 'Edit User'}</DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Name"
              value={formData.name}
              onChange={handleChange('name')}
              required
              fullWidth
            />
            <TextField
              label="Email"
              value={formData.email}
              onChange={handleChange('email')}
              required
              fullWidth
              type="email"
            />
            {(isNew || canChangeRole) && (
              <TextField
                select
                label="Role"
                value={formData.role}
                onChange={handleChange('role')}
                required
                fullWidth
              >
                <MenuItem value="staff">Staff</MenuItem>
                <MenuItem value="admin">Admin</MenuItem>
              </TextField>
            )}
            {isNew && (
              <TextField
                label="Password"
                value={formData.password}
                onChange={handleChange('password')}
                required
                fullWidth
                type="password"
              />
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained" color="primary">
            {isNew ? 'Create' : 'Save Changes'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default UserProfileDialog;