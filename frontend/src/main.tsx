import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider as MuiThemeProvider, createTheme } from '@mui/material/styles';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import CssBaseline from '@mui/material/CssBaseline';
import { Global } from '@emotion/react';
import App from './App';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';
import { baseTheme, getGlobalStyles } from './styles/globalStyles';

// Create MUI theme
const muiTheme = createTheme({
  palette: {
    primary: {
      main: baseTheme.colors.primaryBlue,
    },
    secondary: {
      main: baseTheme.colors.secondaryGray,
    },
    error: {
      main: baseTheme.colors.errorRed,
    },
    warning: {
      main: baseTheme.colors.warningYellow,
    },
    success: {
      main: baseTheme.colors.successGreen,
    },
    background: {
      default: baseTheme.colors.background,
      paper: baseTheme.colors.surfaceLight,
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    fontSize: 14,
    fontWeightRegular: 400,
    fontWeightMedium: 500,
    fontWeightBold: 600,
  },
  shape: {
    borderRadius: baseTheme.borderRadius.sm,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderColor: baseTheme.colors.divider,
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: baseTheme.borderRadius.lg,
        },
      },
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <MuiThemeProvider theme={muiTheme}>
        <ThemeProvider>
          <AuthProvider>
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <CssBaseline />
              <Global styles={getGlobalStyles(baseTheme)} />
              <App />
            </LocalizationProvider>
          </AuthProvider>
        </ThemeProvider>
      </MuiThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);
