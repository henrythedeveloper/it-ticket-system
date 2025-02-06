import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import {
  Box,
  Button,
  Container,
  TextField,
  Typography,
  Paper,
  Alert,
  MenuItem,
} from '@mui/material';
import api from '../../utils/axios';

interface TicketSubmission {
  category: string;
  description: string;
  submitterEmail: string;
}

const categories = [
  { value: 'network', label: 'Network Issue' },
  { value: 'hardware', label: 'Hardware Problem' },
  { value: 'software', label: 'Software Issue' },
  { value: 'access', label: 'Access/Permissions' },
  { value: 'other', label: 'Other' },
];

export default function SubmitTicket() {
  const navigate = useNavigate();
  const [error, setError] = React.useState('');
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<TicketSubmission>();

  const onSubmit = async (data: TicketSubmission) => {
    try {
      await api.post('/tickets', data);
      navigate('/success', { 
        state: { email: data.submitterEmail }
      });
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('Failed to submit ticket. Please try again.');
      }
    }
  };

  return (
    <Container component="main" maxWidth="md">
      <Box
        sx={{
          marginTop: 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <Paper sx={{ p: 4, width: '100%' }}>
          <Typography component="h1" variant="h4" align="center" gutterBottom>
            Submit a Help Desk Ticket
          </Typography>

          <Typography variant="body1" align="center" color="textSecondary" sx={{ mb: 4 }}>
            Please provide details about your issue and we'll get back to you as soon as possible.
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
            <TextField
              select
              margin="normal"
              required
              fullWidth
              id="category"
              label="Issue Category"
              {...register('category', {
                required: 'Please select a category',
              })}
              error={!!errors.category}
              helperText={errors.category?.message}
              defaultValue=""
            >
              {categories.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              margin="normal"
              required
              fullWidth
              id="description"
              label="Description"
              multiline
              rows={4}
              {...register('description', {
                required: 'Please describe your issue',
                minLength: {
                  value: 20,
                  message: 'Please provide more detail (at least 20 characters)',
                },
              })}
              error={!!errors.description}
              helperText={errors.description?.message}
            />

            <TextField
              margin="normal"
              required
              fullWidth
              id="email"
              label="Your Email Address"
              type="email"
              autoComplete="email"
              {...register('submitterEmail', {
                required: 'Email is required',
                pattern: {
                  value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                  message: 'Invalid email address',
                },
              })}
              error={!!errors.submitterEmail}
              helperText={errors.submitterEmail?.message}
            />

            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={isSubmitting}
              sx={{ mt: 3, mb: 2 }}
            >
              Submit Ticket
            </Button>


          </Box>
        </Paper>
      </Box>
    </Container>
  );
}