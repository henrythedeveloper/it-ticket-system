import React from 'react';
import { Container, Box, Paper, useTheme } from '@mui/material';
import type { SxProps, Theme } from '@mui/material';
import { shadows } from '../../styles/common';

interface PageContainerProps {
  children: React.ReactNode;
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | false;
  disablePaper?: boolean;
  centerContent?: boolean;
  paperProps?: {
    elevation?: number;
    sx?: SxProps<Theme>;
  };
}

export default function PageContainer({ 
  children, 
  maxWidth = false, 
  disablePaper = false,
  centerContent = true,
  paperProps = {}
}: PageContainerProps) {
  const theme = useTheme();

  return (
    <Container 
      component="main" 
      maxWidth={maxWidth}
      sx={{
        position: 'relative',
        zIndex: 1,
      }}
    >
      <Box
        sx={{
          minHeight: centerContent ? '100vh' : 'auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: centerContent ? 'center' : 'stretch',
          justifyContent: centerContent ? 'center' : 'flex-start',
          width: '100%',
          py: { xs: 2, sm: 3, md: 4 },
          px: { xs: 1, sm: 2 },
          gap: { xs: 2, sm: 3 },
        }}
      >
        {disablePaper ? children : (
          <Paper
            elevation={0}
            {...paperProps}
            sx={{
              p: { xs: 2, sm: 3, md: 4 },
              width: '100%',
              maxHeight: centerContent ? {
                xs: 'calc(100vh - 32px)',
                sm: 'calc(100vh - 48px)',
                md: 'calc(100vh - 64px)'
              } : 'none',
              overflow: 'auto',
              borderRadius: 2,
              backgroundColor: theme.palette.background.paper,
              boxShadow: shadows.subtle,
              transition: 'all 0.2s ease-in-out',
              '&:hover': {
                boxShadow: shadows.medium,
                transform: 'translateY(-2px)',
              },
              '& > *': {
                mb: { xs: 2, sm: 3 },
                '&:last-child': {
                  mb: 0
                }
              },
              // Glass effect for light mode
              ...(theme.palette.mode === 'light' && {
                backdropFilter: 'blur(8px)',
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
              }),
              // Merge with any additional styles from paperProps
              ...paperProps.sx
            }}
          >
            {children}
          </Paper>
        )}
      </Box>
    </Container>
  );
}