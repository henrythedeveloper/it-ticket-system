import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  Box,
  CircularProgress,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { useTheme } from '../contexts/ThemeContext';
import { Task, User } from '../types';
import { getCommonDialogStyles } from '../contexts/ThemeContext';
import axios from '../utils/axios';

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (task: Partial<Task>) => void;
  task: Task | null;
  currentUser: User;
}

interface TaskFormData {
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  status: 'todo' | 'in_progress' | 'done';
  assignedTo: number | null;
  dueDate: Date | null;
}

const initialFormData: TaskFormData = {
  title: '',
  description: '',
  priority: 'medium',
  status: 'todo',
  assignedTo: null,
  dueDate: null,
};

const TaskDialog: React.FC<Props> = ({
  open,
  onClose,
  onSave,
  task,
  currentUser,
}) => {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [formData, setFormData] = useState<TaskFormData>(initialFormData);

  useEffect(() => {
    if (currentUser?.role === 'admin' || currentUser?.role === 'staff') {
      fetchUsers();
    }
  }, [currentUser]);

  useEffect(() => {
    if (task) {
      setFormData({
        title: task.title,
        description: task.description,
        priority: task.priority,
        status: task.status,
        assignedTo: task.assignedTo ?? null,
        dueDate: task.dueDate ? new Date(task.dueDate) : null,
      });
    } else {
      setFormData(initialFormData);
    }
  }, [task]);

  const fetchUsers = async () => {
    try {
      const response = await axios.get('/api/users');
      setUsers(response.data.data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Convert Date to ISO string before saving
      const submitData: Partial<Task> = {
        title: formData.title,
        description: formData.description,
        priority: formData.priority,
        status: formData.status,
        assignedTo: formData.assignedTo,
        dueDate: formData.dueDate?.toISOString() || null,
      };
      onSave(submitData);
    } catch (error) {
      console.error('Error saving task:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof TaskFormData) => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setFormData({
      ...formData,
      [field]: event.target.value,
    });
  };

  const handleDateChange = (date: Date | null) => {
    setFormData({
      ...formData,
      dueDate: date,
    });
  };

  const canEdit = task ? (currentUser.role === 'admin' || task.createdBy === currentUser.id) : true;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      sx={getCommonDialogStyles(theme)}
    >
      <form onSubmit={handleSubmit}>
        <DialogTitle>
          {task ? 'Edit Task' : 'Create Task'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Title"
              value={formData.title}
              onChange={handleChange('title')}
              required
              fullWidth
              disabled={!canEdit}
            />

            <TextField
              label="Description"
              value={formData.description}
              onChange={handleChange('description')}
              required
              fullWidth
              multiline
              rows={4}
              disabled={!canEdit}
            />

            <TextField
              select
              label="Priority"
              value={formData.priority}
              onChange={handleChange('priority')}
              required
              fullWidth
              disabled={!canEdit}
            >
              <MenuItem value="low">Low</MenuItem>
              <MenuItem value="medium">Medium</MenuItem>
              <MenuItem value="high">High</MenuItem>
            </TextField>

            {task && (
              <TextField
                select
                label="Status"
                value={formData.status}
                onChange={handleChange('status')}
                required
                fullWidth
                disabled={!canEdit}
              >
                <MenuItem value="todo">To Do</MenuItem>
                <MenuItem value="in_progress">In Progress</MenuItem>
                <MenuItem value="done">Done</MenuItem>
              </TextField>
            )}

            <TextField
              select
              label="Assigned To"
              value={formData.assignedTo || ''}
              onChange={handleChange('assignedTo')}
              fullWidth
              disabled={!canEdit}
            >
              <MenuItem value="">Unassigned</MenuItem>
              {users.map((user) => (
                <MenuItem key={user.id} value={user.id}>
                  {user.name}
                </MenuItem>
              ))}
            </TextField>

            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <DatePicker
                label="Due Date"
                value={formData.dueDate}
                onChange={handleDateChange}
                disabled={!canEdit}
                slotProps={{
                  textField: {
                    fullWidth: true,
                  },
                }}
              />
            </LocalizationProvider>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          {canEdit && (
            <Button
              type="submit"
              variant="contained"
              disabled={loading}
              sx={{ opacity: loading ? 0.7 : undefined }}
            >
              {loading ? <CircularProgress size={24} /> : (task ? 'Save Changes' : 'Create Task')}
            </Button>
          )}
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default TaskDialog;