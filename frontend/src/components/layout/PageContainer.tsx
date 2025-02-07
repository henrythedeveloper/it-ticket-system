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
          py: 3,
        }}
      >
        {disablePaper ? children : (
          <Paper 
            sx={{ 
              p: 3, 
              width: '100%',
              maxHeight: 'calc(100vh - 48px)', // Accounting for padding
              overflow: 'auto'
            }}
          >
            {children}
          </Paper>
        )}
      </Box>
    </Container>
  );
}