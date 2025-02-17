import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  Typography,
  Box,
  CircularProgress,
  Chip,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useTheme } from '../contexts/ThemeContext';
import { Ticket, User, TicketHistory } from '../types';
import { getCommonDialogStyles } from '../contexts/ThemeContext';
import axios from '../utils/axios';

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (ticket: Partial<Ticket>) => void;
  ticket: Ticket | null;
  currentUser: User;
}

interface TicketFormData {
  status?: Ticket['status'];
  urgency?: Ticket['urgency'];
  assignedTo?: number | null;
  solution?: string | null;
}

const initialFormData: TicketFormData = {
  status: 'open',
  urgency: 'normal',
  assignedTo: null,
  solution: null,
};

const TicketDialog: React.FC<Props> = ({
  open,
  onClose,
  onSave,
  ticket,
  currentUser,
}) => {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<TicketHistory[]>([]);
  const [formData, setFormData] = useState<TicketFormData>(initialFormData);

  useEffect(() => {
    if (ticket) {
      setFormData({
        status: ticket.status,
        urgency: ticket.urgency,
        assignedTo: ticket.assignedTo ?? null,
        solution: ticket.solution ?? null,
      });
      fetchHistory(ticket.id);
    } else {
      setFormData(initialFormData);
      setHistory([]);
    }
  }, [ticket]);

  const fetchHistory = async (ticketId: number) => {
    try {
      const response = await axios.get(`/api/tickets/${ticketId}/history`);
      setHistory(response.data.data || []);
    } catch (error) {
      console.error('Error fetching ticket history:', error);
    }
  };

  const handleSave = async () => {
    if (!ticket) return;

    setLoading(true);
    try {
      onSave(formData);
    } catch (error) {
      console.error('Error updating ticket:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof TicketFormData) => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setFormData({
      ...formData,
      [field]: event.target.value,
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'resolved':
        return theme.colors.successGreen;
      case 'in_progress':
        return theme.colors.warningYellow;
      case 'open':
        return theme.colors.errorRed;
      default:
        return theme.colors.secondaryGray;
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'critical':
        return theme.colors.errorRed;
      case 'high':
        return theme.colors.warningYellow;
      case 'low':
        return theme.colors.successGreen;
      default:
        return theme.colors.secondaryGray;
    }
  };

  if (!ticket) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="md"
      sx={getCommonDialogStyles(theme)}
    >
      <DialogTitle>
        <Typography variant="h6">
          Ticket #{ticket.ticketNumber}
          <Chip
            label={ticket.status.toUpperCase().replace('_', ' ')}
            size="small"
            sx={{
              ml: 2,
              backgroundColor: getStatusColor(ticket.status),
              color: '#fff',
            }}
          />
          <Chip
            label={ticket.urgency.toUpperCase()}
            size="small"
            sx={{
              ml: 1,
              backgroundColor: getUrgencyColor(ticket.urgency),
              color: '#fff',
            }}
          />
        </Typography>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle1" gutterBottom>
            Submitted by: {ticket.submitterEmail}
          </Typography>
          <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
            {ticket.description}
          </Typography>
        </Box>

        <TextField
          select
          fullWidth
          label="Status"
          value={formData.status || ''}
          onChange={handleChange('status')}
          margin="normal"
          disabled={!currentUser}
        >
          <MenuItem value="open">Open</MenuItem>
          <MenuItem value="in_progress">In Progress</MenuItem>
          <MenuItem value="resolved">Resolved</MenuItem>
        </TextField>

        <TextField
          select
          fullWidth
          label="Urgency"
          value={formData.urgency || ''}
          onChange={handleChange('urgency')}
          margin="normal"
          disabled={!currentUser}
        >
          <MenuItem value="low">Low</MenuItem>
          <MenuItem value="normal">Normal</MenuItem>
          <MenuItem value="high">High</MenuItem>
          <MenuItem value="critical">Critical</MenuItem>
        </TextField>

        <TextField
          fullWidth
          multiline
          rows={4}
          label="Solution"
          value={formData.solution || ''}
          onChange={handleChange('solution')}
          margin="normal"
          disabled={!currentUser}
        />

        {history.length > 0 && (
          <Box sx={{ mt: 3 }}>
            <Typography variant="h6" gutterBottom>
              History
            </Typography>
            {history.map((entry) => (
              <Box
                key={entry.id}
                sx={{
                  mb: 1,
                  p: 1,
                  borderLeft: `4px solid ${theme.colors.primaryBlue}`,
                  backgroundColor: alpha(theme.colors.primaryBlue, 0.1),
                }}
              >
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  {entry.notes}
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  {entry.action.replace('_', ' ').toUpperCase()} by{' '}
                  {entry.user ? entry.user.name : 'System'} on{' '}
                  {new Date(entry.createdAt).toLocaleString()}
                </Typography>
              </Box>
            ))}
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        {currentUser && (
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={loading}
            sx={{ opacity: loading ? 0.7 : undefined }}
          >
            {loading ? <CircularProgress size={24} /> : 'Save Changes'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default TicketDialog;