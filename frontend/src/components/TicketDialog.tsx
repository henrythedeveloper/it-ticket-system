import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  List,
  ListItem,
  ListItemText,
  Tabs,
  Tab,
  SelectChangeEvent,
} from '@mui/material';
import { Ticket, User, TicketHistory, Nullable } from '../types';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import api from '../utils/axios';
import CommonSolutions from './CommonSolutions';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`ticket-tabpanel-${index}`}
      aria-labelledby={`ticket-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

interface TicketDialogProps {
  open: boolean;
  onClose: () => void;
  ticket: Ticket | null;
  onSave: (ticket: Partial<Ticket>) => void;
  isAdmin: boolean;
}

export default function TicketDialog({
  open,
  onClose,
  ticket,
  onSave,
  isAdmin,
}: TicketDialogProps) {
  const { user } = useAuth();
  const [status, setStatus] = useState<'open' | 'in_progress' | 'resolved'>('open');
  const [assignedTo, setAssignedTo] = useState<Nullable<number>>(null);
  const [solution, setSolution] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [currentTab, setCurrentTab] = useState(0);

  const { data: users } = useQuery<{ data: User[] }>({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await api.get('/users');
      return response.data;
    },
  });

  const { data: historyData } = useQuery<{ data: TicketHistory[] }>({
    queryKey: ['ticket-history', ticket?.id],
    queryFn: async () => {
      if (!ticket?.id) return { data: [] };
      const response = await api.get(`/tickets/${ticket.id}/history`);
      return response.data;
    },
    enabled: !!ticket?.id,
  });

  useEffect(() => {
    if (ticket) {
      setStatus(ticket.status);
      setAssignedTo(ticket.assignedTo ?? null);
      setSolution(ticket.solution || '');
      setNotes('');
    }
  }, [ticket]);

  const handleSave = () => {
    if (!ticket) return;

    const updates: Partial<Ticket> = {
      status,
      assignedTo: assignedTo ?? null,
      solution: status === 'resolved' ? solution || null : null,
    };

    onSave(updates);
    onClose();
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString();
  };

  const isResolved = status === 'resolved' || ticket?.status === 'resolved';

  if (!ticket) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div>
            Ticket {ticket.ticketNumber}
            <Typography variant="subtitle2" color="textSecondary">
              Submitted by {ticket.submitterEmail}
            </Typography>
          </div>
          <Typography variant="caption" color="textSecondary">
            Created: {formatDate(ticket.createdAt || new Date().toISOString())}
          </Typography>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ width: '100%' }}>
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs value={currentTab} onChange={handleTabChange}>
              <Tab label="Details" />
              <Tab label="History" />
              {isResolved && <Tab label="Solutions" />}
            </Tabs>
          </Box>

          <TabPanel value={currentTab} index={0}>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Status</InputLabel>
              <Select
                value={status}
                onChange={(e) => setStatus(e.target.value as typeof status)}
                label="Status"
              >
                <MenuItem value="open">Open</MenuItem>
                <MenuItem value="in_progress">In Progress</MenuItem>
                <MenuItem value="resolved">Resolved</MenuItem>
              </Select>
            </FormControl>

            {(isAdmin || user?.role === 'staff') && (
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Assign To</InputLabel>
                <Select
                  value={assignedTo?.toString() || ''}
                  onChange={(e: SelectChangeEvent<string>) => {
                    const value = e.target.value;
                    setAssignedTo(value ? Number(value) : null);
                  }}
                  label="Assign To"
                >
                  <MenuItem value="">Unassigned</MenuItem>
                  {users?.data?.map((user) => (
                    <MenuItem key={user.id} value={user.id?.toString()}>
                      {user.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            <TextField
              fullWidth
              label="Description"
              multiline
              rows={4}
              value={ticket.description}
              InputProps={{
                readOnly: true,
              }}
              sx={{ mb: 2 }}
            />

            {isResolved && (
              <TextField
                fullWidth
                label="Solution"
                multiline
                rows={4}
                value={solution}
                onChange={(e) => setSolution(e.target.value)}
                sx={{ mb: 2 }}
                helperText="Please provide the solution that resolved this ticket"
                required={status === 'resolved'}
              />
            )}

            <TextField
              fullWidth
              label="Notes"
              multiline
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              helperText="Add notes about your changes"
            />
          </TabPanel>

          <TabPanel value={currentTab} index={1}>
            <List>
              {historyData?.data?.map((entry) => (
                <ListItem key={entry.id} divider>
                  <ListItemText
                    primary={entry.notes}
                    secondary={
                      <>
                        <Typography variant="caption" component="span">
                          {entry.action.toUpperCase()} - {formatDate(entry.createdAt)}
                        </Typography>
                        {entry.userId && (
                          <Typography variant="caption" component="span" sx={{ ml: 1 }}>
                            by {users?.data?.find(u => u.id === entry.userId)?.name || 'Unknown'}
                          </Typography>
                        )}
                      </>
                    }
                  />
                </ListItem>
              ))}
            </List>
          </TabPanel>

          {isResolved && (
            <TabPanel value={currentTab} index={2}>
              <CommonSolutions 
                category={ticket.category}
                email={ticket.submitterEmail}
              />
            </TabPanel>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button 
          onClick={handleSave} 
          variant="contained" 
          color="primary"
          disabled={status === 'resolved' && !solution}
        >
          Save Changes
        </Button>
      </DialogActions>
    </Dialog>
  );
}