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
  alpha,
  Stack,
} from '@mui/material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Task, Ticket, isTicket } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import api from '../../utils/axios';
import {
  cardStyles,
  listItemStyles,
  headerContainerStyles,
  truncatedTextStyles,
  chipStyles,
  chipContainerStyles,
  sectionTitleStyles,
  ticketNumberStyles,
  colors,
  shadows,
} from '../../styles/common';
import { useState } from 'react';
import TicketDialog from '../../components/TicketDialog';
import TaskDialog from '../../components/TaskDialog';
import { 
  CalendarToday as CalendarIcon,
  ArrowForward as ArrowIcon,
  Error as UrgentIcon,
  Assignment as TaskIcon,
  ConfirmationNumber as TicketIcon,
} from '@mui/icons-material';

export default function Dashboard() {
  const theme = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const queryClient = useQueryClient();

  // Get today's date at midnight for comparison
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

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

  const dueTodayTickets = assignedTickets.filter(ticket => 
    ticket.dueDate && new Date(ticket.dueDate).getDate() === today.getDate()
  );

  const dueTomorrowTickets = assignedTickets.filter(ticket => 
    ticket.dueDate && new Date(ticket.dueDate).getDate() === tomorrow.getDate()
  );

  const dueTodayTasks = assignedTasks.filter(task => 
    task.dueDate && new Date(task.dueDate).getDate() === today.getDate()
  );

  const dueTomorrowTasks = assignedTasks.filter(task => 
    task.dueDate && new Date(task.dueDate).getDate() === tomorrow.getDate()
  );

  const urgentItems = [
    ...assignedTickets.filter(ticket => 
      ticket.urgency === 'critical' || 
      (ticket.dueDate && new Date(ticket.dueDate) <= tomorrow)
    ),
    ...assignedTasks.filter(task => 
      task.priority === 'high' && 
      task.dueDate && new Date(task.dueDate) <= tomorrow
    )
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
      case 'todo':
        return colors.primaryBlue;
      case 'in_progress':
        return colors.warningYellow;
      case 'resolved':
      case 'done':
        return colors.successGreen;
      default:
        return colors.secondaryGray;
    }
  };

  const handleTaskSave = async (updatedTask: Partial<Task>) => {
    if (!selectedTask?.id) return;
    try {
      await api.patch(`/tasks/${selectedTask.id}`, updatedTask);
      await queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setSelectedTask(null);
    } catch (error) {
      console.error('Failed to update task:', error);
    }
  };

  const handleTicketSave = async (updatedTicket: Partial<Ticket>) => {
    if (!selectedTicket?.id) return;
    try {
      await api.patch(`/tickets/${selectedTicket.id}`, updatedTicket);
      await queryClient.invalidateQueries({ queryKey: ['tickets'] });
      setSelectedTicket(null);
    } catch (error) {
      console.error('Failed to update ticket:', error);
    }
  };

  const ItemCard = ({ item }: { item: Ticket | Task }) => (
    <Box
      onClick={() => {
        if (isTicket(item)) {
          setSelectedTicket(item);
        } else {
          setSelectedTask(item);
        }
      }}
      sx={{
        p: 2,
        borderRadius: 2,
        backgroundColor: alpha(theme.palette.background.paper, 0.6),
        backdropFilter: 'blur(10px)',
        border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
        boxShadow: shadows.subtle,
        cursor: 'pointer',
        transition: 'all 0.2s ease-in-out',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: shadows.medium,
          backgroundColor: alpha(theme.palette.background.paper, 0.8),
        },
      }}
    >
      <Stack spacing={2}>
        <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
          <Stack direction="row" spacing={1} alignItems="center">
            {isTicket(item) ? (
              <Typography sx={ticketNumberStyles}>
                {item.ticketNumber}
              </Typography>
            ) : (
              <Typography sx={{
                ...sectionTitleStyles,
                fontSize: '1rem',
              }}>
                {item.title}
              </Typography>
            )}
          </Stack>
          <Stack direction="row" spacing={1}>
            <Chip
              size="small"
              label={item.status}
              sx={{
                ...chipStyles,
                backgroundColor: `${getStatusColor(item.status)}15`,
                color: getStatusColor(item.status),
              }}
            />
            {isTicket(item) ? (
              <Chip
                size="small"
                label={item.urgency}
                sx={{
                  ...chipStyles,
                  backgroundColor: `${colors.errorRed}15`,
                  color: colors.errorRed,
                }}
              />
            ) : (
              <Chip
                size="small"
                label={item.priority}
                sx={{
                  ...chipStyles,
                  backgroundColor:
                    item.priority === 'high'
                      ? `${colors.errorRed}15`
                      : item.priority === 'medium'
                      ? `${colors.warningYellow}15`
                      : `${colors.secondaryGray}15`,
                  color:
                    item.priority === 'high'
                      ? colors.errorRed
                      : item.priority === 'medium'
                      ? colors.warningYellow
                      : colors.secondaryGray,
                }}
              />
            )}
          </Stack>
        </Stack>
        <Typography 
          sx={{
            ...truncatedTextStyles,
            color: alpha(theme.palette.text.primary, 0.7),
          }}
        >
          {item.description}
        </Typography>
      </Stack>
    </Box>
  );

  const DueSection = ({ title, icon, tickets, tasks }: { 
    title: string;
    icon: React.ReactNode;
    tickets: Ticket[];
    tasks: Task[];
  }) => (
    tickets.length > 0 || tasks.length > 0 ? (
      <Box sx={{ mb: 4 }}>
        <Stack 
          direction="row" 
          spacing={1} 
          alignItems="center" 
          sx={{ mb: 2 }}
        >
          {icon}
          <Typography sx={{
            ...sectionTitleStyles,
            fontSize: '1.25rem',
          }}>
            {title}
          </Typography>
        </Stack>
        <Grid container spacing={2}>
          {[...tickets, ...tasks].map((item) => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={isTicket(item) ? item.ticketNumber : item.id}>
              <ItemCard item={item} />
            </Grid>
          ))}
        </Grid>
      </Box>
    ) : null
  );

  return (
    <Box sx={{ maxWidth: '100%', mx: 'auto', p: { xs: 2, sm: 3 } }}>
      {/* Welcome Section */}
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ mb: 4 }}
      >
        <Typography variant="h4" sx={sectionTitleStyles}>
          Welcome back, {user?.name}
        </Typography>
        <Stack direction="row" spacing={2}>
          <Button
            startIcon={<TicketIcon />}
            onClick={() => navigate('/portal/tickets')}
            sx={{
              ...chipStyles,
              backgroundColor: alpha(colors.primaryBlue, 0.1),
              color: colors.primaryBlue,
              '&:hover': {
                backgroundColor: alpha(colors.primaryBlue, 0.2),
              },
            }}
          >
            All Tickets
          </Button>
          <Button
            startIcon={<TaskIcon />}
            onClick={() => navigate('/portal/tasks')}
            sx={{
              ...chipStyles,
              backgroundColor: alpha(colors.successGreen, 0.1),
              color: colors.successGreen,
              '&:hover': {
                backgroundColor: alpha(colors.successGreen, 0.2),
              },
            }}
          >
            All Tasks
          </Button>
        </Stack>
      </Stack>

      {/* Due Today Section */}
      <DueSection
        title="Due Today"
        icon={<CalendarIcon sx={{ color: colors.warningYellow }} />}
        tickets={dueTodayTickets}
        tasks={dueTodayTasks}
      />

      {/* Due Tomorrow Section */}
      <DueSection
        title="Due Tomorrow"
        icon={<ArrowIcon sx={{ color: colors.primaryBlue }} />}
        tickets={dueTomorrowTickets}
        tasks={dueTomorrowTasks}
      />

      {/* Urgent Items Section */}
      {urgentItems.length > 0 && (
        <Box sx={{ mb: 4 }}>
          <Stack 
            direction="row" 
            spacing={1} 
            alignItems="center" 
            sx={{ mb: 2 }}
          >
            <UrgentIcon sx={{ color: colors.errorRed }} />
            <Typography sx={{
              ...sectionTitleStyles,
              fontSize: '1.25rem',
              color: colors.errorRed,
            }}>
              Urgent Items
            </Typography>
          </Stack>
          <Grid container spacing={2}>
            {urgentItems.map((item) => (
              <Grid item xs={12} sm={6} md={4} lg={3} key={isTicket(item) ? item.ticketNumber : item.id}>
                <ItemCard item={item} />
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {/* Main Content Grid */}
      <Grid container spacing={3}>
        {/* Assigned Tickets */}
        <Grid item xs={12} lg={6}>
          <Paper 
            sx={{
              ...cardStyles,
              height: '100%',
              backgroundColor: alpha(theme.palette.background.paper, 0.6),
              backdropFilter: 'blur(10px)',
              border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            }} 
            elevation={0}
          >
            <Box sx={headerContainerStyles}>
              <Stack direction="row" spacing={1} alignItems="center">
                <TicketIcon sx={{ color: colors.primaryBlue }} />
                <Typography variant="h6" sx={sectionTitleStyles}>
                  Assigned Tickets
                </Typography>
              </Stack>
              <Button
                color="primary"
                size="small"
                onClick={() => navigate('/portal/tickets')}
                sx={chipStyles}
              >
                View All
              </Button>
            </Box>
            <List>
              {assignedTickets.length === 0 ? (
                <Typography 
                  variant="body2" 
                  sx={{ 
                    color: alpha(theme.palette.text.primary, 0.6),
                    textAlign: 'center',
                    py: 4,
                  }}
                >
                  No tickets assigned
                </Typography>
              ) : (
                assignedTickets.map((ticket) => (
                  <ListItem
                    key={ticket.id}
                    sx={{
                      ...listItemStyles,
                      transition: 'all 0.2s ease-in-out',
                      '&:hover': {
                        backgroundColor: alpha(theme.palette.action.hover, 0.1),
                        transform: 'translateX(6px)',
                      },
                    }}
                    onClick={() => setSelectedTicket(ticket)}
                  >
                    <ListItemText
                      primary={
                        <Box sx={chipContainerStyles}>
                          <Typography sx={ticketNumberStyles}>
                            {ticket.ticketNumber}
                          </Typography>
                          <Stack direction="row" spacing={1}>
                            <Chip
                              size="small"
                              label={ticket.status}
                              sx={{
                                ...chipStyles,
                                backgroundColor: `${getStatusColor(ticket.status)}15`,
                                color: getStatusColor(ticket.status),
                              }}
                            />
                            <Chip
                              size="small"
                              label={ticket.urgency}
                              sx={{
                                ...chipStyles,
                                backgroundColor: `${colors.primaryBlue}15`,
                                color: colors.primaryBlue,
                              }}
                            />
                          </Stack>
                        </Box>
                      }
                      secondary={
                        <Typography 
                          sx={{
                            ...truncatedTextStyles,
                            color: alpha(theme.palette.text.primary, 0.7),
                          }}
                        >
                          {ticket.description}
                        </Typography>
                      }
                    />
                  </ListItem>
                ))
              )}
            </List>
          </Paper>
        </Grid>

        {/* Assigned Tasks */}
        <Grid item xs={12} lg={6}>
          <Paper 
            sx={{
              ...cardStyles,
              height: '100%',
              backgroundColor: alpha(theme.palette.background.paper, 0.6),
              backdropFilter: 'blur(10px)',
              border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            }} 
            elevation={0}
          >
            <Box sx={headerContainerStyles}>
              <Stack direction="row" spacing={1} alignItems="center">
                <TaskIcon sx={{ color: colors.successGreen }} />
                <Typography variant="h6" sx={sectionTitleStyles}>
                  Assigned Tasks
                </Typography>
              </Stack>
              <Button
                color="primary"
                size="small"
                onClick={() => navigate('/portal/tasks')}
                sx={chipStyles}
              >
                View All
              </Button>
            </Box>
            <List>
              {assignedTasks.length === 0 ? (
                <Typography 
                  variant="body2" 
                  sx={{ 
                    color: alpha(theme.palette.text.primary, 0.6),
                    textAlign: 'center',
                    py: 4,
                  }}
                >
                  No tasks assigned
                </Typography>
              ) : (
                assignedTasks.map((task) => (
                  <ListItem
                    key={task.id}
                    sx={{
                      ...listItemStyles,
                      transition: 'all 0.2s ease-in-out',
                      '&:hover': {
                        backgroundColor: alpha(theme.palette.action.hover, 0.1),
                        transform: 'translateX(6px)',
                      },
                    }}
                    onClick={() => setSelectedTask(task)}
                  >
                    <ListItemText
                      primary={
                        <Box sx={chipContainerStyles}>
                          <Typography sx={{
                            ...sectionTitleStyles,
                            fontSize: '1rem',
                          }}>
                            {task.title}
                          </Typography>
                          <Stack direction="row" spacing={1}>
                            <Chip
                              size="small"
                              label={task.status}
                              sx={{
                                ...chipStyles,
                                backgroundColor: `${getStatusColor(task.status)}15`,
                                color: getStatusColor(task.status),
                              }}
                            />
                            <Chip
                              size="small"
                              label={task.priority}
                              sx={{
                                ...chipStyles,
                                backgroundColor:
                                  task.priority === 'high'
                                    ? `${colors.errorRed}15`
                                    : task.priority === 'medium'
                                    ? `${colors.warningYellow}15`
                                    : `${colors.secondaryGray}15`,
                                color:
                                  task.priority === 'high'
                                    ? colors.errorRed
                                    : task.priority === 'medium'
                                    ? colors.warningYellow
                                    : colors.secondaryGray,
                              }}
                            />
                          </Stack>
                        </Box>
                      }
                      secondary={
                        <Typography 
                          sx={{
                            ...truncatedTextStyles,
                            color: alpha(theme.palette.text.primary, 0.7),
                          }}
                        >
                          {task.description}
                        </Typography>
                      }
                    />
                  </ListItem>
                ))
              )}
            </List>
          </Paper>
        </Grid>
      </Grid>

      {selectedTicket && (
        <TicketDialog
          open={Boolean(selectedTicket)}
          onClose={() => setSelectedTicket(null)}
          ticket={selectedTicket}
          onSave={handleTicketSave}
        />
      )}

      {selectedTask && (
        <TaskDialog 
          open={Boolean(selectedTask)}
          onClose={() => setSelectedTask(null)}
          task={selectedTask}
          onSave={handleTaskSave}
          currentUser={user!}
        />
      )}
    </Box>
  );
}