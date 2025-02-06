import {
  Box,
  AppBar,
  Toolbar,
  IconButton,
  useTheme,
  Container,
} from '@mui/material';
import { Brightness4, Brightness7 } from '@mui/icons-material';
import { Outlet } from 'react-router-dom';
import { useThemeContext } from '../../contexts/ThemeContext';

export default function PublicLayout() {
  const theme = useTheme();
  const { toggleColorMode, mode } = useThemeContext();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
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
        <Container maxWidth="lg">
          <Toolbar sx={{ justifyContent: 'flex-end' }}>
            <IconButton onClick={toggleColorMode} color="inherit">
              {mode === 'dark' ? <Brightness7 /> : <Brightness4 />}
            </IconButton>
          </Toolbar>
        </Container>
      </AppBar>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          mt: 8,
          backgroundColor: theme.palette.mode === 'light'
            ? 'grey.50'
            : 'grey.900',
          minHeight: '100vh',
        }}
      >
        <Container maxWidth="lg" sx={{ py: 4 }}>
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