import {
  Box,
  Typography,
  Paper,
  Button,
} from '@mui/material';
import { CheckCircleOutline as SuccessIcon } from '@mui/icons-material';
import { useLocation, useNavigate } from 'react-router-dom';

export default function TicketSuccess() {
  const location = useLocation();
  const navigate = useNavigate();
  const email = location.state?.email;

  return (
    <Box sx={{ textAlign: 'center' }}>
      <Paper 
        sx={{ 
          p: 4, 
          maxWidth: 600, 
          mx: 'auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 3
        }}
      >
        <SuccessIcon 
          color="success" 
          sx={{ 
            fontSize: 64,
            mb: 2
          }} 
        />

        <Typography variant="h4" gutterBottom>
          Ticket Submitted Successfully
        </Typography>

        <Typography variant="body1" color="text.secondary" paragraph>
          Thank you for submitting your ticket. We'll be reviewing it shortly.
        </Typography>

        {email && (
          <Typography variant="body2" color="text.secondary">
            We'll send updates to: {email}
          </Typography>
        )}

        <Box sx={{ mt: 4 }}>
          <Button
            variant="contained"
            onClick={() => navigate('/submit-ticket')}
            sx={{ mr: 2 }}
          >
            Submit Another Ticket
          </Button>
          <Button
            variant="outlined"
            onClick={() => navigate('/')}
          >
            Return Home
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}