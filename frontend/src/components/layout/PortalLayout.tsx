import React, { useState } from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import {
  AppBar,
  Box,
  CssBaseline,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Menu,
  MenuItem,
  Avatar,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Task as TaskIcon,
  Person as PersonIcon,
  DarkMode as DarkModeIcon,
  LightMode as LightModeIcon,
  ConfirmationNumber as TicketIcon,
} from '@mui/icons-material';
import UserProfileDialog from '../UserProfileDialog';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../contexts/ThemeContext';
import { User } from '../../types';
import axios from '../../utils/axios';

const drawerWidth = 240;

const PortalLayout = () => {
  const { user, logout } = useAuth();
  const { theme, mode, toggleColorMode } = useTheme();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleProfileClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleProfileClose = () => {
    setAnchorEl(null);
  };

  const handleEditProfile = () => {
    handleProfileClose();
    setProfileDialogOpen(true);
  };

  const handleLogout = () => {
    handleProfileClose();
    logout();
    navigate('/login');
  };

  const handleProfileSave = async (userData: Partial<User>) => {
    try {
      await axios.patch(`/api/users/${user?.id}`, userData);
      setProfileDialogOpen(false);
      window.location.reload(); // Refresh to update user data
    } catch (error) {
      console.error('Error updating profile:', error);
    }
  };

  const drawer = (
    <Box sx={{ overflow: 'auto' }}>
      <Toolbar />
      <List>
        {user?.role === 'admin' && (
          <ListItem disablePadding>
            <ListItemButton component={Link} to="/portal/users">
              <ListItemIcon>
                <PersonIcon />
              </ListItemIcon>
              <ListItemText primary="Users" />
            </ListItemButton>
          </ListItem>
        )}
        <ListItem disablePadding>
          <ListItemButton component={Link} to="/portal/tasks">
            <ListItemIcon>
              <TaskIcon />
            </ListItemIcon>
            <ListItemText primary="Tasks" />
          </ListItemButton>
        </ListItem>
        <ListItem disablePadding>
          <ListItemButton component={Link} to="/portal/tickets">
            <ListItemIcon>
              <TicketIcon />
            </ListItemIcon>
            <ListItemText primary="Tickets" />
          </ListItemButton>
        </ListItem>
      </List>
    </Box>
  );

  if (!user) {
    return null;
  }

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      <AppBar
        position="fixed"
        sx={{
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          ml: { sm: `${drawerWidth}px` },
          backgroundColor: theme.colors.primaryBlue,
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            Help Desk Portal
          </Typography>
          <IconButton color="inherit" onClick={toggleColorMode}>
            {mode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
          </IconButton>
          <IconButton onClick={handleProfileClick} size="small" sx={{ ml: 2 }}>
            <Avatar sx={{ width: 32, height: 32, bgcolor: theme.colors.secondaryGray }}>
              {user.name[0].toUpperCase()}
            </Avatar>
          </IconButton>
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleProfileClose}
            onClick={handleProfileClose}
          >
            <MenuItem onClick={handleEditProfile}>Edit Profile</MenuItem>
            <Divider />
            <MenuItem onClick={handleLogout}>Logout</MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>
      <Box
        component="nav"
        sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true,
          }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
              backgroundColor: theme.colors.surfaceLight,
            },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
              backgroundColor: theme.colors.surfaceLight,
            },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          backgroundColor: theme.colors.background,
          minHeight: '100vh',
        }}
      >
        <Toolbar />
        <Outlet />
      </Box>

      {user && (
        <UserProfileDialog
          open={profileDialogOpen}
          onClose={() => setProfileDialogOpen(false)}
          onSave={handleProfileSave}
          user={user}
          currentUser={user}
        />
      )}
    </Box>
  );
};

export default PortalLayout;