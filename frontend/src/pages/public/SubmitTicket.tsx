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
  useTheme,
  alpha,
  Card,
  Stack,
} from '@mui/material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { useNavigate } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { 
  LightbulbOutlined as LightbulbIcon,
  Send as SendIcon,
} from '@mui/icons-material';
import api from '../../utils/axios';
import debounce from 'lodash/debounce';
import PageContainer from '../../components/layout/PageContainer';
import dayjs from 'dayjs';
import { 
  colors, 
  shadows, 
  chipStyles, 
  sectionTitleStyles 
} from '../../styles/common';

interface TicketFormData {
  category: string;
  description: string;
  submitterEmail: string;
  urgency: 'low' | 'normal' | 'high' | 'critical';
  dueDate: string | null;
}

interface Solution {
  id: number;
  title: string;
  description: string;
  category: string;
}

export default function SubmitTicket() {
  const theme = useTheme();
  const navigate = useNavigate();
  const [formData, setFormData] = useState<TicketFormData>({
    category: '',
    description: '',
    submitterEmail: '',
    urgency: 'normal',
    dueDate: null,
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

  const inputStyles = {
    '& .MuiOutlinedInput-root': {
      borderRadius: 2,
      backgroundColor: alpha(theme.palette.background.paper, 0.5),
      backdropFilter: 'blur(8px)',
      transition: 'all 0.2s ease-in-out',
      '&:hover': {
        backgroundColor: alpha(theme.palette.background.paper, 0.7),
        boxShadow: shadows.subtle,
      },
      '&.Mui-focused': {
        backgroundColor: alpha(theme.palette.background.paper, 0.9),
        boxShadow: shadows.medium,
      },
    },
    '& .MuiOutlinedInput-notchedOutline': {
      borderColor: alpha(theme.palette.text.primary, 0.1),
      transition: 'border-color 0.2s ease-in-out',
    },
    '& .Mui-focused .MuiOutlinedInput-notchedOutline': {
      borderColor: colors.primaryBlue,
    },
  };

  return (
    <PageContainer maxWidth="sm">
      <Box
        sx={{
          backgroundColor: alpha(theme.palette.background.paper, 0.8),
          backdropFilter: 'blur(20px)',
          borderRadius: 3,
          boxShadow: shadows.medium,
          border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          p: { xs: 2, sm: 4 },
          mb: 4,
        }}
      >
        <Typography 
          sx={{
            ...sectionTitleStyles,
            fontSize: { xs: '1.75rem', sm: '2rem' },
            textAlign: 'center',
            mb: 1,
          }}
        >
          Submit a Help Desk Ticket
        </Typography>
        <Typography 
          variant="subtitle1" 
          align="center" 
          sx={{ 
            mb: 4,
            color: alpha(theme.palette.text.primary, 0.7),
          }}
        >
          Please fill out the form below to submit your ticket
        </Typography>

        {error && (
          <Alert 
            severity="error" 
            sx={{ 
              mb: 3,
              borderRadius: 2,
              bgcolor: alpha(colors.errorRed, 0.1),
              color: colors.errorRed,
              border: `1px solid ${alpha(colors.errorRed, 0.2)}`,
              '& .MuiAlert-icon': {
                color: colors.errorRed,
              },
            }}
          >
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
              sx={inputStyles}
            >
              <MenuItem value="hardware">Hardware</MenuItem>
              <MenuItem value="software">Software</MenuItem>
              <MenuItem value="network">Network</MenuItem>
              <MenuItem value="access">Access</MenuItem>
              <MenuItem value="other">Other</MenuItem>
            </Select>
          </FormControl>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Urgency</InputLabel>
              <Select
                value={formData.urgency}
                label="Urgency"
                onChange={(e) =>
                  setFormData({ ...formData, urgency: e.target.value as 'low' | 'normal' | 'high' | 'critical' })
                }
                required
                sx={inputStyles}
              >
                <MenuItem value="low">Low</MenuItem>
                <MenuItem value="normal">Normal</MenuItem>
                <MenuItem value="high">High</MenuItem>
                <MenuItem value="critical">Critical</MenuItem>
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <LocalizationProvider dateAdapter={AdapterDayjs}>
                <DateTimePicker
                  label="Due Date"
                  value={formData.dueDate ? dayjs(formData.dueDate) : null}
                  onChange={(date) =>
                    setFormData({ ...formData, dueDate: date ? date.toISOString() : null })
                  }
                  sx={{
                    ...inputStyles,
                    width: '100%',
                  }}
                  slotProps={{
                    textField: {
                      fullWidth: true
                    }
                  }}
                />
              </LocalizationProvider>
            </FormControl>
          </Stack>

          <TextField
            fullWidth
            label="Email"
            type="email"
            value={formData.submitterEmail}
            onChange={(e) =>
              setFormData({ ...formData, submitterEmail: e.target.value })
            }
            required
            sx={{ ...inputStyles, mb: 2 }}
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
            sx={{ ...inputStyles, mb: 3 }}
          />

          <Button
            type="submit"
            variant="contained"
            fullWidth
            disabled={isSubmitting}
            sx={{
              ...chipStyles,
              height: 48,
              backgroundColor: colors.primaryBlue,
              color: 'white',
              fontSize: '1rem',
              fontWeight: 600,
              position: 'relative',
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
              '&:disabled': {
                backgroundColor: alpha(colors.primaryBlue, 0.5),
              },
            }}
            endIcon={isSubmitting ? <CircularProgress size={20} sx={{ color: 'white' }} /> : <SendIcon />}
          >
            {isSubmitting ? 'Submitting...' : 'Submit Ticket'}
          </Button>
        </Box>
      </Box>

      <Collapse in={showSolutions}>
        <Card
          sx={{
            mt: 3,
            borderRadius: 3,
            backgroundColor: alpha(theme.palette.background.paper, 0.8),
            backdropFilter: 'blur(10px)',
            border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            boxShadow: shadows.subtle,
          }}
        >
          <Box sx={{ p: 3 }}>
            <Typography
              variant="h6"
              sx={{
                fontWeight: 600,
                color: colors.primaryBlue,
                mb: 2,
              }}
            >
              Suggested Solutions
            </Typography>
            {isSearching ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                <CircularProgress size={24} sx={{ color: colors.primaryBlue }} />
              </Box>
            ) : solutions.length > 0 ? (
              <List sx={{ '& .MuiListItem-root': { px: 0 } }}>
                {solutions.map((solution) => (
                  <ListItem
                    key={solution.id}
                    sx={{
                      transition: 'all 0.2s ease-in-out',
                      '&:hover': {
                        backgroundColor: alpha(theme.palette.action.hover, 0.1),
                        transform: 'translateX(4px)',
                      },
                    }}
                  >
                    <ListItemIcon>
                      <LightbulbIcon sx={{ color: colors.warningYellow }} />
                    </ListItemIcon>
                    <ListItemText
                      primary={solution.title}
                      secondary={solution.description}
                      primaryTypographyProps={{
                        fontWeight: 500,
                        color: theme.palette.text.primary,
                      }}
                      secondaryTypographyProps={{
                        color: alpha(theme.palette.text.primary, 0.7),
                      }}
                    />
                  </ListItem>
                ))}
              </List>
            ) : (
              <Typography
                sx={{
                  color: alpha(theme.palette.text.primary, 0.7),
                  textAlign: 'center',
                  py: 2,
                }}
              >
                No relevant solutions found. Please submit your ticket and our team will assist you.
              </Typography>
            )}
          </Box>
        </Card>
      </Collapse>
    </PageContainer>
  );
}