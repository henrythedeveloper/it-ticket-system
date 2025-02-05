import { useLocation, useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Paper,
  Button,
} from '@mui/material';
import { CheckCircle as CheckCircleIcon } from '@mui/icons-material';
import { green } from '@mui/material/colors';

interface LocationState {
  email?: string;
}

export default function TicketSuccess() {
  const location = useLocation();
  const navigate = useNavigate();
  const { email } = (location.state as LocationState) || {};

  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          mt: 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <Paper
          elevation={3}
          sx={{
            p: 4,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: '100%',
          }}
        >
          <CheckCircleIcon
            sx={{ fontSize: 64, color: green[500], mb: 2 }}
          />
          
          <Typography variant="h4" component="h1" gutterBottom align="center">
            Ticket Submitted Successfully!
          </Typography>

          <Typography variant="body1" align="center" sx={{ mb: 2 }}>
            Thank you for submitting your help desk ticket. Our team will review it shortly.
          </Typography>

          {email && (
            <Typography variant="body1" align="center" sx={{ mb: 2 }}>
              A confirmation has been sent to: <strong>{email}</strong>
            </Typography>
          )}

          <Typography variant="body2" color="textSecondary" align="center" sx={{ mb: 4 }}>
            We will notify you of any updates regarding your ticket via email.
          </Typography>

          <Box sx={{ mt: 2, width: '100%' }}>
            <Button
              fullWidth
              variant="contained"
              onClick={() => navigate('/')}
              sx={{ mb: 2 }}
            >
              Submit Another Ticket
            </Button>

            <Button
              fullWidth
              variant="text"
              onClick={() => navigate('/login')}
            >
              IT Staff Login
            </Button>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
}