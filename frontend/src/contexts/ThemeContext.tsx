import React, { createContext, useContext, useState } from 'react';
import { Theme } from '../types';
import { alpha } from '@mui/material/styles';
import { baseTheme, materialExtensions } from '../styles/globalStyles';

interface ThemeContextType {
  theme: Theme;
  isDarkMode: boolean;
  mode: 'light' | 'dark';
  toggleTheme: () => void;
  toggleColorMode: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [theme, setTheme] = useState<Theme>(baseTheme);
  const [mode, setMode] = useState<'light' | 'dark'>('light');

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
    setMode(prev => prev === 'light' ? 'dark' : 'light');
    if (!isDarkMode) {
      // Switch to dark theme
      setTheme({
        ...baseTheme,
        colors: {
          ...baseTheme.colors,
          background: '#212529',
          surfaceLight: '#343a40',
          divider: '#495057',
          secondaryGray: '#adb5bd',
        },
      });
    } else {
      // Switch back to light theme
      setTheme(baseTheme);
    }
  };

  const toggleColorMode = () => {
    toggleTheme();
  };

  return (
    <ThemeContext.Provider value={{ theme, isDarkMode, mode, toggleTheme, toggleColorMode }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

// Re-export useTheme as useThemeContext for backward compatibility
export const useThemeContext = useTheme;

// Common styles using theme
export const getCommonButtonStyles = (theme: Theme) => ({
  backgroundColor: theme.colors.primaryBlue,
  color: theme.colors.surfaceLight,
  '&:hover': {
    backgroundColor: alpha(theme.colors.primaryBlue, 0.8),
  },
  '&:disabled': {
    backgroundColor: theme.colors.secondaryGray,
    color: theme.colors.surfaceLight,
  },
  borderRadius: theme.borderRadius.sm,
  textTransform: 'none',
  letterSpacing: 0.5,
  fontWeight: 500,
  fontSize: theme.typography.medium,
});

export const getCommonCardStyles = (theme: Theme) => ({
  backgroundColor: theme.colors.surfaceLight,
  borderRadius: theme.borderRadius.md,
  boxShadow: theme.shadows.md,
  border: `1px solid ${theme.colors.divider}`,
});

export const getCommonDialogStyles = (theme: Theme) => ({
  '& .MuiDialog-paper': {
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
  },
});

export const getCommonTypographyStyles = (theme: Theme) => ({
  color: theme.colors.secondaryGray,
  fontSize: theme.typography.medium,
});