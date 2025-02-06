import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider as MuiThemeProvider, createTheme } from '@mui/material/styles';
import { CircularProgress, Box, CssBaseline, IconButton } from '@mui/material';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import PortalLayout from './components/layout/PortalLayout';

// Lazy loaded components
const Login = React.lazy(() => import('./pages/auth/Login'));
const Register = React.lazy(() => import('./pages/auth/Register'));
const SubmitTicket = React.lazy(() => import('./pages/public/SubmitTicket'));
const TicketSuccess = React.lazy(() => import('./pages/public/TicketSuccess'));
const TicketList = React.lazy(() => import('./pages/portal/TicketList'));
const TaskList = React.lazy(() => import('./pages/portal/TaskList'));
const UserList = React.lazy(() => import('./pages/portal/UserList'));

// Loading component
const LoadingScreen = () => (
  <Box
    display="flex"
    justifyContent="center"
    alignItems="center"
    minHeight="100vh"
  >
    <CircularProgress />
  </Box>
);

const createAppTheme = (darkMode: boolean) =>
  createTheme({
    palette: {
      mode: darkMode ? 'dark' : 'light',
      primary: {
        main: darkMode ? '#90caf9' : '#1976d2',
      },
      secondary: {
        main: darkMode ? '#f48fb1' : '#dc004e',
      },
      background: {
        default: darkMode ? '#121212' : '#fff',
        paper: darkMode ? '#1e1e1e' : '#fff',
      },
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: darkMode ? '#272727' : '#1976d2',
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundColor: darkMode ? '#1e1e1e' : '#fff',
          },
        },
      },
    },
  });

const ThemeToggle = () => {
  const { darkMode, toggleDarkMode } = useTheme();

  return (
    <IconButton
      sx={{ ml: 1, position: 'fixed', bottom: 16, right: 16, bgcolor: 'background.paper' }}
      onClick={toggleDarkMode}
      color="inherit"
    >
      {darkMode ? <Brightness7Icon /> : <Brightness4Icon />}
    </IconButton>
  );
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const AppContent = () => {
  const { darkMode } = useTheme();
  const theme = createAppTheme(darkMode);

  return (
    <MuiThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <BrowserRouter>
          <Suspense fallback={<LoadingScreen />}>
            <Routes>
              {/* Public routes */}
              <Route path="/" element={<SubmitTicket />} />
              <Route path="/success" element={<TicketSuccess />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />

              {/* Protected routes */}
              <Route path="/portal" element={<PortalLayout />}>
                <Route index element={<Navigate to="/portal/tickets" replace />} />
                <Route path="tickets" element={<TicketList />} />
                <Route path="tasks" element={<TaskList />} />
                <Route path="users" element={<UserList />} />
              </Route>

              {/* Catch all */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            <ThemeToggle />
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </MuiThemeProvider>
  );
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
