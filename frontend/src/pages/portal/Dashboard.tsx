import {
  Box,
  Typography,
  Grid,
  Paper,
  List,
  ListItem,
  ListItemText,
  Chip,
  Button,
  useTheme,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Task, Ticket } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../utils/axios';

export default function Dashboard() {
  const { user } = useAuth();
  const theme = useTheme();
  const navigate = useNavigate();

  const { data: tickets } = useQuery<{ data: Ticket[] }>({
    queryKey: ['tickets'],
    queryFn: async () => {
      const response = await api.get('/tickets');
      return response.data;
    },
  });

  const { data: tasks } = useQuery<{ data: Task[] }>({
    queryKey: ['tasks'],
    queryFn: async () => {
      const response = await api.get('/tasks');
      return response.data;
    },
  });

  const assignedTickets = tickets?.data?.filter(
    (ticket) => ticket.assignedTo === user?.id && ticket.status !== 'resolved'
  ) || [];

  const assignedTasks = tasks?.data?.filter(
    (task) => task.assignedTo === user?.id && task.status !== 'done'
  ) || [];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
      case 'todo':
        return 'error';
      case 'in_progress':
        return 'warning';
      case 'resolved':
      case 'done':
        return 'success';
      default:
        return 'default';
    }
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Welcome back, {user?.name}
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper
            sx={{
              p: 2,
              height: '100%',
              backgroundColor: theme.palette.background.paper,
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6">Assigned Tickets</Typography>
              <Button
                color="primary"
                size="small"
                onClick={() => navigate('/portal/tickets')}
              >
                View All
              </Button>
            </Box>
            <List>
              {assignedTickets.length === 0 ? (
                <ListItem>
                  <ListItemText primary="No tickets assigned" />
                </ListItem>
              ) : (
                assignedTickets.map((ticket) => (
                  <ListItem
                    key={ticket.id}
                    sx={{
                      border: `1px solid ${theme.palette.divider}`,
                      borderRadius: 1,
                      mb: 1,
                    }}
                  >
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography
                            variant="subtitle2"
                            sx={{ fontFamily: 'monospace' }}
                          >
                            {ticket.ticketNumber}
                          </Typography>
                          <Chip
                            size="small"
                            label={ticket.status}
                            color={getStatusColor(ticket.status)}
                          />
                        </Box>
                      }
                      secondary={ticket.description}
                      secondaryTypographyProps={{
                        noWrap: true,
                        style: { maxWidth: '100%' },
                      }}
                    />
                  </ListItem>
                ))
              )}
            </List>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper
            sx={{
              p: 2,
              height: '100%',
              backgroundColor: theme.palette.background.paper,
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6">Assigned Tasks</Typography>
              <Button
                color="primary"
                size="small"
                onClick={() => navigate('/portal/tasks')}
              >
                View All
              </Button>
            </Box>
            <List>
              {assignedTasks.length === 0 ? (
                <ListItem>
                  <ListItemText primary="No tasks assigned" />
                </ListItem>
              ) : (
                assignedTasks.map((task) => (
                  <ListItem
                    key={task.id}
                    sx={{
                      border: `1px solid ${theme.palette.divider}`,
                      borderRadius: 1,
                      mb: 1,
                    }}
                  >
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="subtitle2">{task.title}</Typography>
                          <Chip
                            size="small"
                            label={task.status}
                            color={getStatusColor(task.status)}
                          />
                          <Chip
                            size="small"
                            label={task.priority}
                            color={
                              task.priority === 'high'
                                ? 'error'
                                : task.priority === 'medium'
                                ? 'warning'
                                : 'default'
                            }
                            variant="outlined"
                          />
                        </Box>
                      }
                      secondary={task.description}
                      secondaryTypographyProps={{
                        noWrap: true,
                        style: { maxWidth: '100%' },
                      }}
                    />
                  </ListItem>
                ))
              )}
            </List>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}