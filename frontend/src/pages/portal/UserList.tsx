import React from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Stack,
} from '@mui/material';
import {
  PersonAdd as PersonAddIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { User } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL;

type RoleColor = 'primary' | 'error' | 'default';

export default function UserList() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Redirect if not admin
  React.useEffect(() => {
    if (user && user.role !== 'admin') {
      navigate('/portal/tickets');
    }
  }, [user, navigate]);

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await axios.get(`${API_URL}/users`);
      return response.data;
    },
  });

  const getRoleColor = (role: string): RoleColor => {
    switch (role) {
      case 'admin':
        return 'error';
      case 'staff':
        return 'primary';
      default:
        return 'default';
    }
  };

  if (isLoading) {
    return <Typography>Loading users...</Typography>;
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <Box>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{ mb: 3 }}
      >
        <Typography variant="h4">IT Staff Management</Typography>
        <Button
          variant="contained"
          startIcon={<PersonAddIcon />}
          onClick={() => {/* TODO: Open invite user dialog */}}
        >
          Invite User
        </Button>
      </Stack>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Joined</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map((userData) => (
              <TableRow key={userData.id}>
                <TableCell>{userData.name}</TableCell>
                <TableCell>{userData.email}</TableCell>
                <TableCell>
                  <Chip
                    label={userData.role}
                    color={getRoleColor(userData.role)}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  {userData.createdAt && formatDate(userData.createdAt)}
                </TableCell>
                <TableCell>
                  <IconButton
                    size="small"
                    disabled={userData.id === user?.id} // Can't edit yourself
                    onClick={() => {/* TODO: Open edit user dialog */}}
                  >
                    <EditIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Typography variant="body2" color="textSecondary" sx={{ mt: 2 }}>
        Note: Changes to user roles should be made with caution.
      </Typography>
    </Box>
  );
}