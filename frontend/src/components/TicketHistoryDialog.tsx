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
  Box,
  DialogActions,
  Button,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import api from '../utils/axios';

interface TicketHistory {
  id: number;
  action: string;
  notes: string;
  created_at: string;
  user: {
    name: string;
    email: string;
  };
}

interface TicketHistoryDialogProps {
  open: boolean;
  onClose: () => void;
  ticketId: number;
}

export default function TicketHistoryDialog({
  open,
  onClose,
  ticketId,
}: TicketHistoryDialogProps) {
  const { data: history } = useQuery<{ data: TicketHistory[] }>({
    queryKey: ['ticket-history', ticketId],
    queryFn: async () => {
      const response = await api.get(`/tickets/${ticketId}/history`);
      return response.data;
    },
    enabled: open && ticketId > 0
  });

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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
            Ticket History
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
                <TableCell>Date</TableCell>
                <TableCell>Action</TableCell>
                <TableCell>User</TableCell>
                <TableCell>Notes</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {history?.data.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>{formatDate(entry.created_at)}</TableCell>
                  <TableCell>
                    <Typography
                      variant="body2"
                      sx={{
                        textTransform: 'capitalize',
                        fontWeight: 'medium'
                      }}
                    >
                      {entry.action.replace(/_/g, ' ')}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {entry.user.name}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      {entry.user.email}
                    </Typography>
                  </TableCell>
                  <TableCell>{entry.notes}</TableCell>
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