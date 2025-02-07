import React, { useState, useCallback } from 'react';
import {
  Typography,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Box,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Collapse,
  CircularProgress,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { LightbulbOutlined as LightbulbIcon } from '@mui/icons-material';
import api from '../../utils/axios';
import debounce from 'lodash/debounce';
import PageContainer from '../../components/layout/PageContainer';

interface TicketFormData {
  category: string;
  description: string;
  submitterEmail: string;
}

interface Solution {
  id: number;
  title: string;
  description: string;
  category: string;
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
  const [solutions, setSolutions] = useState<Solution[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSolutions, setShowSolutions] = useState(false);

  const searchSolutions = useCallback(
    debounce(async (description: string, category: string) => {
      if (!description || !category) return;
      
      try {
        setIsSearching(true);
        const response = await api.post('/solutions/search', {
          description,
          category,
        });
        setSolutions(response.data.data);
        setShowSolutions(true);
      } catch (err) {
        console.error('Failed to fetch solutions:', err);
      } finally {
        setIsSearching(false);
      }
    }, 500),
    []
  );

  React.useEffect(() => {
    if (formData.description && formData.category) {
      searchSolutions(formData.description, formData.category);
    } else {
      setSolutions([]);
      setShowSolutions(false);
    }
  }, [formData.description, formData.category, searchSolutions]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await api.post('/tickets', formData);
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
    <PageContainer maxWidth="sm">
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

      <Box component="form" onSubmit={handleSubmit}>
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
      </Box>

      <Collapse in={showSolutions}>
        <Box sx={{ mt: 3 }}>
          <Typography variant="h6" gutterBottom>
            Suggested Solutions
          </Typography>
          {isSearching ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
              <CircularProgress size={24} />
            </Box>
          ) : solutions.length > 0 ? (
            <List>
              {solutions.map((solution) => (
                <ListItem key={solution.id}>
                  <ListItemIcon>
                    <LightbulbIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary={solution.title}
                    secondary={solution.description}
                  />
                </ListItem>
              ))}
            </List>
          ) : (
            <Typography color="textSecondary">
              No relevant solutions found. Please submit your ticket and our team will assist you.
            </Typography>
          )}
        </Box>
      </Collapse>
    </PageContainer>
  );
}