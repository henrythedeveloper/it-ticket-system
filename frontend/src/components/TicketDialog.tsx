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
  TextField,
  Box,
  Paper,
  List,
  ListItem,
  ListItemText,
  Divider,
  Autocomplete,
} from '@mui/material';
import { Ticket, User, TicketHistory, TicketSolution } from '../types';
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
  const [solution, setSolution] = React.useState('');
  const [selectedSolution, setSelectedSolution] = React.useState<TicketSolution | null>(null);

  // Fetch users for assignment
  const { data } = useQuery<{ data: User[] }>({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await api.get('/users');
      return response.data;
    },
    enabled: isAdmin,
  });

  // Fetch ticket history
  const { data: historyData } = useQuery<{ data: TicketHistory[] }>({
    queryKey: ['ticket-history', ticket?.id],
    queryFn: async () => {
      const response = await api.get(`/tickets/${ticket?.id}/history`);
      return response.data;
    },
    enabled: !!ticket?.id,
  });

  // Fetch existing solutions
  const { data: solutionsData } = useQuery<{ data: TicketSolution[] }>({
    queryKey: ['ticket-solutions', ticket?.category],
    queryFn: async () => {
      const response = await api.get(`/solutions?category=${ticket?.category}`);
      return response.data;
    },
    enabled: !!ticket?.category,
  });

  const users = data?.data || [];
  const history = historyData?.data || [];
  const solutions = solutionsData?.data || [];

  React.useEffect(() => {
    if (ticket) {
      setEditedTicket({
        status: ticket.status,
        assignedTo: ticket.assignedTo,
        solution: ticket.solution,
      });
      setSolution(ticket.solution || '');
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
    const updates = {
      ...editedTicket,
      solution: editedTicket.status === 'resolved' ? solution : undefined,
    };
    onSave(updates);
    onClose();
  };

  const handleSolutionSelect = (solution: TicketSolution | null) => {
    setSelectedSolution(solution);
    if (solution) {
      setSolution(solution.description);
    }
  };

  if (!ticket) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        Ticket {ticket.ticketNumber}
      </DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 1 }}>
          <Grid item xs={12} md={8}>
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" color="text.secondary">
                Category
              </Typography>
              <Typography variant="body1">
                {ticket.category}
              </Typography>
            </Box>

            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" color="text.secondary">
                Description
              </Typography>
              <Paper 
                elevation={0}
                sx={{ 
                  p: 2,
                  backgroundColor: 'grey.50',
                  maxHeight: '200px',
                  overflowY: 'auto'
                }}
              >
                <Typography 
                  variant="body1" 
                  sx={{ 
                    whiteSpace: 'pre-wrap',
                    textAlign: 'justify',
                  }}
                >
                  {ticket.description}
                </Typography>
              </Paper>
            </Box>

            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" color="text.secondary">
                Submitter
              </Typography>
              <Typography variant="body1">
                {ticket.submitterEmail}
              </Typography>
            </Box>

            {isAdmin && (
              <>
                <Grid container spacing={2}>
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
                        {users
                          .sort((a, b) => a.name.localeCompare(b.name))
                          .map((user) => (
                            <MenuItem key={user.id} value={user.id}>
                              {user.name}
                            </MenuItem>
                          ))}
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>

                {editedTicket.status === 'resolved' && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="subtitle1" gutterBottom>
                      Resolution
                    </Typography>
                    <Autocomplete
                      options={solutions}
                      getOptionLabel={(option) => option.title}
                      value={selectedSolution}
                      onChange={(_, newValue) => handleSolutionSelect(newValue)}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Search existing solutions"
                          variant="outlined"
                          size="small"
                          fullWidth
                        />
                      )}
                    />
                    <TextField
                      label="Solution Details"
                      multiline
                      rows={4}
                      value={solution}
                      onChange={(e) => setSolution(e.target.value)}
                      fullWidth
                      required
                      sx={{ mt: 2 }}
                      placeholder="Describe how the issue was resolved..."
                    />
                  </Box>
                )}
              </>
            )}
          </Grid>

          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 2, mb: 2 }}>
              <Typography variant="h6" gutterBottom>
                Ticket History
              </Typography>
              <List>
                {history.map((entry, index) => (
                  <React.Fragment key={entry.id}>
                    <ListItem>
                      <ListItemText
                        primary={entry.action}
                        secondary={
                          <>
                            <Typography variant="caption" color="text.secondary">
                              {new Date(entry.createdAt).toLocaleString()}
                            </Typography>
                            {entry.notes && (
                              <Typography variant="body2">
                                {entry.notes}
                              </Typography>
                            )}
                          </>
                        }
                      />
                    </ListItem>
                    {index < history.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            </Paper>
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        {isAdmin && (
          <Button 
            onClick={handleSave} 
            color="primary"
            disabled={editedTicket.status === 'resolved' && !solution}
          >
            Save Changes
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}