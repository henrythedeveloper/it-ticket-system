import { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { User } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import api from '../../utils/axios';

type RoleColor = 'primary' | 'error' | 'default';

interface UserDialogData {
  name: string;
  email: string;
  role: 'admin' | 'staff';
}

export default function UserList() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [dialogData, setDialogData] = useState<UserDialogData>({
    name: '',
    email: '',
    role: 'staff',
  });

  const { data, isLoading } = useQuery<{ data: User[] }>({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await api.get('/users');
      return response.data;
    },
  });

  const userMutation = useMutation({
    mutationFn: async (userData: Partial<User>) => {
      if (!selectedUser?.id) throw new Error('No user selected');
      await api.patch(`/users/${selectedUser.id}`, userData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      handleCloseDialog();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (userId: number) => {
      await api.delete(`/users/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      handleCloseDeleteDialog();
    },
  });

  const users = data?.data || [];

  const handleOpenDeleteDialog = (user: User) => {
    setSelectedUser(user);
    setDeleteDialogOpen(true);
  };

  const handleCloseDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setSelectedUser(null);
  };

  const handleDelete = () => {
    if (selectedUser?.id) {
      deleteMutation.mutate(selectedUser.id);
    }
  };

  const handleOpenDialog = (user: User) => {
    setSelectedUser(user);
    setDialogData({
      name: user.name,
      email: user.email,
      role: user.role,
    });
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSelectedUser(null);
    setDialogData({
      name: '',
      email: '',
      role: 'staff',
    });
  };

  const handleSave = () => {
    userMutation.mutate(dialogData);
  };

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

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (isLoading) {
    return <Typography>Loading users...</Typography>;
  }

  return (
    <Box>
      <Stack
        direction="row"
        alignItems="center"
        sx={{ mb: 3 }}
      >
        <Typography variant="h4">IT Staff List</Typography>
      </Stack>
<TableContainer component={Paper} sx={{
  maxHeight: { xs: 'calc(100vh - 250px)', sm: 'calc(100vh - 300px)' },
  overflow: 'auto'
}}>
        <Table stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: { xs: '25%', sm: '20%' } }}>Name</TableCell>
              <TableCell sx={{ width: { xs: '35%', sm: '30%' }, display: { xs: 'none', sm: 'table-cell' } }}>Email</TableCell>
              <TableCell sx={{ width: { xs: '20%', sm: '15%' } }}>Role</TableCell>
              <TableCell sx={{ width: { xs: '25%', sm: '20%' }, display: { xs: 'none', md: 'table-cell' } }}>Joined</TableCell>
              <TableCell sx={{ width: { xs: '30%', sm: '15%' } }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map((userData) => (
              <TableRow key={userData.id}>
                <TableCell sx={{ width: { xs: '25%', sm: '20%' } }}>{userData.name}</TableCell>
                <TableCell sx={{ width: { xs: '35%', sm: '30%' }, display: { xs: 'none', sm: 'table-cell' } }}>
                  {userData.email}
                </TableCell>
                <TableCell sx={{ width: { xs: '20%', sm: '15%' } }}>
                  <Chip
                    label={userData.role}
                    color={getRoleColor(userData.role)}
                    size="small"
                  />
                </TableCell>
                <TableCell sx={{ width: { xs: '25%', sm: '20%' }, display: { xs: 'none', md: 'table-cell' } }}>
                  {formatDate(userData.createdAt)}
                </TableCell>
                <TableCell sx={{ width: { xs: '30%', sm: '15%' } }}>
                  <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-start' }}>
                    <IconButton
                      size="small"
                      disabled={userData.id === user?.id}
                      onClick={() => handleOpenDialog(userData)}
                    >
                      <EditIcon />
                    </IconButton>
                    {user?.role === 'admin' && (
                      <IconButton
                        size="small"
                        disabled={userData.id === user?.id}
                        onClick={() => handleOpenDeleteDialog(userData)}
                        color="error"
                      >
                        <DeleteIcon />
                      </IconButton>
                    )}
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Typography variant="body2" color="textSecondary" sx={{ mt: 2 }}>
        Note: Changes to user roles should be made with caution.
      </Typography>

      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Edit User</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Name"
                  value={dialogData.name}
                  onChange={(e) => setDialogData((prev) => ({ ...prev, name: e.target.value }))}
                  required
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Email"
                  type="email"
                  value={dialogData.email}
                  onChange={(e) => setDialogData((prev) => ({ ...prev, email: e.target.value }))}
                  required
                />
              </Grid>
              <Grid item xs={12}>
                <FormControl fullWidth>
                    <InputLabel>Role</InputLabel>
                    <Select
                      value={dialogData.role}
                      onChange={(e) => setDialogData((prev) => ({ ...prev, role: e.target.value as 'admin' | 'staff' }))}
                      label="Role"
                      disabled={user?.role !== 'admin'}
                    >
                      <MenuItem value="staff">Staff</MenuItem>
                      <MenuItem value="admin">Admin</MenuItem>
                    </Select>
                  </FormControl>
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button
            onClick={handleSave}
            variant="contained"
            color="primary"
            disabled={!dialogData.name || !dialogData.email}
          >
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteDialogOpen} onClose={handleCloseDeleteDialog}>
        <DialogTitle>Confirm Delete User</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete user {selectedUser?.name}? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDeleteDialog}>Cancel</Button>
          <Button onClick={handleDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}