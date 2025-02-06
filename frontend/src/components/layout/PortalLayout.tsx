import { useState } from 'react';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  Button,
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
} from '@mui/icons-material';
import { Navigate, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useThemeContext } from '../../contexts/ThemeContext';

const DRAWER_WIDTH = 240;

export default function PortalLayout() {
  const { user, logout, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const { toggleColorMode, mode } = useThemeContext();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);

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
    ...(user.role === 'admin' ? [{ text: 'Users', icon: <Group />, path: '/portal/users' }] : []),
  ];

  const drawer = (
    <Box>
      <Toolbar>
        <Typography variant="h6" noWrap>
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
            ? 'rgba(255, 255, 255, 0.8)'
            : 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(20px)',
          borderBottom: `1px solid ${theme.palette.divider}`,
        }}
      >
        <Container maxWidth="lg">
          <Toolbar disableGutters>
            <IconButton
              color="inherit"
              edge="start"
              onClick={handleDrawerToggle}
              sx={{ mr: 2, display: { md: 'none' } }}
            >
              <MenuIcon />
            </IconButton>

            <Typography
              variant="h6"
              noWrap
              sx={{ flexGrow: 1, display: { xs: 'none', md: 'block' } }}
            >
              Help Desk Portal
            </Typography>

            {!isMobile && (
              <Box sx={{ display: 'flex', gap: 2 }}>
                {menuItems.map((item) => (
                  <Button
                    key={item.text}
                    color="inherit"
                    onClick={() => navigate(item.path)}
                    sx={{
                      borderRadius: 2,
                      ...(location.pathname === item.path && {
                        backgroundColor: 'action.selected',
                      }),
                    }}
                  >
                    {item.text}
                  </Button>
                ))}
              </Box>
            )}

            <IconButton onClick={toggleColorMode} color="inherit" sx={{ ml: 2 }}>
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
          p: 3,
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          mt: 8,
          backgroundColor: theme.palette.mode === 'light'
            ? 'grey.50'
            : 'grey.900',
        }}
      >
        <Container maxWidth="lg">
          <Box
            sx={{
              backgroundColor: theme.palette.background.paper,
              borderRadius: 2,
              boxShadow: theme.shadows[1],
              p: { xs: 2, sm: 3 },
            }}
          >
            <Outlet />
          </Box>
        </Container>
      </Box>
    </Box>
  );
}