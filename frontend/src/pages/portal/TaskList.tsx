import React, { useState } from 'react';
import TaskDialog from '../../components/TaskDialog';
import {
  Box,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Stack,
  TextField,
  MenuItem,
  Tooltip,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  PlayArrow as StartIcon,
  Done as DoneIcon,
  Person as PersonIcon,
  CalendarToday as CalendarTodayIcon,
  ArrowForward as ArrowForwardIcon,
  Flag as PriorityIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Task } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import api from '../../utils/axios';
import { 
  colors, 
  shadows, 
  chipStyles, 
  sectionTitleStyles 
} from '../../styles/common';

type TaskWithAssignee = Task;

const truncateDescription = (description: string, limit: number = 100) => {
  if (description.length <= limit) return description;
  return `${description.slice(0, limit)}...`;
};

// Due Tasks Section Component
const DueTasksSection = ({ 
  title, 
  tasks, 
  icon: Icon, 
  color,
  onTaskClick,
}: { 
  title: string;
  tasks: TaskWithAssignee[];
  icon: React.ElementType;
  color: string;
  onTaskClick: (task: TaskWithAssignee) => void;
}) => {
  const theme = useTheme();
  
  if (tasks.length === 0) return null;

  return (
    <Box sx={{ mb: 4 }}>
      <Stack 
        direction="row" 
        spacing={1} 
        alignItems="center" 
        sx={{ mb: 2 }}
      >
        <Icon sx={{ color }} />
        <Typography sx={{
          ...sectionTitleStyles,
          fontSize: '1.25rem',
          color,
        }}>
          {title}
        </Typography>
        <Typography 
          sx={{ 
            ml: 'auto',
            color: alpha(theme.palette.text.primary, 0.6),
            fontSize: '0.875rem',
          }}
        >
          {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
        </Typography>
      </Stack>
      <TableContainer 
        sx={{
          borderRadius: 3,
          boxShadow: shadows.subtle,
          backgroundColor: alpha(theme.palette.background.paper, 0.6),
          backdropFilter: 'blur(10px)',
          border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          overflow: 'hidden',
          '& .MuiTableCell-root': {
            borderColor: alpha(theme.palette.divider, 0.1),
          },
        }}
      >
        <Table>
          <TableHead>
            <TableRow
              sx={{
                '& .MuiTableCell-root': {
                  backgroundColor: alpha(theme.palette.background.paper, 0.8),
                  backdropFilter: 'blur(8px)',
                  fontWeight: 600,
                }
              }}
            >
              <TableCell>Title</TableCell>
              <TableCell>Description</TableCell>
              <TableCell>Priority</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Assigned To</TableCell>
              <TableCell>Due</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {tasks.map((task) => (
              <TableRow 
                key={task.id}
                onClick={() => onTaskClick(task)}
                sx={{
                  cursor: 'pointer',
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': { 
                    backgroundColor: alpha(theme.palette.action.hover, 0.7),
                    transform: 'translateX(6px)',
                  },
                }}
              >
                <TableCell>{task.title}</TableCell>
                <TableCell>
                  {task.description.length > 100 ? (
                    <Tooltip title={task.description}>
                      <Typography 
                        variant="body2" 
                        sx={{ cursor: 'pointer' }}
                      >
                        {truncateDescription(task.description)}
                      </Typography>
                    </Tooltip>
                  ) : (
                    task.description
                  )}
                </TableCell>
                <TableCell>
                  <Chip
                    label={task.priority}
                    size="small"
                    icon={<PriorityIcon />}
                    sx={{
                      ...chipStyles,
                      backgroundColor: alpha(getPriorityColor(task.priority), 0.1),
                      color: getPriorityColor(task.priority),
                      textTransform: 'capitalize',
                    }}
                  />
                </TableCell>
                <TableCell>
                  <Chip
                    label={task.status}
                    size="small"
                    sx={{
                      ...chipStyles,
                      backgroundColor: alpha(getStatusColor(task.status), 0.1),
                      color: getStatusColor(task.status),
                      textTransform: 'capitalize',
                    }}
                  />
                </TableCell>
                <TableCell>
                  <Chip
                    icon={<PersonIcon />}
                    label={task.assignedUser?.name || 'Unassigned'}
                    size="small"
                    sx={{
                      ...chipStyles,
                      backgroundColor: task.assignedUser
                        ? alpha(colors.primaryBlue, 0.1)
                        : alpha(colors.secondaryGray, 0.1),
                      color: task.assignedUser
                        ? colors.primaryBlue
                        : colors.secondaryGray,
                    }}
                  />
                </TableCell>
                <TableCell>
                  <Typography
                    variant="body2"
                    sx={{ 
                      color: theme.palette.text.secondary,
                      fontWeight: 500,
                    }}
                  >
                    {formatDueDate(task.dueDate)}
                  </Typography>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

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

const getPriorityColor = (priority: string): string => {
  switch (priority) {
    case 'high':
      return colors.errorRed;
    case 'medium':
      return colors.warningYellow;
    case 'low':
      return colors.successGreen;
    default:
      return colors.secondaryGray;
  }
};

const getStatusColor = (status: string): string => {
  switch (status) {
    case 'todo':
      return colors.errorRed;
    case 'in_progress':
      return colors.warningYellow;
    case 'done':
      return colors.successGreen;
    default:
      return colors.secondaryGray;
  }
};

export default function TaskList() {
  const theme = useTheme();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskWithAssignee | null>(null);

  // Get today's date at midnight for comparison
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const { data, isLoading, error } = useQuery<{ data: TaskWithAssignee[] }>({
    queryKey: ['tasks'],
    queryFn: async () => {
      try {
        const response = await api.get('/tasks');
        return response.data;
      } catch (err) {
        console.error('Error fetching tasks:', err);
        return { data: [] };
      }
    },
  });

  const tasks = data?.data || [];

  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const response = await api.patch(`/tasks/${id}`, { status });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const saveTaskMutation = useMutation({
    mutationFn: async (taskData: Partial<TaskWithAssignee>) => {
      if (taskData.id) {
        const response = await api.patch(`/tasks/${taskData.id}`, taskData);
        return response.data;
      } else {
        const response = await api.post('/tasks', taskData);
        return response.data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setDialogOpen(false);
      setSelectedTask(null);
    },
  });

  const handleSaveTask = (taskData: Partial<TaskWithAssignee>) => {
    saveTaskMutation.mutate(taskData);
  };

  const handleStatusChange = (task: TaskWithAssignee, newStatus: string) => {
    if (task.id) {
      updateTaskMutation.mutate({ id: task.id, status: newStatus });
    }
  };

  const filteredTasks = React.useMemo(() => {
    if (!Array.isArray(tasks)) return [];
    return tasks.filter((task) => {
      if (!task) return false;
      const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
      const matchesPriority = priorityFilter === 'all' || task.priority === priorityFilter;
      return matchesStatus && matchesPriority;
    });
  }, [tasks, statusFilter, priorityFilter]);

  const dueTodayTasks = filteredTasks.filter(task => 
    task.dueDate && new Date(task.dueDate).getDate() === today.getDate()
  );

  const dueTomorrowTasks = filteredTasks.filter(task => 
    task.dueDate && new Date(task.dueDate).getDate() === tomorrow.getDate()
  );

  const myTasks = filteredTasks.filter(task => task.assignedTo === user?.id);

  const handleTaskClick = (task: TaskWithAssignee) => {
    setSelectedTask(task);
    setDialogOpen(true);
  };

  if (error) {
    return (
      <Box 
        sx={{ 
          display: 'flex', 
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: 200,
          p: 3,
          backgroundColor: alpha(colors.errorRed, 0.1),
          borderRadius: 2,
        }}
      >
        <Typography 
          sx={{ 
            color: colors.errorRed,
            fontWeight: 500,
          }}
        >
          Error loading tasks. Please try again later.
        </Typography>
      </Box>
    );
  }

  if (isLoading) {
    return (
      <Box 
        sx={{ 
          display: 'flex', 
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: 200,
        }}
      >
        <Typography 
          sx={{ 
            color: theme.palette.text.secondary,
            fontWeight: 500,
          }}
        >
          Loading tasks...
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <TaskDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setSelectedTask(null);
        }}
        task={selectedTask}
        onSave={handleSaveTask}
        isNew={!selectedTask}
        currentUser={user}
      />
      
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{ mb: 4 }}
      >
        <Typography sx={sectionTitleStyles}>
          Internal Tasks
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => {
            setSelectedTask(null);
            setDialogOpen(true);
          }}
          sx={{
            ...chipStyles,
            backgroundColor: colors.primaryBlue,
            color: 'white',
            transition: 'all 0.2s ease-in-out',
            transform: 'translateY(0)',
            '&:hover': {
              backgroundColor: alpha(colors.primaryBlue, 0.9),
              transform: 'translateY(-2px)',
              boxShadow: shadows.medium,
            },
          }}
        >
          New Task
        </Button>
      </Stack>

      <Stack 
        direction={{ xs: 'column', sm: 'row' }} 
        spacing={2} 
        sx={{
          mb: 4,
          p: 3,
          backgroundColor: alpha(theme.palette.background.paper, 0.6),
          backdropFilter: 'blur(10px)',
          borderRadius: 2,
          boxShadow: shadows.subtle,
          border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
        }}
      >
        <TextField
          select
          label="Status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          sx={{
            width: { xs: '100%', sm: 200 },
            '& .MuiOutlinedInput-root': {
              borderRadius: 2,
              backgroundColor: theme.palette.background.paper,
              transition: 'all 0.2s ease-in-out',
              '&:hover': {
                backgroundColor: alpha(theme.palette.background.paper, 0.8),
              },
              '&.Mui-focused': {
                backgroundColor: alpha(theme.palette.background.paper, 0.9),
                boxShadow: shadows.subtle,
              },
            },
          }}
          size="small"
        >
          <MenuItem value="all">All Status</MenuItem>
          <MenuItem value="todo">Todo</MenuItem>
          <MenuItem value="in_progress">In Progress</MenuItem>
          <MenuItem value="done">Done</MenuItem>
        </TextField>

        <TextField
          select
          label="Priority"
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          sx={{
            width: { xs: '100%', sm: 200 },
            '& .MuiOutlinedInput-root': {
              borderRadius: 2,
              backgroundColor: theme.palette.background.paper,
              transition: 'all 0.2s ease-in-out',
              '&:hover': {
                backgroundColor: alpha(theme.palette.background.paper, 0.8),
              },
              '&.Mui-focused': {
                backgroundColor: alpha(theme.palette.background.paper, 0.9),
                boxShadow: shadows.subtle,
              },
            },
          }}
          size="small"
        >
          <MenuItem value="all">All Priority</MenuItem>
          <MenuItem value="high">High</MenuItem>
          <MenuItem value="medium">Medium</MenuItem>
          <MenuItem value="low">Low</MenuItem>
        </TextField>
      </Stack>

      <DueTasksSection 
        title="Due Today"
        tasks={dueTodayTasks}
        icon={CalendarTodayIcon}
        color={colors.warningYellow}
        onTaskClick={handleTaskClick}
      />

      <DueTasksSection 
        title="Due Tomorrow"
        tasks={dueTomorrowTasks}
        icon={ArrowForwardIcon}
        color={colors.primaryBlue}
        onTaskClick={handleTaskClick}
      />

      {user && myTasks.length > 0 && (
        <Box sx={{ mb: 6 }}>
          <DueTasksSection 
            title="My Tasks"
            tasks={myTasks}
            icon={PersonIcon}
            color={colors.successGreen}
            onTaskClick={handleTaskClick}
          />
        </Box>
      )}

      <TableContainer
        sx={{
          borderRadius: 3,
          boxShadow: shadows.subtle,
          backgroundColor: alpha(theme.palette.background.paper, 0.6),
          backdropFilter: 'blur(10px)',
          border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          overflow: 'hidden',
          '& .MuiTableCell-root': {
            borderColor: alpha(theme.palette.divider, 0.1),
          },
        }}
      >
        <Table>
          <TableHead>
            <TableRow
              sx={{
                '& .MuiTableCell-root': {
                  backgroundColor: alpha(theme.palette.background.paper, 0.8),
                  backdropFilter: 'blur(8px)',
                  fontWeight: 600,
                }
              }}
            >
              <TableCell>Title</TableCell>
              <TableCell>Description</TableCell>
              <TableCell>Priority</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Assigned To</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredTasks.map((task) => (
              <TableRow
                key={task.id}
                sx={{
                  cursor: 'pointer',
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': { 
                    backgroundColor: alpha(theme.palette.action.hover, 0.7),
                    transform: 'translateX(6px)',
                  },
                }}
              >
                <TableCell>{task.title}</TableCell>
                <TableCell>
                  {task.description.length > 100 ? (
                    <Tooltip title={task.description}>
                      <Typography 
                        variant="body2" 
                        sx={{ cursor: 'pointer' }}
                      >
                        {truncateDescription(task.description)}
                      </Typography>
                    </Tooltip>
                  ) : (
                    task.description
                  )}
                </TableCell>
                <TableCell>
                  <Chip
                    label={task.priority}
                    size="small"
                    icon={<PriorityIcon />}
                    sx={{
                      ...chipStyles,
                      backgroundColor: alpha(getPriorityColor(task.priority), 0.1),
                      color: getPriorityColor(task.priority),
                      textTransform: 'capitalize',
                    }}
                  />
                </TableCell>
                <TableCell>
                  <Chip
                    label={task.status}
                    size="small"
                    sx={{
                      ...chipStyles,
                      backgroundColor: alpha(getStatusColor(task.status), 0.1),
                      color: getStatusColor(task.status),
                      textTransform: 'capitalize',
                    }}
                  />
                </TableCell>
                <TableCell>
                  <Chip
                    icon={<PersonIcon />}
                    label={task.assignedUser?.name || 'Unassigned'}
                    size="small"
                    sx={{
                      ...chipStyles,
                      backgroundColor: task.assignedUser
                        ? alpha(colors.primaryBlue, 0.1)
                        : alpha(colors.secondaryGray, 0.1),
                      color: task.assignedUser
                        ? colors.primaryBlue
                        : colors.secondaryGray,
                    }}
                  />
                </TableCell>
                <TableCell>
                  <Stack direction="row" spacing={1}>
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStatusChange(task, 'in_progress');
                      }}
                      disabled={task.status !== 'todo'}
                      sx={{
                        ...chipStyles,
                        backgroundColor: task.status === 'todo'
                          ? alpha(colors.warningYellow, 0.1)
                          : undefined,
                        color: colors.warningYellow,
                        '&:hover': {
                          backgroundColor: alpha(colors.warningYellow, 0.2),
                        },
                        '&:disabled': {
                          backgroundColor: alpha(theme.palette.action.disabledBackground, 0.3),
                          color: theme.palette.action.disabled,
                        },
                      }}
                    >
                      <StartIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStatusChange(task, 'done');
                      }}
                      disabled={task.status === 'done'}
                      sx={{
                        ...chipStyles,
                        backgroundColor: alpha(colors.successGreen, 0.1),
                        color: colors.successGreen,
                        '&:hover': {
                          backgroundColor: alpha(colors.successGreen, 0.2),
                        },
                        '&:disabled': {
                          backgroundColor: alpha(theme.palette.action.disabledBackground, 0.3),
                          color: theme.palette.action.disabled,
                        },
                      }}
                    >
                      <DoneIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedTask(task);
                        setDialogOpen(true);
                      }}
                      sx={{
                        ...chipStyles,
                        backgroundColor: alpha(colors.primaryBlue, 0.1),
                        color: colors.primaryBlue,
                        '&:hover': {
                          backgroundColor: alpha(colors.primaryBlue, 0.2),
                        },
                      }}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
            {filteredTasks.length === 0 && (
              <TableRow>
                <TableCell colSpan={6}>
                  <Box 
                    sx={{ 
                      textAlign: 'center',
                      py: 4,
                    }}
                  >
                    <Typography 
                      variant="body1"
                      sx={{ 
                        color: theme.palette.text.secondary,
                        fontWeight: 500,
                      }}
                    >
                      No tasks found
                    </Typography>
                  </Box>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}