import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Typography,
} from '@mui/material';
import { Ticket, User } from '../types';
import { useQuery } from '@tanstack/react-query';
import api from '../utils/axios';

interface TicketDialogProps {
  open: boolean;
  onClose: () => void;
  ticket: Ticket | null;
  onSave: (updatedTicket: Partial<Ticket>) => void;
  isAdmin: boolean;
}

export default function TicketDialog({ open, onClose, ticket, onSave, isAdmin }: TicketDialogProps) {
  const [editedTicket, setEditedTicket] = React.useState<Partial<Ticket>>({});

  // Fetch users for assignment
  const { data } = useQuery<{ data: User[] }>({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await api.get('/users');
      return response.data;
    },
    enabled: isAdmin, // Only fetch users if admin
  });

  const users = data?.data || [];

  React.useEffect(() => {
    if (ticket) {
      setEditedTicket({
        status: ticket.status,
        assignedTo: ticket.assignedTo,
      });
    }
  }, [ticket]);

  const handleChange = (field: keyof Ticket) => (
    event: React.ChangeEvent<{ value: unknown }> | { target: { value: unknown } }
  ) => {
    setEditedTicket((prev) => ({
      ...prev,
      [field]: event.target.value,
    }));
  };

  const handleSave = () => {
    onSave(editedTicket);
    onClose();
  };

  if (!ticket) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        Ticket {ticket.ticketNumber}
      </DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 1 }}>
          <Grid item xs={12}>
            <Typography variant="subtitle2" color="text.secondary">
              Category
            </Typography>
            <Typography variant="body1">
              {ticket.category}
            </Typography>
          </Grid>

          <Grid item xs={12}>
            <Typography variant="subtitle2" color="text.secondary">
              Description
            </Typography>
            <Typography variant="body1" style={{ whiteSpace: 'pre-wrap' }}>
              {ticket.description}
            </Typography>
          </Grid>

          <Grid item xs={12}>
            <Typography variant="subtitle2" color="text.secondary">
              Submitter
            </Typography>
            <Typography variant="body1">
              {ticket.submitterEmail}
            </Typography>
          </Grid>

          {isAdmin && (
            <>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={editedTicket.status || ticket.status}
                    onChange={handleChange('status')}
                    label="Status"
                  >
                    <MenuItem value="open">Open</MenuItem>
                    <MenuItem value="in_progress">In Progress</MenuItem>
                    <MenuItem value="resolved">Resolved</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Assigned To</InputLabel>
                  <Select
                    value={editedTicket.assignedTo || ticket.assignedTo || ''}
                    onChange={handleChange('assignedTo')}
                    label="Assigned To"
                  >
                    <MenuItem value="">Unassigned</MenuItem>
                    {users.map((user) => (
                      <MenuItem key={user.id} value={user.id}>
                        {user.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </>
          )}
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        {isAdmin && <Button onClick={handleSave} color="primary">Save Changes</Button>}
      </DialogActions>
    </Dialog>
  );
}