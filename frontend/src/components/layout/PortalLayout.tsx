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
  alpha,
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
import {
  shadows,
  sectionTitleStyles,
  chipStyles,
} from '../../styles/common';

const DRAWER_WIDTH = 280;

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
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        backgroundColor: theme.palette.background.default,
      }}>
        <CircularProgress sx={{ color: theme.palette.primary.main }} />
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
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: 3, pb: 2 }}>
        <Typography variant="h6" sx={sectionTitleStyles}>
          Help Desk Portal
        </Typography>
      </Box>
      <Divider sx={{ mx: 2 }} />
      <List sx={{ flex: 1, px: 1 }}>
        {menuItems.map((item) => (
          <ListItem key={item.text} disablePadding sx={{ mb: 1 }}>
            <ListItemButton
              onClick={() => {
                navigate(item.path);
                if (isMobile) setMobileOpen(false);
              }}
              selected={location.pathname === item.path}
              sx={{
                borderRadius: 2,
                transition: 'all 0.2s ease-in-out',
                '&.Mui-selected': {
                  backgroundColor: alpha(theme.palette.primary.main, 0.1),
                  '&:hover': {
                    backgroundColor: alpha(theme.palette.primary.main, 0.15),
                  },
                },
                '&:hover': {
                  backgroundColor: alpha(theme.palette.action.hover, 0.7),
                  transform: 'translateX(4px)',
                },
              }}
            >
              <ListItemIcon
                sx={{
                  color: location.pathname === item.path
                    ? theme.palette.primary.main
                    : theme.palette.text.secondary,
                  minWidth: 40,
                }}
              >
                {item.icon}
              </ListItemIcon>
              <ListItemText
                primary={item.text}
                sx={{
                  '& .MuiTypography-root': {
                    fontWeight: location.pathname === item.path ? 600 : 400,
                  },
                }}
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
      <Divider sx={{ mx: 2 }} />
      <Box sx={{ p: 2 }}>
        <ListItem sx={{ 
          backgroundColor: alpha(theme.palette.background.paper, 0.6),
          borderRadius: 2,
          mb: 1,
          p: 2,
        }}>
          <ListItemText
            primary={user.name}
            secondary={user.email}
            primaryTypographyProps={{ 
              variant: 'subtitle2',
              sx: { fontWeight: 600, color: theme.palette.text.primary }
            }}
            secondaryTypographyProps={{ 
              variant: 'caption',
              sx: { color: theme.palette.text.secondary }
            }}
          />
          <IconButton 
            onClick={() => setProfileDialogOpen(true)}
            size="small"
            sx={{ 
              ml: 1,
              backgroundColor: alpha(theme.palette.primary.main, 0.1),
              '&:hover': {
                backgroundColor: alpha(theme.palette.primary.main, 0.2),
              }
            }}
          >
            <EditIcon 
              fontSize="small"
              sx={{ color: theme.palette.primary.main }}
            />
          </IconButton>
        </ListItem>
        <ListItemButton
          onClick={logout}
          sx={{
            borderRadius: 2,
            transition: 'all 0.2s ease-in-out',
            '&:hover': {
              backgroundColor: alpha(theme.palette.error.main, 0.1),
              color: theme.palette.error.main,
            },
          }}
        >
          <ListItemIcon sx={{ minWidth: 40 }}>
            <ExitToApp color="error" />
          </ListItemIcon>
          <ListItemText primary="Logout" />
        </ListItemButton>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          zIndex: theme.zIndex.drawer + 1,
          backdropFilter: 'blur(10px)',
          backgroundColor: alpha(
            theme.palette.background.paper,
            mode === 'light' ? 0.7 : 0.8
          ),
          borderBottom: `1px solid ${theme.palette.divider}`,
        }}
      >
        <Container maxWidth="xl">
          <Toolbar 
            disableGutters 
            sx={{ 
              justifyContent: 'space-between',
              minHeight: { xs: 56, sm: 64 }
            }}
          >
            {isMobile && (
              <IconButton
                onClick={handleDrawerToggle}
                sx={{
                  ...chipStyles,
                  backgroundColor: alpha(theme.palette.primary.main, 0.1),
                  '&:hover': {
                    backgroundColor: alpha(theme.palette.primary.main, 0.2),
                  }
                }}
              >
                <MenuIcon sx={{ color: theme.palette.primary.main }} />
              </IconButton>
            )}
            <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
              {isMobile && (
                <Typography variant="h6" sx={sectionTitleStyles}>
                  Help Desk
                </Typography>
              )}
            </Box>
            <IconButton 
              onClick={toggleColorMode}
              sx={{
                ...chipStyles,
                backgroundColor: alpha(theme.palette.primary.main, 0.1),
                '&:hover': {
                  backgroundColor: alpha(theme.palette.primary.main, 0.2),
                }
              }}
            >
              {mode === 'dark' ? (
                <Brightness7 sx={{ color: theme.palette.primary.main }} />
              ) : (
                <Brightness4 sx={{ color: theme.palette.primary.main }} />
              )}
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
                borderRight: `1px solid ${theme.palette.divider}`,
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
                boxShadow: shadows.subtle,
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
          backgroundColor: theme.palette.background.default,
          transition: theme.transitions.create(['background-color'], {
            duration: theme.transitions.duration.standard,
          }),
          minHeight: '100vh',
          p: { xs: 2, sm: 3, md: 4 },
        }}
      >
        <Outlet />
      </Box>

      <UserProfileDialog
        open={profileDialogOpen}
        onClose={() => setProfileDialogOpen(false)}
      />
    </Box>
  );
}