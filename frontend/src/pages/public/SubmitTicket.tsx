import React, { useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Paper,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { isAxiosError } from 'axios';
import api from '../../utils/axios';

interface TicketFormData {
  category: string;
  description: string;
  submitterEmail: string;
}

export default function SubmitTicket() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<TicketFormData>({
    category: '',
    description: '',
    submitterEmail: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await api.post('/tickets', formData);
      // Redirect to success page regardless of auth status
      navigate('/ticket-success', { state: { email: formData.submitterEmail } });
    } catch (err) {
      if (isAxiosError(err)) {
        setError(err.response?.data?.error || 'Failed to submit ticket');
      } else {
        setError('An unexpected error occurred');
      }
      setIsSubmitting(false);
    }
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom align="center">
        Submit a Help Desk Ticket
      </Typography>
      <Typography variant="body1" gutterBottom align="center" sx={{ mb: 4 }}>
        Please fill out the form below to submit your ticket
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Paper sx={{ p: 3, maxWidth: 600, mx: 'auto' }}>
        <form onSubmit={handleSubmit}>
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Category</InputLabel>
            <Select
              value={formData.category}
              label="Category"
              onChange={(e) =>
                setFormData({ ...formData, category: e.target.value as string })
              }
              required
            >
              <MenuItem value="hardware">Hardware</MenuItem>
              <MenuItem value="software">Software</MenuItem>
              <MenuItem value="network">Network</MenuItem>
              <MenuItem value="access">Access</MenuItem>
              <MenuItem value="other">Other</MenuItem>
            </Select>
          </FormControl>

          <TextField
            fullWidth
            label="Email"
            type="email"
            value={formData.submitterEmail}
            onChange={(e) =>
              setFormData({ ...formData, submitterEmail: e.target.value })
            }
            required
            sx={{ mb: 2 }}
          />

          <TextField
            fullWidth
            label="Description"
            multiline
            rows={4}
            value={formData.description}
            onChange={(e) =>
              setFormData({ ...formData, description: e.target.value })
            }
            required
            sx={{ mb: 3 }}
          />

          <Button
            type="submit"
            variant="contained"
            color="primary"
            fullWidth
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Submitting...' : 'Submit Ticket'}
          </Button>
        </form>
      </Paper>
    </Box>
  );
}