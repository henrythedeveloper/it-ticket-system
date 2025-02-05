import React from 'react';
import {
  Box,
  Paper,
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
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  PlayArrow as StartIcon,
  Done as DoneIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Task, User } from '../../types';
import { useAuth } from '../../contexts/AuthContext';

const API_URL = import.meta.env.VITE_API_URL;

type ChipColor = 'error' | 'warning' | 'success' | 'default';

export default function TaskList() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = React.useState('all');
  const [priorityFilter, setPriorityFilter] = React.useState('all');

  const { data: tasks = [], isLoading } = useQuery<(Task & { assignedUser?: User })[]>({
    queryKey: ['tasks'],
    queryFn: async () => {
      const response = await axios.get(`${API_URL}/tasks`);
      return response.data;
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const response = await axios.patch(`${API_URL}/tasks/${id}`, { status });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const handleStatusChange = (task: Task, newStatus: string) => {
    if (task.id) {
      updateTaskMutation.mutate({ id: task.id, status: newStatus });
    }
  };

  const filteredTasks = React.useMemo(() => {
    return tasks.filter((task) => {
      const matchesStatus =
        statusFilter === 'all' || task.status === statusFilter;
      const matchesPriority =
        priorityFilter === 'all' || task.priority === priorityFilter;
      return matchesStatus && matchesPriority;
    });
  }, [tasks, statusFilter, priorityFilter]);

  const getPriorityColor = (priority: string): ChipColor => {
    switch (priority) {
      case 'high':
        return 'error';
      case 'medium':
        return 'warning';
      case 'low':
        return 'success';
      default:
        return 'default';
    }
  };

  const getStatusColor = (status: string): ChipColor => {
    switch (status) {
      case 'todo':
        return 'error';
      case 'in_progress':
        return 'warning';
      case 'done':
        return 'success';
      default:
        return 'default';
    }
  };

  if (isLoading) {
    return <Typography>Loading tasks...</Typography>;
  }

  return (
    <Box>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{ mb: 3 }}
      >
        <Typography variant="h4">Internal Tasks</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => {/* TODO: Open create task dialog */}}
        >
          New Task
        </Button>
      </Stack>

      <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
        <TextField
          select
          label="Status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          sx={{ width: 200 }}
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
          sx={{ width: 200 }}
          size="small"
        >
          <MenuItem value="all">All Priority</MenuItem>
          <MenuItem value="high">High</MenuItem>
          <MenuItem value="medium">Medium</MenuItem>
          <MenuItem value="low">Low</MenuItem>
        </TextField>
      </Stack>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
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
              <TableRow key={task.id}>
                <TableCell>{task.title}</TableCell>
                <TableCell>{task.description}</TableCell>
                <TableCell>
                  <Chip
                    label={task.priority}
                    color={getPriorityColor(task.priority)}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <Chip
                    label={task.status}
                    color={getStatusColor(task.status)}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  {task.assignedUser?.name || 'Unassigned'}
                </TableCell>
                <TableCell>
                  <IconButton
                    size="small"
                    onClick={() => handleStatusChange(task, 'in_progress')}
                    disabled={task.status !== 'todo'}
                  >
                    <StartIcon />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => handleStatusChange(task, 'done')}
                    disabled={task.status === 'done'}
                  >
                    <DoneIcon />
                  </IconButton>
                  <IconButton
                    size="small"
                    disabled={task.createdBy !== user?.id && user?.role !== 'admin'}
                  >
                    <EditIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}