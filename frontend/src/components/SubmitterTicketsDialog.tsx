import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Paper,
  Typography,
  Chip,
  Box,
  DialogActions,
  Button,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { Ticket } from '../types';
import api from '../utils/axios';

interface SubmitterTicketsDialogProps {
  open: boolean;
  onClose: () => void;
  email: string;
  onTicketClick: (ticket: Ticket) => void;
}

export default function SubmitterTicketsDialog({
  open,
  onClose,
  email,
  onTicketClick,
}: SubmitterTicketsDialogProps) {
  const { data: tickets } = useQuery<{ data: Ticket[] }>({
    queryKey: ['tickets', 'submitter', email],
    queryFn: async () => {
      const response = await api.get('/tickets', {
        params: { submitterEmail: email }
      });
      return response.data;
    },
    enabled: open
  });

  const formatDueDate = (dueDate: string | null | undefined) => {
    if (!dueDate) return '-';
    const date = new Date(dueDate);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status: string): 'error' | 'warning' | 'success' | 'default' => {
    switch (status) {
      case 'open':
        return 'error';
      case 'in_progress':
        return 'warning';
      case 'resolved':
        return 'success';
      default:
        return 'default';
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Typography variant="h6">
            Tickets from {email}
          </Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent>
        <TableContainer component={Paper} sx={{ mt: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Ticket #</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Description</TableCell>
                <TableCell>Due Date</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {tickets?.data.map((ticket) => (
                <TableRow
                  key={ticket.id}
                  onClick={() => onTicketClick(ticket)}
                  sx={{
                    cursor: 'pointer',
                    '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.04)' }
                  }}
                >
                  <TableCell>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                      {ticket.ticketNumber}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={ticket.status}
                      color={getStatusColor(ticket.status)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    {ticket.description.length > 50
                      ? `${ticket.description.slice(0, 50)}...`
                      : ticket.description}
                  </TableCell>
                  <TableCell>{formatDueDate(ticket.dueDate)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}