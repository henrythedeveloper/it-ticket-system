import { useState } from 'react';
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
  PersonAdd as PersonAddIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { User } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
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
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [dialogData, setDialogData] = useState<UserDialogData>({
    name: '',
    email: '',
    role: 'staff',
  });

  // Fetch users
  const { data, isLoading } = useQuery<{ data: User[] }>({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await api.get('/users');
      return response.data;
    },
  });

  // Create/Update user mutation
  const userMutation = useMutation({
    mutationFn: async (userData: Partial<User>) => {
      if (selectedUser) {
        await api.patch(`/users/${selectedUser.id}`, userData);
      } else {
        await api.post('/users', userData);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      handleCloseDialog();
    },
  });

  const users = data?.data || [];

  const handleOpenDialog = (user?: User) => {
    if (user) {
      setSelectedUser(user);
      setDialogData({
        name: user.name,
        email: user.email,
        role: user.role as 'admin' | 'staff',
      });
    } else {
      setSelectedUser(null);
      setDialogData({
        name: '',
        email: '',
        role: 'staff',
      });
    }
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

  const formatDate = (dateString: string) => {
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
        justifyContent="space-between"
        alignItems="center"
        sx={{ mb: 3 }}
      >
        <Typography variant="h4">IT Staff List</Typography>
        {user?.role === 'admin' && (
          <Button
            variant="contained"
            startIcon={<PersonAddIcon />}
            onClick={() => handleOpenDialog()}
          >
            Invite User
          </Button>
        )}
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
                  {user?.role === 'admin' && (
                    <IconButton
                      size="small"
                      disabled={userData.id === user?.id} // Can't edit yourself
                      onClick={() => handleOpenDialog(userData)}
                    >
                      <EditIcon />
                    </IconButton>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialogOpen} onClose={handleCloseDialog}>
        <DialogTitle>
          {selectedUser ? 'Edit User' : 'Invite New User'}
        </DialogTitle>
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
            {selectedUser ? 'Save Changes' : 'Send Invite'}
          </Button>
        </DialogActions>
      </Dialog>

      <Typography variant="body2" color="textSecondary" sx={{ mt: 2 }}>
        Note: Changes to user roles should be made with caution.
      </Typography>
    </Box>
  );
}