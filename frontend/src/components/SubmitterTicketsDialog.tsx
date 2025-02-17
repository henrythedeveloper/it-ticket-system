import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Paper,
  Typography,
  CircularProgress,
  Box,
} from '@mui/material';
import { useTheme } from '../contexts/ThemeContext';
import { Ticket } from '../types';
import { getCommonDialogStyles } from '../contexts/ThemeContext';
import axios from '../utils/axios';

interface Props {
  open: boolean;
  onClose: () => void;
  email: string;
}

const SubmitterTicketsDialog: React.FC<Props> = ({ open, onClose, email }) => {
  const { theme } = useTheme();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open && email) {
      fetchTickets();
    }
  }, [open, email]);

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/tickets?submitterEmail=${email}`);
      setTickets(response.data.data || []);
    } catch (error) {
      console.error('Error fetching tickets:', error);
    } finally {
      setLoading(false);
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

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      sx={getCommonDialogStyles(theme)}
    >
      <DialogTitle>
        <Typography
          variant="h6"
          sx={{ fontSize: theme.typography.medium }}
        >
          Tickets submitted by {email}
        </Typography>
      </DialogTitle>
      <DialogContent>
        {loading ? (
          <Box display="flex" justifyContent="center" p={3}>
            <CircularProgress />
          </Box>
        ) : (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Ticket #</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Urgency</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell>Last Updated</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {tickets.map((ticket) => (
                  <TableRow key={ticket.id}>
                    <TableCell>{ticket.ticketNumber}</TableCell>
                    <TableCell>
                      {ticket.status.toUpperCase().replace('_', ' ')}
                    </TableCell>
                    <TableCell>
                      <Typography
                        style={{ color: getUrgencyColor(ticket.urgency) }}
                      >
                        {ticket.urgency.toUpperCase()}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {new Date(ticket.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {new Date(ticket.updatedAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SubmitterTicketsDialog;