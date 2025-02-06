import React from 'react';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  Button,
  Container,
  CircularProgress,
  Paper,
} from '@mui/material';
import { Navigate, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export default function PortalLayout() {
  const { user, logout, isLoading } = useAuth();
  const navigate = useNavigate();

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  // Redirect to login if not authenticated
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <Box>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Help Desk Portal
          </Typography>
          <Button color="inherit" onClick={() => navigate('/portal')}>
            Dashboard
          </Button>
          {user?.role === 'admin' && (
            <Button color="inherit" onClick={() => navigate('/portal/users')}>
              Users
            </Button>
          )}
          <Button color="inherit" onClick={() => navigate('/portal/tickets')}>
            Tickets
          </Button>
          <Button color="inherit" onClick={() => navigate('/portal/tasks')}>
            Tasks
          </Button>
          <Button color="inherit" onClick={() => logout()}>
            Logout
          </Button>
        </Toolbar>
      </AppBar>
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Paper sx={{ p: 3 }}>
          <Outlet />
        </Paper>
      </Container>
    </Box>
  );
}