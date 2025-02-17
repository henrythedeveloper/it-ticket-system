import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  CircularProgress,
  TableSortLabel,
} from '@mui/material';
import { Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../contexts/ThemeContext';
import TaskDialog from '../../components/TaskDialog';
import { Task } from '../../types';
import { getCommonButtonStyles } from '../../contexts/ThemeContext';
import axios from '../../utils/axios';

type TaskStats = {
  total: number;
  todo: number;
  inProgress: number;
  done: number;
  assignedToMe: {
    todo: number;
    inProgress: number;
  };
};

const TaskList = () => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [stats, setStats] = useState<TaskStats | null>(null);
  const [orderBy, setOrderBy] = useState<keyof Task>('createdAt');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    fetchTasks();
    fetchStats();
  }, []);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/tasks');
      setTasks(response.data.data || []);
      setError('');
    } catch (err) {
      setError('Failed to fetch tasks');
      console.error('Error fetching tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await axios.get('/api/tasks/stats');
      setStats(response.data);
    } catch (err) {
      console.error('Error fetching task stats:', err);
    }
  };

  const handleSort = (property: keyof Task) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const sortTasks = (taskA: Task, taskB: Task) => {
    let comparison = 0;
    
    switch (orderBy) {
      case 'dueDate':
        comparison = (taskA.dueDate || '').localeCompare(taskB.dueDate || '');
        break;
      case 'priority':
        comparison = taskA.priority.localeCompare(taskB.priority);
        break;
      case 'status':
        comparison = taskA.status.localeCompare(taskB.status);
        break;
      case 'title':
        comparison = taskA.title.localeCompare(taskB.title);
        break;
      case 'createdAt':
      default:
        comparison = taskA.createdAt.localeCompare(taskB.createdAt);
    }

    return order === 'asc' ? comparison : -comparison;
  };

  const handleCreateTask = () => {
    setSelectedTask(null);
    setDialogOpen(true);
  };

  const handleEditTask = (task: Task) => {
    setSelectedTask(task);
    setDialogOpen(true);
  };

  const handleDeleteTask = async (task: Task) => {
    if (!window.confirm('Are you sure you want to delete this task?')) {
      return;
    }

    try {
      await axios.delete(`/api/tasks/${task.id}`);
      await fetchTasks();
      await fetchStats();
    } catch (err) {
      console.error('Error deleting task:', err);
    }
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setSelectedTask(null);
  };

  const handleTaskSave = async (taskData: Partial<Task>) => {
    try {
      if (selectedTask) {
        await axios.patch(`/api/tasks/${selectedTask.id}`, taskData);
      } else {
        await axios.post('/api/tasks', taskData);
      }
      await fetchTasks();
      await fetchStats();
      handleDialogClose();
    } catch (error) {
      console.error('Error saving task:', error);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return theme.colors.errorRed;
      case 'medium':
        return theme.colors.warningYellow;
      case 'low':
        return theme.colors.successGreen;
      default:
        return theme.colors.secondaryGray;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'done':
        return theme.colors.successGreen;
      case 'in_progress':
        return theme.colors.warningYellow;
      case 'todo':
        return theme.colors.errorRed;
      default:
        return theme.colors.secondaryGray;
    }
  };

  if (!user) {
    return null;
  }

  if (error) {
    return (
      <Box p={3}>
        <Typography color="error">{error}</Typography>
      </Box>
    );
  }

  return (
    <Box p={3}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Typography variant="h4" gutterBottom>
          Tasks
        </Typography>
        <Button
          variant="contained"
          onClick={handleCreateTask}
          sx={getCommonButtonStyles(theme)}
        >
          Create Task
        </Button>
      </Box>

      {stats && (
        <Box mb={4} display="flex" gap={2}>
          <Paper sx={{ p: 2, flex: 1 }}>
            <Typography variant="h6">Total Tasks</Typography>
            <Typography variant="h4">{stats.total}</Typography>
          </Paper>
          <Paper sx={{ p: 2, flex: 1 }}>
            <Typography variant="h6">My To-do</Typography>
            <Typography variant="h4">{stats.assignedToMe.todo}</Typography>
          </Paper>
          <Paper sx={{ p: 2, flex: 1 }}>
            <Typography variant="h6">My In Progress</Typography>
            <Typography variant="h4">{stats.assignedToMe.inProgress}</Typography>
          </Paper>
        </Box>
      )}

      {loading ? (
        <Box display="flex" justifyContent="center" p={3}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>
                  <TableSortLabel
                    active={orderBy === 'title'}
                    direction={orderBy === 'title' ? order : 'asc'}
                    onClick={() => handleSort('title')}
                  >
                    Title
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={orderBy === 'status'}
                    direction={orderBy === 'status' ? order : 'asc'}
                    onClick={() => handleSort('status')}
                  >
                    Status
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={orderBy === 'priority'}
                    direction={orderBy === 'priority' ? order : 'asc'}
                    onClick={() => handleSort('priority')}
                  >
                    Priority
                  </TableSortLabel>
                </TableCell>
                <TableCell>Assigned To</TableCell>
                <TableCell>
                  <TableSortLabel
                    active={orderBy === 'dueDate'}
                    direction={orderBy === 'dueDate' ? order : 'asc'}
                    onClick={() => handleSort('dueDate')}
                  >
                    Due Date
                  </TableSortLabel>
                </TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {[...tasks].sort(sortTasks).map((task) => (
                <TableRow key={task.id}>
                  <TableCell>{task.title}</TableCell>
                  <TableCell>
                    <Typography style={{ color: getStatusColor(task.status) }}>
                      {task.status.replace('_', ' ').toUpperCase()}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography style={{ color: getPriorityColor(task.priority) }}>
                      {task.priority.toUpperCase()}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {task.assignedUser ? task.assignedUser.name : 'Unassigned'}
                  </TableCell>
                  <TableCell>
                    {task.dueDate
                      ? new Date(task.dueDate).toLocaleDateString()
                      : 'No due date'}
                  </TableCell>
                  <TableCell>
                    <IconButton
                      onClick={() => handleEditTask(task)}
                      size="small"
                      color="primary"
                    >
                      <EditIcon />
                    </IconButton>
                    {(user.role === 'admin' || task.createdBy === user.id) && (
                      <IconButton
                        onClick={() => handleDeleteTask(task)}
                        size="small"
                        color="error"
                      >
                        <DeleteIcon />
                      </IconButton>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <TaskDialog
        open={dialogOpen}
        onClose={handleDialogClose}
        onSave={handleTaskSave}
        task={selectedTask}
        currentUser={user}
      />
    </Box>
  );
};

export default TaskList;