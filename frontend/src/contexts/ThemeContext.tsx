import React, { createContext, useContext, useMemo, useState, useEffect } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { alpha } from '@mui/material';
import { colors } from '../styles/common';

interface ThemeContextType {
  toggleColorMode: () => void;
  mode: 'light' | 'dark';
}

const ThemeContext = createContext<ThemeContextType>({
  toggleColorMode: () => {},
  mode: 'light',
});

export const useThemeContext = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeContext must be used within a ThemeContextProvider');
  }
  return context;
};

// Apple-inspired dark mode colors
const darkColors = {
  primaryBlue: '#0A84FF',
  secondaryGray: '#98989D',
  successGreen: '#32D74B',
  warningYellow: '#FFD60A',
  errorRed: '#FF453A',
  background: '#1C1C1E',
  surfaceLight: '#2C2C2E',
  divider: '#38383A',
};

export function ThemeContextProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<'light' | 'dark'>(() => {
    const savedMode = localStorage.getItem('theme-mode');
    return (savedMode as 'light' | 'dark') || 'light';
  });

  const colorMode = useMemo(
    () => ({
      toggleColorMode: () => {
        setMode((prevMode) => {
          const newMode = prevMode === 'light' ? 'dark' : 'light';
          localStorage.setItem('theme-mode', newMode);
          return newMode;
        });
      },
      mode,
    }),
    [mode]
  );

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode,
          primary: {
            main: mode === 'light' ? colors.primaryBlue : darkColors.primaryBlue,
            light: mode === 'light' ? '#409cff' : '#40A9FF',
            dark: mode === 'light' ? '#0055cb' : '#096DD9',
          },
          secondary: {
            main: mode === 'light' ? colors.secondaryGray : darkColors.secondaryGray,
            light: mode === 'light' ? '#bcbcc1' : '#A6A6A6',
            dark: mode === 'light' ? '#636366' : '#8C8C8C',
          },
          error: {
            main: mode === 'light' ? colors.errorRed : darkColors.errorRed,
          },
          warning: {
            main: mode === 'light' ? colors.warningYellow : darkColors.warningYellow,
          },
          success: {
            main: mode === 'light' ? colors.successGreen : darkColors.successGreen,
          },
          background: {
            default: mode === 'light' ? colors.background : darkColors.background,
            paper: mode === 'light' ? colors.surfaceLight : darkColors.surfaceLight,
          },
          text: {
            primary: mode === 'light' ? '#1C1C1E' : '#FFFFFF',
            secondary: mode === 'light' ? colors.secondaryGray : darkColors.secondaryGray,
          },
          divider: mode === 'light' ? colors.divider : darkColors.divider,
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
        },
        shape: {
          borderRadius: 8,
        },
        components: {
          MuiCssBaseline: {
            styleOverrides: {
              body: {
                backgroundColor: mode === 'light' ? colors.background : darkColors.background,
                transition: 'background-color 0.2s ease',
              },
            },
          },
          MuiAppBar: {
            styleOverrides: {
              root: {
                backgroundColor: mode === 'light' 
                  ? alpha(colors.surfaceLight, 0.8)
                  : alpha(darkColors.surfaceLight, 0.8),
                backdropFilter: 'blur(20px)',
              },
            },
          },
          MuiButton: {
            styleOverrides: {
              root: {
                textTransform: 'none',
                borderRadius: 8,
                padding: '8px 16px',
                transition: 'all 0.2s ease-in-out',
                fontWeight: 500,
                '&:hover': {
                  transform: 'translateY(-1px)',
                },
              },
              containedPrimary: {
                background: mode === 'light'
                  ? `linear-gradient(180deg, ${colors.primaryBlue} 0%, #0062CC 100%)`
                  : `linear-gradient(180deg, ${darkColors.primaryBlue} 0%, #0062CC 100%)`,
                boxShadow: '0 2px 4px rgba(0, 122, 255, 0.1)',
                '&:hover': {
                  background: mode === 'light'
                    ? `linear-gradient(180deg, #1a86ff 0%, #0056b3 100%)`
                    : `linear-gradient(180deg, #1a86ff 0%, #0056b3 100%)`,
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
                backgroundImage: 'none',
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
          MuiDrawer: {
            styleOverrides: {
              paper: {
                backgroundColor: mode === 'light' ? colors.surfaceLight : darkColors.surfaceLight,
                borderRight: `1px solid ${mode === 'light' ? colors.divider : darkColors.divider}`,
              },
            },
          },
        },
      }),
    [mode]
  );

  // Apply theme to root HTML element
  useEffect(() => {
    document.documentElement.style.backgroundColor = 
      mode === 'light' ? colors.background : darkColors.background;
  }, [mode]);

  return (
    <ThemeContext.Provider value={colorMode}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ThemeContext.Provider>
  );
}