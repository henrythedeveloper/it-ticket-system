import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  Chip,
  IconButton,
  CircularProgress,
} from '@mui/material';
import { Edit as EditIcon } from '@mui/icons-material';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../contexts/ThemeContext';
import TicketDialog from '../../components/TicketDialog';
import TaskDialog from '../../components/TaskDialog';
import axios from '../../utils/axios';
import { Task, Ticket, isTicket } from '../../types';

const Dashboard = () => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [recentTasks, setRecentTasks] = useState<Task[]>([]);
  const [recentTickets, setRecentTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [ticketDialogOpen, setTicketDialogOpen] = useState(false);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);

  useEffect(() => {
    fetchRecentItems();
  }, []);

  const fetchRecentItems = async () => {
    try {
      setLoading(true);
      const [tasksRes, ticketsRes] = await Promise.all([
        axios.get('/api/tasks?limit=5'),
        axios.get('/api/tickets?limit=5'),
      ]);
      setRecentTasks(tasksRes.data.data || []);
      setRecentTickets(ticketsRes.data.data || []);
    } catch (error) {
      console.error('Error fetching recent items:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleItemClick = (item: Task | Ticket) => {
    if (isTicket(item)) {
      setSelectedTicket(item);
      setTicketDialogOpen(true);
    } else {
      setSelectedTask(item);
      setTaskDialogOpen(true);
    }
  };

  const handleDialogClose = () => {
    setSelectedTicket(null);
    setSelectedTask(null);
    setTicketDialogOpen(false);
    setTaskDialogOpen(false);
  };

  const handleTicketSave = async (updatedTicket: Partial<Ticket>) => {
    try {
      if (selectedTicket) {
        await axios.patch(`/api/tickets/${selectedTicket.id}`, updatedTicket);
        await fetchRecentItems();
      }
      handleDialogClose();
    } catch (error) {
      console.error('Error updating ticket:', error);
    }
  };

  const handleTaskSave = async (updatedTask: Partial<Task>) => {
    try {
      if (selectedTask) {
        await axios.patch(`/api/tasks/${selectedTask.id}`, updatedTask);
        await fetchRecentItems();
      }
      handleDialogClose();
    } catch (error) {
      console.error('Error updating task:', error);
    }
  };

  const getItemColor = (item: Task | Ticket) => {
    if (isTicket(item)) {
      switch (item.urgency) {
        case 'critical':
          return theme.colors.errorRed;
        case 'high':
          return theme.colors.warningYellow;
        case 'low':
          return theme.colors.successGreen;
        default:
          return theme.colors.secondaryGray;
      }
    } else {
      switch (item.priority) {
        case 'high':
          return theme.colors.errorRed;
        case 'medium':
          return theme.colors.warningYellow;
        case 'low':
          return theme.colors.successGreen;
        default:
          return theme.colors.secondaryGray;
      }
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box p={3}>
      <Typography variant="h4" gutterBottom>
        Dashboard
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Recent Tickets
            </Typography>
            {recentTickets.map((ticket) => (
              <Card key={ticket.id} sx={{ mb: 2 }}>
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="subtitle1">
                      #{ticket.ticketNumber} - {ticket.submitterEmail}
                    </Typography>
                    <IconButton size="small" onClick={() => handleItemClick(ticket)}>
                      <EditIcon />
                    </IconButton>
                  </Box>
                  <Typography
                    variant="body2"
                    color="textSecondary"
                    sx={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                    }}
                  >
                    {ticket.description}
                  </Typography>
                  <Box mt={1}>
                    <Chip
                      size="small"
                      label={ticket.status.toUpperCase().replace('_', ' ')}
                      sx={{ backgroundColor: getItemColor(ticket), color: '#fff' }}
                    />
                  </Box>
                </CardContent>
              </Card>
            ))}
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Recent Tasks
            </Typography>
            {recentTasks.map((task) => (
              <Card key={task.id} sx={{ mb: 2 }}>
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="subtitle1">{task.title}</Typography>
                    <IconButton size="small" onClick={() => handleItemClick(task)}>
                      <EditIcon />
                    </IconButton>
                  </Box>
                  <Typography
                    variant="body2"
                    color="textSecondary"
                    sx={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                    }}
                  >
                    {task.description}
                  </Typography>
                  <Box mt={1}>
                    <Chip
                      size="small"
                      label={task.status.toUpperCase().replace('_', ' ')}
                      sx={{ backgroundColor: getItemColor(task), color: '#fff' }}
                    />
                  </Box>
                </CardContent>
              </Card>
            ))}
          </Paper>
        </Grid>
      </Grid>

      {selectedTicket && (
        <TicketDialog
          open={ticketDialogOpen}
          onClose={handleDialogClose}
          onSave={handleTicketSave}
          ticket={selectedTicket}
          currentUser={user!}
        />
      )}

      {selectedTask && (
        <TaskDialog
          open={taskDialogOpen}
          onClose={handleDialogClose}
          onSave={handleTaskSave}
          task={selectedTask}
          currentUser={user!}
        />
      )}
    </Box>
  );
};

export default Dashboard;