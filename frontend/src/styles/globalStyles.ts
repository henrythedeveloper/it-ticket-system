import { css, type SerializedStyles } from '@emotion/react';
import { Theme } from '../types';

export const baseTheme: Theme = {
  colors: {
    primaryBlue: '#007bff',
    secondaryGray: '#6c757d',
    successGreen: '#28a745',
    warningYellow: '#ffc107',
    errorRed: '#dc3545',
    background: '#f8f9fa',
    surfaceLight: '#ffffff',
    divider: '#dee2e6',
  },
  typography: {
    subtle: '0.875rem',
    medium: '1rem',
    large: '1.25rem',
    strong: '1.5rem',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  shadows: {
    sm: '0 1px 3px rgba(0,0,0,0.12)',
    md: '0 4px 6px rgba(0,0,0,0.15)',
    lg: '0 10px 15px rgba(0,0,0,0.18)',
  },
  borderRadius: {
    sm: 4,
    md: 8,
    lg: 12,
  },
};

export const getGlobalStyles = (theme: Theme): SerializedStyles => css`
  .page-container {
    min-height: 100vh;
    background-color: ${theme.colors.background};
    padding: ${theme.spacing.md}px;
    display: flex;
    flex-direction: column;
  }

  .text-subtle {
    font-size: ${theme.typography.subtle};
    color: ${theme.colors.secondaryGray};
  }

  .text-medium {
    font-size: ${theme.typography.medium};
    color: ${theme.colors.secondaryGray};
  }

  .text-large {
    font-size: ${theme.typography.large};
    font-weight: 500;
    color: ${theme.colors.secondaryGray};
  }

  .text-strong {
    font-size: ${theme.typography.strong};
    font-weight: 600;
    color: ${theme.colors.secondaryGray};
  }

  .card {
    background-color: ${theme.colors.surfaceLight};
    border-radius: ${theme.borderRadius.md}px;
    box-shadow: ${theme.shadows.md};
    padding: ${theme.spacing.md}px;
    margin: ${theme.spacing.sm}px;
  }

  .form-group {
    margin-bottom: ${theme.spacing.md}px;
  }

  .form-label {
    margin-bottom: ${theme.spacing.xs}px;
    font-size: ${theme.typography.medium};
    color: ${theme.colors.secondaryGray};
  }

  .form-input {
    background-color: ${theme.colors.background};
    border: 1px solid ${theme.colors.divider};
    border-radius: ${theme.borderRadius.sm}px;
    padding: ${theme.spacing.sm}px;
    width: 100%;
    &:focus {
      border-color: ${theme.colors.primaryBlue};
      outline: none;
    }
  }

  .button-primary {
    background-color: ${theme.colors.primaryBlue};
    color: ${theme.colors.surfaceLight};
    border: none;
    border-radius: ${theme.borderRadius.sm}px;
    padding: ${theme.spacing.sm}px ${theme.spacing.md}px;
    cursor: pointer;
    &:hover {
      background-color: ${theme.colors.primaryBlue}dd;
    }
    &:disabled {
      background-color: ${theme.colors.secondaryGray};
      cursor: not-allowed;
    }
  }

  .status-success {
    color: ${theme.colors.successGreen};
  }

  .status-warning {
    color: ${theme.colors.warningYellow};
  }

  .status-error {
    color: ${theme.colors.errorRed};
  }

  .divider {
    border-bottom: 1px solid ${theme.colors.divider};
    margin: ${theme.spacing.md}px 0;
  }
`;

export const materialExtensions = (theme: Theme) => ({
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
          borderColor: theme.colors.divider,
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: theme.borderRadius.lg,
        },
      },
    },
  },
});