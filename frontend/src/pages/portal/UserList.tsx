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
  useTheme,
  alpha,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { User } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import api from '../../utils/axios';
import { 
  colors, 
  shadows, 
  chipStyles, 
  sectionTitleStyles 
} from '../../styles/common';

interface UserDialogData {
  name: string;
  email: string;
  role: 'admin' | 'staff';
}

export default function UserList(): JSX.Element {
  const theme = useTheme();
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

  const getRoleColor = (role: string): string => {
    switch (role) {
      case 'admin':
        return colors.errorRed;
      case 'staff':
        return colors.primaryBlue;
      default:
        return colors.secondaryGray;
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
    return (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: 200,
      }}>
        <Typography 
          sx={{ 
            color: theme.palette.text.secondary,
            fontWeight: 500,
          }}
        >
          Loading users...
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ mb: 4 }}
      >
        <Typography sx={sectionTitleStyles}>
          IT Staff List
        </Typography>
      </Stack>
      
      <TableContainer 
        sx={{
          borderRadius: 3,
          boxShadow: shadows.subtle,
          backgroundColor: alpha(theme.palette.background.paper, 0.6),
          backdropFilter: 'blur(10px)',
          border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          overflow: 'hidden',
          maxHeight: { xs: 'calc(100vh - 250px)', sm: 'calc(100vh - 300px)' },
          '& .MuiTableCell-root': {
            borderColor: alpha(theme.palette.divider, 0.1),
          },
        }}
      >
        <Table stickyHeader>
          <TableHead>
            <TableRow
              sx={{
                '& .MuiTableCell-root': {
                  backgroundColor: alpha(theme.palette.background.paper, 0.8),
                  backdropFilter: 'blur(8px)',
                  fontWeight: 600,
                }
              }}
            >
              <TableCell sx={{ width: { xs: '25%', sm: '20%' } }}>Name</TableCell>
              <TableCell sx={{ width: { xs: '35%', sm: '30%' }, display: { xs: 'none', sm: 'table-cell' } }}>Email</TableCell>
              <TableCell sx={{ width: { xs: '20%', sm: '15%' } }}>Role</TableCell>
              <TableCell sx={{ width: { xs: '25%', sm: '20%' }, display: { xs: 'none', md: 'table-cell' } }}>Joined</TableCell>
              <TableCell sx={{ width: { xs: '30%', sm: '15%' } }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map((userData) => (
              <TableRow 
                key={userData.id}
                sx={{
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': { 
                    backgroundColor: alpha(theme.palette.action.hover, 0.7),
                    transform: 'translateX(6px)',
                  },
                }}
              >
                <TableCell sx={{ width: { xs: '25%', sm: '20%' } }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <PersonIcon sx={{ 
                      color: getRoleColor(userData.role),
                      fontSize: '1.2rem',
                      opacity: 0.8,
                    }} />
                    <Typography sx={{ fontWeight: 500 }}>
                      {userData.name}
                    </Typography>
                  </Stack>
                </TableCell>
                <TableCell sx={{ width: { xs: '35%', sm: '30%' }, display: { xs: 'none', sm: 'table-cell' } }}>
                  <Typography sx={{ color: theme.palette.text.secondary }}>
                    {userData.email}
                  </Typography>
                </TableCell>
                <TableCell sx={{ width: { xs: '20%', sm: '15%' } }}>
                  <Chip
                    label={userData.role}
                    size="small"
                    sx={{
                      ...chipStyles,
                      backgroundColor: alpha(getRoleColor(userData.role), 0.1),
                      color: getRoleColor(userData.role),
                      textTransform: 'capitalize',
                    }}
                  />
                </TableCell>
                <TableCell sx={{ width: { xs: '25%', sm: '20%' }, display: { xs: 'none', md: 'table-cell' } }}>
                  <Typography 
                    variant="body2"
                    sx={{ 
                      color: theme.palette.text.secondary,
                      fontWeight: 500,
                    }}
                  >
                    {formatDate(userData.createdAt)}
                  </Typography>
                </TableCell>
                <TableCell sx={{ width: { xs: '30%', sm: '15%' } }}>
                  <Stack direction="row" spacing={1}>
                    <IconButton
                      size="small"
                      disabled={userData.id === user?.id}
                      onClick={() => handleOpenDialog(userData)}
                      sx={{
                        ...chipStyles,
                        backgroundColor: alpha(colors.primaryBlue, 0.1),
                        color: colors.primaryBlue,
                        '&:hover': {
                          backgroundColor: alpha(colors.primaryBlue, 0.2),
                        },
                        '&:disabled': {
                          backgroundColor: alpha(theme.palette.action.disabledBackground, 0.3),
                          color: theme.palette.action.disabled,
                        },
                      }}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                    {user?.role === 'admin' && (
                      <IconButton
                        size="small"
                        disabled={userData.id === user?.id}
                        onClick={() => handleOpenDeleteDialog(userData)}
                        sx={{
                          ...chipStyles,
                          backgroundColor: alpha(colors.errorRed, 0.1),
                          color: colors.errorRed,
                          '&:hover': {
                            backgroundColor: alpha(colors.errorRed, 0.2),
                          },
                          '&:disabled': {
                            backgroundColor: alpha(theme.palette.action.disabledBackground, 0.3),
                            color: theme.palette.action.disabled,
                          },
                        }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    )}
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
            {users.length === 0 && (
              <TableRow>
                <TableCell colSpan={5}>
                  <Box 
                    sx={{ 
                      textAlign: 'center',
                      py: 4,
                    }}
                  >
                    <Typography 
                      variant="body1"
                      sx={{ 
                        color: theme.palette.text.secondary,
                        fontWeight: 500,
                      }}
                    >
                      No users found
                    </Typography>
                  </Box>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Typography 
        variant="body2" 
        sx={{ 
          mt: 2,
          color: alpha(theme.palette.text.secondary, 0.8),
          backgroundColor: alpha(colors.warningYellow, 0.1),
          border: `1px solid ${alpha(colors.warningYellow, 0.2)}`,
          borderRadius: 1,
          p: 1,
          display: 'inline-block',
        }}
      >
        Note: Changes to user roles should be made with caution.
      </Typography>

      <Dialog 
        open={dialogOpen} 
        onClose={handleCloseDialog} 
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
          <Typography sx={sectionTitleStyles}>
            Edit User
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Name"
                value={dialogData.name}
                onChange={(e) => setDialogData((prev) => ({ ...prev, name: e.target.value }))}
                required
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                    backgroundColor: theme.palette.background.paper,
                    transition: 'all 0.2s ease-in-out',
                    '&:hover': {
                      backgroundColor: alpha(theme.palette.background.paper, 0.8),
                    },
                    '&.Mui-focused': {
                      backgroundColor: alpha(theme.palette.background.paper, 0.9),
                      boxShadow: shadows.subtle,
                    },
                  },
                }}
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
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                    backgroundColor: theme.palette.background.paper,
                    transition: 'all 0.2s ease-in-out',
                    '&:hover': {
                      backgroundColor: alpha(theme.palette.background.paper, 0.8),
                    },
                    '&.Mui-focused': {
                      backgroundColor: alpha(theme.palette.background.paper, 0.9),
                      boxShadow: shadows.subtle,
                    },
                  },
                }}
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
                  sx={{
                    borderRadius: 2,
                    backgroundColor: theme.palette.background.paper,
                    transition: 'all 0.2s ease-in-out',
                    '&:hover': {
                      backgroundColor: alpha(theme.palette.background.paper, 0.8),
                    },
                    '&.Mui-focused': {
                      backgroundColor: alpha(theme.palette.background.paper, 0.9),
                      boxShadow: shadows.subtle,
                    },
                  }}
                >
                  <MenuItem value="staff">Staff</MenuItem>
                  <MenuItem value="admin">Admin</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 2 }}>
          <Button 
            onClick={handleCloseDialog}
            sx={{
              ...chipStyles,
              color: theme.palette.text.primary,
              '&:hover': {
                backgroundColor: alpha(theme.palette.text.primary, 0.1),
              },
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!dialogData.name || !dialogData.email}
            sx={{
              ...chipStyles,
              backgroundColor: colors.primaryBlue,
              color: 'white',
              '&:hover': {
                backgroundColor: alpha(colors.primaryBlue, 0.9),
              },
              '&:disabled': {
                backgroundColor: alpha(colors.primaryBlue, 0.5),
              },
            }}
          >
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog 
        open={deleteDialogOpen} 
        onClose={handleCloseDeleteDialog}
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
          <Typography sx={sectionTitleStyles}>
            Confirm Delete User
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          <Box sx={{
            p: 2,
            backgroundColor: alpha(colors.errorRed, 0.1),
            borderRadius: 2,
            border: `1px solid ${alpha(colors.errorRed, 0.2)}`,
          }}>
            <Typography>
              Are you sure you want to delete user <strong>{selectedUser?.name}</strong>?
            </Typography>
            <Typography 
              sx={{ 
                mt: 1,
                color: alpha(colors.errorRed, 0.8),
                fontSize: '0.875rem',
              }}
            >
              This action cannot be undone.
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 2 }}>
          <Button 
            onClick={handleCloseDeleteDialog}
            sx={{
              ...chipStyles,
              color: theme.palette.text.primary,
              '&:hover': {
                backgroundColor: alpha(theme.palette.text.primary, 0.1),
              },
            }}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleDelete}
            sx={{
              ...chipStyles,
              backgroundColor: colors.errorRed,
              color: 'white',
              '&:hover': {
                backgroundColor: alpha(colors.errorRed, 0.9),
              },
            }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}