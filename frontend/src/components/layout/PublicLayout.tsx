import { useState } from 'react';
import {
  Box,
  AppBar,
  Toolbar,
  IconButton,
  useTheme,
  Container,
  Drawer,
  List,
  ListItemText,
  ListItemIcon,
  Typography,
  useMediaQuery,
  ListItemButton,
  Divider,
  alpha,
} from '@mui/material';
import {
  Brightness4,
  Brightness7,
  QuestionAnswer as FAQIcon,
  Help as HelpIcon,
  Menu as MenuIcon,
  CreateOutlined as SubmitIcon,
} from '@mui/icons-material';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useThemeContext } from '../../contexts/ThemeContext';
import {
  shadows,
  sectionTitleStyles,
  chipStyles,
} from '../../styles/common';

const DRAWER_WIDTH = 280;

export default function PublicLayout() {
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { toggleColorMode, mode } = useThemeContext();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const menuItems = [
    {
      text: 'Submit Ticket',
      subText: 'Get help from our support team',
      icon: <SubmitIcon />,
      path: '/submit-ticket',
    },
    {
      text: 'Common Solutions',
      subText: 'Browse solutions by category',
      icon: <FAQIcon />,
      path: '/solutions',
    },
    {
      text: 'Frequently Asked Questions',
      subText: 'Find answers to common questions',
      icon: <HelpIcon />,
      path: '/faq',
    },
  ];

  const drawerContent = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: 3, pb: 2 }}>
        <Typography variant="h6" sx={sectionTitleStyles}>
          Help & Solutions
        </Typography>
      </Box>
      <Divider sx={{ mx: 2 }} />
      <List sx={{ flex: 1, px: 1 }}>
        {menuItems.map((item) => (
          <ListItemButton
            key={item.text}
            onClick={() => {
              navigate(item.path);
              if (isMobile) setMobileOpen(false);
            }}
            selected={location.pathname === item.path}
            sx={{
              mb: 1,
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
              secondary={item.subText}
              primaryTypographyProps={{
                sx: {
                  fontWeight: location.pathname === item.path ? 600 : 400,
                  color: theme.palette.text.primary,
                },
              }}
              secondaryTypographyProps={{
                sx: { color: theme.palette.text.secondary },
              }}
            />
          </ListItemButton>
        ))}
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
            <Typography variant="h6" sx={sectionTitleStyles}>
              Help Desk Portal
            </Typography>
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
          width: { sm: DRAWER_WIDTH },
          flexShrink: { sm: 0 },
        }}
      >
        <Drawer
          variant={isMobile ? 'temporary' : 'permanent'}
          anchor="left"
          open={isMobile ? mobileOpen : true}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true,
          }}
          sx={{
            '& .MuiDrawer-paper': {
              width: DRAWER_WIDTH,
              boxSizing: 'border-box',
              backgroundColor: theme.palette.background.default,
              borderRight: `1px solid ${theme.palette.divider}`,
              boxShadow: shadows.subtle,
            },
          }}
        >
          <Toolbar />
          {drawerContent}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { xs: '100%', sm: `calc(100% - ${DRAWER_WIDTH}px)` },
          mt: { xs: 7, sm: 8 },
          backgroundColor: theme.palette.background.default,
          transition: theme.transitions.create(['background-color'], {
            duration: theme.transitions.duration.standard,
          }),
          minHeight: '100vh',
          p: { xs: 2, sm: 3, md: 4 },
        }}
      >
        <Box
          sx={{
            backgroundColor: theme.palette.background.paper,
            borderRadius: 2,
            boxShadow: shadows.subtle,
            p: { xs: 2, sm: 3, md: 4 },
            height: '100%',
            minHeight: '500px',
            transition: 'box-shadow 0.2s ease-in-out',
            '&:hover': {
              boxShadow: shadows.medium,
            },
          }}
        >
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}