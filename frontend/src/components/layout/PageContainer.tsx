import React from 'react';
import { Container, Box, Paper } from '@mui/material';

interface PageContainerProps {
  children: React.ReactNode;
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | false;
  disablePaper?: boolean;
}

export default function PageContainer({ 
  children, 
  maxWidth = false, 
  disablePaper = false 
}: PageContainerProps) {
  return (
    <Container component="main" maxWidth={maxWidth}>
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          py: { xs: 2, sm: 3, md: 4 },  // Responsive padding
          px: { xs: 1, sm: 2 },  // Add horizontal padding for mobile
          gap: { xs: 2, sm: 3 },  // Add gap between elements
        }}
      >
        {disablePaper ? children : (
          <Paper
            sx={{
              p: { xs: 2, sm: 3, md: 4 },  // Responsive padding
              width: '100%',
              maxHeight: {
                xs: 'calc(100vh - 32px)',  // Less padding on mobile
                sm: 'calc(100vh - 48px)',
                md: 'calc(100vh - 64px)'
              },
              overflow: 'auto',
              '& > *': {  // Add spacing between direct children
                mb: { xs: 2, sm: 3 },
                '&:last-child': {
                  mb: 0
                }
              }
            }}
            elevation={1}  // Lighter shadow for better visual hierarchy
          >
            {children}
          </Paper>
        )}
      </Box>
    </Container>
  );
}