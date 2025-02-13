import { alpha, Theme } from '@mui/material';

export const colors = {
  primaryBlue: '#007AFF',
  secondaryGray: '#8E8E93',
  successGreen: '#34C759',
  warningYellow: '#FFCC00',
  errorRed: '#FF3B30',
};

export const shadows = {
  subtle: '0 2px 4px rgba(0, 0, 0, 0.05)',
  medium: '0 4px 8px rgba(0, 0, 0, 0.1)',
  large: '0 8px 16px rgba(0, 0, 0, 0.15)',
};

export const chipStyles = {
  borderRadius: 2,
  textTransform: 'none',
  letterSpacing: 0,
  fontWeight: 500,
  fontSize: '0.875rem',
};

export const sectionTitleStyles = {
  fontSize: '1.5rem',
  fontWeight: 600,
  color: 'inherit',
  letterSpacing: -0.5,
};

export const headerContainerStyles = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  mb: 2,
};

export const cardStyles = {
  p: 3,
  height: '100%',
  borderRadius: 3,
  border: (theme: Theme) => `1px solid ${alpha(theme.palette.divider, 0.1)}`,
  backdropFilter: 'blur(8px)',
};

export const listItemStyles = {
  cursor: 'pointer',
  borderRadius: 2,
  transition: 'all 0.2s ease-in-out',
  '&:hover': {
    backgroundColor: (theme: Theme) => alpha(theme.palette.action.hover, 0.7),
    transform: 'translateX(6px)',
  },
};

export const truncatedTextStyles = {
  display: '-webkit-box',
  WebkitBoxOrient: 'vertical' as const,
  WebkitLineClamp: 2,
  overflow: 'hidden',
};

export const ticketNumberStyles = {
  fontFamily: 'monospace',
  fontWeight: 600,
  color: colors.primaryBlue,
  fontSize: '0.875rem',
};

export const urgentContainerStyles = {
  p: 3,
  borderRadius: 3,
  backgroundColor: (theme: Theme) => alpha(colors.errorRed, 0.05),
  border: `1px solid ${alpha(colors.errorRed, 0.1)}`,
};

export const chipContainerStyles = {
  display: 'flex',
  alignItems: 'center',
  gap: 1,
};

export const glassPanelStyles = {
  backgroundColor: (theme: Theme) => alpha(theme.palette.background.paper, 0.7),
  backdropFilter: 'blur(10px)',
  borderRadius: 3,
  border: (theme: Theme) => `1px solid ${alpha(theme.palette.divider, 0.1)}`,
  boxShadow: shadows.medium,
  p: 3,
};