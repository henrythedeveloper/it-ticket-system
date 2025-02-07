import { useState } from 'react';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  Container,
  CircularProgress,
  IconButton,
  useTheme,
  useMediaQuery,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Brightness4,
  Brightness7,
  Dashboard,
  Group,
  Assignment,
  AssignmentTurnedIn,
  ExitToApp,
  Edit as EditIcon,
} from '@mui/icons-material';
import { Navigate, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useThemeContext } from '../../contexts/ThemeContext';
import UserProfileDialog from '../UserProfileDialog';

const DRAWER_WIDTH = 240;

export default function PortalLayout() {
  const { user, logout, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const { toggleColorMode, mode } = useThemeContext();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const menuItems = [
    { text: 'Dashboard', icon: <Dashboard />, path: '/portal' },
    { text: 'Tickets', icon: <Assignment />, path: '/portal/tickets' },
    { text: 'Tasks', icon: <AssignmentTurnedIn />, path: '/portal/tasks' },
    { text: 'Users', icon: <Group />, path: '/portal/users' },
  ];

  const drawer = (
    <Box>
      <Toolbar>
        <Typography variant="h6" noWrap sx={{ color: theme.palette.text.primary }}>
          Help Desk Portal
        </Typography>
      </Toolbar>
      <Divider />
      <List>
        {menuItems.map((item) => (
          <ListItem key={item.text} disablePadding>
            <ListItemButton
              onClick={() => {
                navigate(item.path);
                if (isMobile) setMobileOpen(false);
              }}
              selected={location.pathname === item.path}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
      <Divider />
      <List>
        <ListItem>
          <ListItemText
            primary={user.name}
            secondary={user.email}
            primaryTypographyProps={{ variant: 'subtitle2' }}
            secondaryTypographyProps={{ variant: 'caption' }}
          />
          <IconButton 
            onClick={() => setProfileDialogOpen(true)}
            size="small"
            sx={{ ml: 1 }}
          >
            <EditIcon fontSize="small" />
          </IconButton>
        </ListItem>
        <ListItem disablePadding>
          <ListItemButton onClick={logout}>
            <ListItemIcon>
              <ExitToApp />
            </ListItemIcon>
            <ListItemText primary="Logout" />
          </ListItemButton>
        </ListItem>
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          zIndex: theme.zIndex.drawer + 1,
          backgroundColor: theme.palette.mode === 'light' 
            ? theme.palette.primary.main
            : 'rgba(0, 0, 0, 0.8)',
        }}
      >
        <Container maxWidth="xl">
          <Toolbar 
            disableGutters 
            sx={{ 
              justifyContent: isMobile ? 'space-between' : 'flex-end',
              minHeight: { xs: 56, sm: 64 }
            }}
          >
            {isMobile && (
              <IconButton
                color="inherit"
                onClick={handleDrawerToggle}
                sx={{ ml: -1 }}
              >
                <MenuIcon />
              </IconButton>
            )}
            <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
              {isMobile && (
                <Typography variant="h6" noWrap>
                  Help Desk
                </Typography>
              )}
            </Box>
            <IconButton onClick={toggleColorMode} color="inherit">
              {mode === 'dark' ? <Brightness7 /> : <Brightness4 />}
            </IconButton>
          </Toolbar>
        </Container>
      </AppBar>

      <Box
        component="nav"
        sx={{
          width: { md: DRAWER_WIDTH },
          flexShrink: { md: 0 },
        }}
      >
        {isMobile ? (
          <Drawer
            variant="temporary"
            anchor="left"
            open={mobileOpen}
            onClose={handleDrawerToggle}
            ModalProps={{ keepMounted: true }}
            sx={{
              display: { xs: 'block', md: 'none' },
              '& .MuiDrawer-paper': { 
                boxSizing: 'border-box', 
                width: DRAWER_WIDTH,
                backgroundColor: theme.palette.background.default,
              },
            }}
          >
            {drawer}
          </Drawer>
        ) : (
          <Drawer
            variant="permanent"
            sx={{
              display: { xs: 'none', md: 'block' },
              '& .MuiDrawer-paper': { 
                boxSizing: 'border-box', 
                width: DRAWER_WIDTH,
                backgroundColor: theme.palette.background.default,
                borderRight: `1px solid ${theme.palette.divider}`,
              },
            }}
            open
          >
            {drawer}
          </Drawer>
        )}
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { xs: '100%', md: `calc(100% - ${DRAWER_WIDTH}px)` },
          mt: { xs: 7, sm: 8 },
          backgroundColor: theme.palette.mode === 'light'
            ? 'grey.50'
            : 'grey.900',
          transition: 'background-color 0.2s',
          minHeight: '100vh',
        }}
      >
        <Container
          maxWidth="xl"
          sx={{
            py: { xs: 2, sm: 3 },
            px: { xs: 2, sm: 3, md: 4 }
          }}
        >
          <Box
            sx={{
              backgroundColor: theme.palette.background.paper,
              borderRadius: { xs: 1, sm: 2 },
              boxShadow: theme.shadows[1],
              p: { xs: 2, sm: 3, md: 4 },
              overflow: 'auto',
              height: '100%',
              minHeight: '500px',
            }}
          >
            <Outlet />
          </Box>
        </Container>
      </Box>

      <UserProfileDialog
        open={profileDialogOpen}
        onClose={() => setProfileDialogOpen(false)}
      />
    </Box>
  );
}