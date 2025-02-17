import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  Chip,
} from '@mui/material';
import { Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../contexts/ThemeContext';
import UserProfileDialog from '../../components/UserProfileDialog';
import { User } from '../../types';
import { getCommonButtonStyles } from '../../contexts/ThemeContext';
import axios from '../../utils/axios';

const UserList = () => {
  const { theme } = useTheme();
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User>();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await axios.get('/api/users');
      setUsers(response.data.data);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const handleCreateUser = () => {
    setSelectedUser(undefined);
    setIsNewUser(true);
    setDialogOpen(true);
  };

  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    setIsNewUser(false);
    setDialogOpen(true);
  };

  const handleDeleteUser = async (user: User) => {
    if (!window.confirm('Are you sure you want to delete this user?')) {
      return;
    }

    try {
      await axios.delete(`/api/users/${user.id}`);
      await fetchUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
    }
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setSelectedUser(undefined);
    setIsNewUser(false);
  };

  const handleUserSave = async (userData: Partial<User>) => {
    try {
      if (isNewUser) {
        await axios.post('/api/auth/register', userData);
      } else if (selectedUser) {
        await axios.patch(`/api/users/${selectedUser.id}`, userData);
      }
      await fetchUsers();
      handleDialogClose();
    } catch (error) {
      console.error('Error saving user:', error);
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return theme.colors.errorRed;
      default:
        return theme.colors.secondaryGray;
    }
  };

  if (!currentUser?.role) {
    return null;
  }

  return (
    <Box p={3}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Typography variant="h4" gutterBottom>
          Users
        </Typography>
        {currentUser.role === 'admin' && (
          <Button
            variant="contained"
            onClick={handleCreateUser}
            sx={getCommonButtonStyles(theme)}
          >
            Create User
          </Button>
        )}
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell>{user.name}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>
                  <Chip
                    label={user.role.toUpperCase()}
                    size="small"
                    sx={{
                      backgroundColor: getRoleColor(user.role),
                      color: '#fff',
                    }}
                  />
                </TableCell>
                <TableCell>
                  <IconButton
                    onClick={() => handleEditUser(user)}
                    size="small"
                    color="primary"
                    disabled={currentUser.role !== 'admin' && currentUser.id !== user.id}
                  >
                    <EditIcon />
                  </IconButton>
                  {currentUser.role === 'admin' && currentUser.id !== user.id && (
                    <IconButton
                      onClick={() => handleDeleteUser(user)}
                      size="small"
                      color="error"
                    >
                      <DeleteIcon />
                    </IconButton>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {dialogOpen && currentUser && (
        <UserProfileDialog
          open={dialogOpen}
          onClose={handleDialogClose}
          onSave={handleUserSave}
          user={selectedUser}
          isNew={isNewUser}
          currentUser={currentUser}
        />
      )}
    </Box>
  );
};

export default UserList;