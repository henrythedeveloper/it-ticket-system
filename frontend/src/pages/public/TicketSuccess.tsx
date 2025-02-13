import {
  Box,
  Typography,
  Button,
  Container,
  useTheme,
  alpha,
  keyframes,
} from '@mui/material';
import { 
  CheckCircleOutline as SuccessIcon,
  Add as AddIcon,
  Home as HomeIcon,
} from '@mui/icons-material';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  colors, 
  shadows, 
  chipStyles, 
} from '../../styles/common';

const successAnimation = keyframes`
  0% {
    transform: scale(0.5);
    opacity: 0;
  }
  50% {
    transform: scale(1.2);
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
`;

const fadeIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

export default function TicketSuccess() {
  const theme = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const email = location.state?.email;

  return (
    <Container component="main">
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          p: { xs: 2, sm: 4 },
        }}
      >
        <Box
          sx={{
            p: { xs: 3, sm: 4 },
            maxWidth: 600,
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 3,
            backgroundColor: alpha(theme.palette.background.paper, 0.8),
            backdropFilter: 'blur(20px)',
            borderRadius: 4,
            boxShadow: shadows.medium,
            border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            position: 'relative',
            overflow: 'hidden',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 4,
              background: `linear-gradient(90deg, ${colors.successGreen}, ${alpha(colors.successGreen, 0.5)})`,
            },
          }}
        >
          <SuccessIcon 
            sx={{ 
              fontSize: { xs: 64, sm: 80 },
              color: colors.successGreen,
              mb: 2,
              animation: `${successAnimation} 0.6s ease-out forwards`,
            }} 
          />

          <Typography 
            variant="h4" 
            sx={{ 
              fontWeight: 600,
              textAlign: 'center',
              color: theme.palette.text.primary,
              animation: `${fadeIn} 0.6s ease-out forwards`,
              animationDelay: '0.3s',
              opacity: 0,
            }}
          >
            Ticket Submitted Successfully
          </Typography>

          <Typography 
            variant="body1" 
            sx={{ 
              color: alpha(theme.palette.text.primary, 0.7),
              textAlign: 'center',
              maxWidth: 440,
              animation: `${fadeIn} 0.6s ease-out forwards`,
              animationDelay: '0.4s',
              opacity: 0,
            }}
          >
            Thank you for submitting your ticket. Our team will review it and respond shortly.
          </Typography>

          {email && (
            <Box
              sx={{
                p: 2,
                borderRadius: 2,
                backgroundColor: alpha(colors.primaryBlue, 0.1),
                border: `1px solid ${alpha(colors.primaryBlue, 0.2)}`,
                width: '100%',
                textAlign: 'center',
                animation: `${fadeIn} 0.6s ease-out forwards`,
                animationDelay: '0.5s',
                opacity: 0,
              }}
            >
              <Typography 
                variant="body2" 
                sx={{ 
                  color: alpha(theme.palette.text.primary, 0.9),
                  fontWeight: 500,
                }}
              >
                We'll send updates to:{' '}
                <Box 
                  component="span" 
                  sx={{ 
                    color: colors.primaryBlue,
                    fontWeight: 600,
                  }}
                >
                  {email}
                </Box>
              </Typography>
            </Box>
          )}

          <Box 
            sx={{ 
              mt: 4,
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              gap: 2,
              width: '100%',
              animation: `${fadeIn} 0.6s ease-out forwards`,
              animationDelay: '0.6s',
              opacity: 0,
            }}
          >
            <Button
              fullWidth
              variant="contained"
              onClick={() => navigate('/submit-ticket')}
              startIcon={<AddIcon />}
              sx={{
                ...chipStyles,
                height: 48,
                backgroundColor: colors.primaryBlue,
                color: 'white',
                fontSize: '1rem',
                fontWeight: 600,
                transition: 'all 0.2s ease-in-out',
                transform: 'translateY(0)',
                '&:hover': {
                  backgroundColor: alpha(colors.primaryBlue, 0.9),
                  transform: 'translateY(-1px)',
                  boxShadow: shadows.medium,
                },
                '&:active': {
                  transform: 'translateY(0)',
                  boxShadow: 'none',
                },
              }}
            >
              Submit Another Ticket
            </Button>
            <Button
              fullWidth
              onClick={() => navigate('/')}
              startIcon={<HomeIcon />}
              sx={{
                ...chipStyles,
                height: 48,
                color: theme.palette.text.primary,
                backgroundColor: alpha(theme.palette.text.primary, 0.1),
                transition: 'all 0.2s ease-in-out',
                transform: 'translateY(0)',
                '&:hover': {
                  backgroundColor: alpha(theme.palette.text.primary, 0.15),
                  transform: 'translateY(-1px)',
                  boxShadow: shadows.subtle,
                },
                '&:active': {
                  transform: 'translateY(0)',
                  boxShadow: 'none',
                },
              }}
            >
              Return Home
            </Button>
          </Box>
        </Box>
      </Box>
    </Container>
  );
}