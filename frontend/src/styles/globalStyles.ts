import { createTheme } from '@mui/material/styles';
import { colors } from './common';

// Apple-inspired global styles
export const globalStyles = {
  '*': {
    margin: 0,
    padding: 0,
    boxSizing: 'border-box',
    '-webkit-font-smoothing': 'antialiased',
    '-moz-osx-font-smoothing': 'grayscale',
  },
  html: {
    fontSynthesis: 'none',
    textRendering: 'optimizeLegibility',
  },
  body: {
    margin: 0,
    backgroundColor: colors.background,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    color: '#1C1C1E',
    lineHeight: 1.5,
  },
  'button, input, textarea, select': {
    fontFamily: 'inherit',
  },
  a: {
    color: colors.primaryBlue,
    textDecoration: 'none',
    transition: 'color 0.2s ease-in-out',
    '&:hover': {
      color: '#0056b3',
    },
  },
};

// Apple-inspired MUI theme customization
export const theme = createTheme({
  palette: {
    primary: {
      main: colors.primaryBlue,
      light: '#409cff',
      dark: '#0055cb',
    },
    secondary: {
      main: colors.secondaryGray,
      light: '#bcbcc1',
      dark: '#636366',
    },
    error: {
      main: colors.errorRed,
      light: '#ff6961',
      dark: '#c30010',
    },
    warning: {
      main: colors.warningYellow,
      light: '#ffdb4d',
      dark: '#997a00',
    },
    success: {
      main: colors.successGreen,
      light: '#70dc85',
      dark: '#248a3d',
    },
    background: {
      default: colors.background,
      paper: colors.surfaceLight,
    },
    text: {
      primary: '#1C1C1E',
      secondary: colors.secondaryGray,
    },
  },
  typography: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    h1: {
      fontSize: '2.5rem',
      fontWeight: 600,
      letterSpacing: '-0.022em',
    },
    h2: {
      fontSize: '2rem',
      fontWeight: 600,
      letterSpacing: '-0.021em',
    },
    h3: {
      fontSize: '1.75rem',
      fontWeight: 600,
      letterSpacing: '-0.021em',
    },
    h4: {
      fontSize: '1.5rem',
      fontWeight: 600,
      letterSpacing: '-0.02em',
    },
    h5: {
      fontSize: '1.25rem',
      fontWeight: 600,
      letterSpacing: '-0.019em',
    },
    h6: {
      fontSize: '1.125rem',
      fontWeight: 600,
      letterSpacing: '-0.018em',
    },
    body1: {
      fontSize: '1rem',
      letterSpacing: '-0.016em',
    },
    body2: {
      fontSize: '0.875rem',
      letterSpacing: '-0.014em',
    },
    button: {
      textTransform: 'none',
      letterSpacing: '-0.016em',
    },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          padding: '8px 16px',
          transition: 'all 0.2s ease-in-out',
          textTransform: 'none',
          fontWeight: 500,
          '&:hover': {
            transform: 'translateY(-1px)',
          },
        },
        containedPrimary: {
          background: `linear-gradient(180deg, ${colors.primaryBlue} 0%, #0062CC 100%)`,
          boxShadow: '0 2px 4px rgba(0, 122, 255, 0.1)',
          '&:hover': {
            background: `linear-gradient(180deg, #1a86ff 0%, #0056b3 100%)`,
            boxShadow: '0 4px 8px rgba(0, 122, 255, 0.2)',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: '0 2px 6px rgba(0, 0, 0, 0.05)',
          borderRadius: 12,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 12,
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 8,
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          height: 24,
          fontSize: '0.8125rem',
          fontWeight: 500,
        },
      },
    },
  },
});

// Export extensions to Material-UI components
export const materialExtensions = {
  MuiCssBaseline: {
    styleOverrides: globalStyles,
  },
};