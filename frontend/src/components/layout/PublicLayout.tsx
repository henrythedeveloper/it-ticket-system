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
} from '@mui/material';
import {
  Brightness4,
  Brightness7,
  QuestionAnswer as FAQIcon,
  Help as HelpIcon,
  Menu as MenuIcon,
} from '@mui/icons-material';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useThemeContext } from '../../contexts/ThemeContext';

const DRAWER_WIDTH = 280;

export default function PublicLayout() {
  const theme = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { toggleColorMode, mode } = useThemeContext();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Only show the drawer on the submit ticket page
  const showDrawer = location.pathname === '/submit-ticket';

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const drawerContent = (
    <Box sx={{ mt: 2 }}>
      <Typography variant="h6" sx={{ px: 3, mb: 2 }}>
        Help & Solutions
      </Typography>
      <Divider />
      <List>
        <ListItemButton onClick={() => {
          if (isMobile) setMobileOpen(false);
          navigate('/solutions');
        }}>
          <ListItemIcon>
            <FAQIcon />
          </ListItemIcon>
          <ListItemText 
            primary="Common Solutions" 
            secondary="Browse solutions by category"
          />
        </ListItemButton>
        <ListItemButton onClick={() => {
          if (isMobile) setMobileOpen(false);
          navigate('/faq');
        }}>
          <ListItemIcon>
            <HelpIcon />
          </ListItemIcon>
          <ListItemText 
            primary="Frequently Asked Questions" 
            secondary="Find answers to common questions"
          />
        </ListItemButton>
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar 
        position="fixed"
        elevation={0}
        sx={{
          width: showDrawer && !isMobile ? `calc(100% - ${DRAWER_WIDTH}px)` : '100%',
          ml: showDrawer && !isMobile ? `${DRAWER_WIDTH}px` : 0,
          backgroundColor: theme.palette.mode === 'light' 
            ? theme.palette.primary.main
            : 'rgba(0, 0, 0, 0.8)',
          transition: theme.transitions.create(['margin', 'width'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen,
          }),
        }}
      >
        <Container maxWidth="xl">
          <Toolbar 
            sx={{ 
              justifyContent: 'space-between',
              minHeight: { xs: 56, sm: 64 }
            }}
          >
            {showDrawer && isMobile && (
              <IconButton
                color="inherit"
                aria-label="open drawer"
                edge="start"
                onClick={handleDrawerToggle}
                sx={{ ml: -1 }}
              >
                <MenuIcon />
              </IconButton>
            )}
            <Typography 
              variant="h6" 
              component="div" 
              sx={{ 
                display: { xs: 'none', sm: 'block' },
                color: 'inherit'
              }}
            >
              Help Desk Portal
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <IconButton onClick={toggleColorMode} color="inherit">
                {mode === 'dark' ? <Brightness7 /> : <Brightness4 />}
              </IconButton>
            </Box>
          </Toolbar>
        </Container>
      </AppBar>

      {showDrawer && (
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
              keepMounted: true, // Better mobile performance
            }}
            sx={{
              '& .MuiDrawer-paper': {
                width: DRAWER_WIDTH,
                boxSizing: 'border-box',
                backgroundColor: theme.palette.background.default,
                borderRight: `1px solid ${theme.palette.divider}`,
              },
            }}
          >
            <Toolbar />
            {drawerContent}
          </Drawer>
        </Box>
      )}

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: {
            xs: '100%',
            sm: showDrawer ? `calc(100% - ${DRAWER_WIDTH}px)` : '100%'
          },
          mt: { xs: 7, sm: 8 },
          backgroundColor: theme.palette.mode === 'light'
            ? 'grey.50'
            : 'grey.900',
          transition: theme.transitions.create(['width', 'margin', 'background-color'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen,
          }),
        }}
      >
        <Container
          maxWidth="xl"
          sx={{
            py: { xs: 2, sm: 3 },
            px: { xs: 2, sm: 3, md: 4 }  // Increased horizontal padding
          }}
        >
          <Box
            sx={{
              backgroundColor: theme.palette.background.paper,
              borderRadius: { xs: 1, sm: 2 },
              boxShadow: theme.shadows[1],
              p: { xs: 2, sm: 3, md: 4 },  // Increased padding at all breakpoints
              overflow: 'auto',
              height: '100%',  // Ensure full height
              minHeight: '500px',  // Minimum height to prevent squishing
              maxWidth: '100%',  // Ensure content doesn't overflow container
              '& > *': {  // Add spacing between child elements
                mb: { xs: 2, sm: 3 },
                '&:last-child': {
                  mb: 0
                }
              }
            }}
          >
            <Outlet />
          </Box>
        </Container>
      </Box>
    </Box>
  );
}