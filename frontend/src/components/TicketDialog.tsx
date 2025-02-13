import React, { useState, useEffect } from 'react';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
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
  useTheme,
  alpha,
} from '@mui/material';
import { 
  LightbulbOutlined as SolutionIcon,
  Check as CheckIcon
} from '@mui/icons-material';
import { Ticket, User, TicketHistory, Nullable, Solution } from '../types';
import { useQuery } from '@tanstack/react-query';
import api from '../utils/axios';
import CommonSolutions from './CommonSolutions';
import { colors, shadows, chipStyles, sectionTitleStyles } from '../styles/common';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  const theme = useTheme();

  return (
    <Box
      role="tabpanel"
      hidden={value !== index}
      id={`ticket-tabpanel-${index}`}
      aria-labelledby={`ticket-tab-${index}`}
      {...other}
      sx={{
        p: { xs: 2, sm: 3 },
        backgroundColor: alpha(theme.palette.background.paper, 0.6),
        borderRadius: 2,
        mt: 2,
      }}
    >
      {value === index && children}
    </Box>
  );
}

interface TicketDialogProps {
  open: boolean;
  onClose: () => void;
  ticket: Ticket | null;
  onSave: (ticket: Partial<Ticket>) => void;
}

export default function TicketDialog({
  open,
  onClose,
  ticket,
  onSave,
}: TicketDialogProps) {
  const theme = useTheme();
  const [status, setStatus] = useState<'open' | 'in_progress' | 'resolved'>('open');
  const [urgency, setUrgency] = useState<'low' | 'normal' | 'high' | 'critical'>('normal');
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [assignedTo, setAssignedTo] = useState<Nullable<number>>(null);
  const [solution, setSolution] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [currentTab, setCurrentTab] = useState(0);
  const [appliedSolution, setAppliedSolution] = useState<Solution | null>(null);

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
      setUrgency(ticket.urgency || 'normal');
      setDueDate(ticket.dueDate || null);
      setAssignedTo(ticket.assignedTo ?? null);
      setSolution(ticket.solution || '');
      setNotes('');
      // Show solutions tab by default for non-resolved tickets
      setCurrentTab(ticket.status !== 'resolved' ? 2 : 0);
      setAppliedSolution(null);
    }
  }, [ticket]);

  const handleSave = () => {
    if (!ticket) return;

    const updates: Partial<Ticket> = {
      status,
      urgency,
      dueDate,
      assignedTo: assignedTo ?? null,
      solution: solution || appliedSolution?.description || null,
    };

    onSave(updates);
    onClose();
  };

  const handleApplySolution = (selectedSolution: Solution) => {
    setAppliedSolution(selectedSolution);
    setSolution(selectedSolution.description);
    setCurrentTab(0);
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString();
  };

  const isResolved = status === 'resolved';

  if (!ticket) return null;

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="lg" 
      fullWidth
      PaperProps={{
        elevation: 0,
        sx: {
          borderRadius: 3,
          backgroundColor: theme.palette.background.default,
          boxShadow: shadows.strong,
        }
      }}
    >
      <DialogTitle sx={{ p: 3, pb: 2 }}>
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'baseline',
        }}>
          <Box>
            <Typography 
              sx={sectionTitleStyles}
              gutterBottom
            >
              Ticket {ticket.ticketNumber}
            </Typography>
            <Typography color="text.secondary" variant="body2">
              Submitted by {ticket.submitterEmail}
            </Typography>
          </Box>
          <Typography variant="caption" color="text.secondary">
            Created: {formatDate(ticket.createdAt || new Date().toISOString())}
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ px: 3 }}>
        <Box sx={{ width: '100%' }}>
          <Tabs 
            value={currentTab} 
            onChange={handleTabChange}
            variant="fullWidth"
            sx={{
              mb: 2,
              '& .MuiTab-root': {
                textTransform: 'none',
                minHeight: 48,
                fontWeight: 500,
              }
            }}
          >
            <Tab label="Details" />
            <Tab label="History" />
            <Tab 
              icon={appliedSolution ? <CheckIcon /> : <SolutionIcon />}
              iconPosition="start"
              label={appliedSolution ? "Solution Applied" : "Suggested Solutions"}
            />
          </Tabs>

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

            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
              <FormControl fullWidth>
                <InputLabel>Urgency</InputLabel>
                <Select
                  value={urgency}
                  onChange={(e) => setUrgency(e.target.value as typeof urgency)}
                  label="Urgency"
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
                    value={dueDate ? dayjs(dueDate) : null}
                    onChange={(date) => setDueDate(date ? date.toISOString() : null)}
                    slotProps={{
                      textField: {
                        fullWidth: true
                      }
                    }}
                  />
                </LocalizationProvider>
              </FormControl>
            </Box>

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

            <TextField
              fullWidth
              label="Solution"
              multiline
              rows={4}
              value={solution}
              onChange={(e) => setSolution(e.target.value)}
              sx={{ mb: 2 }}
              helperText={isResolved ? "Please provide the solution that resolved this ticket" : "Draft your solution here"}
              required={isResolved}
            />

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
                <ListItem 
                  key={entry.id}
                  sx={{
                    mb: 1,
                    backgroundColor: theme.palette.background.paper,
                    borderRadius: 2,
                    boxShadow: shadows.subtle,
                  }}
                >
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

          <TabPanel value={currentTab} index={2}>
            <CommonSolutions 
              category={ticket.category}
              email={ticket.submitterEmail}
              onApplySolution={handleApplySolution}
              appliedSolutionId={appliedSolution?.id ?? null}
            />
          </TabPanel>
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 3, pt: 2 }}>
        <Button 
          onClick={onClose}
          sx={{
            ...chipStyles,
            color: theme.palette.text.primary,
            '&:hover': {
              backgroundColor: alpha(theme.palette.text.primary, 0.1),
            }
          }}
        >
          Cancel
        </Button>
        <Button 
          onClick={handleSave} 
          variant="contained"
          disabled={isResolved && !solution}
          sx={{
            ...chipStyles,
            backgroundColor: colors.primaryBlue,
            color: 'white',
            '&:hover': {
              backgroundColor: alpha(colors.primaryBlue, 0.9),
            }
          }}
        >
          Save Changes
        </Button>
      </DialogActions>
    </Dialog>
  );
}