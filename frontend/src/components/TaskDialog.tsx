import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  SelectChangeEvent,
} from '@mui/material';
import { Task, User } from '../types';
import { useQuery } from '@tanstack/react-query';
import api from '../utils/axios';

interface TaskDialogProps {
  open: boolean;
  onClose: () => void;
  task: Task | null;
  onSave: (task: Partial<Task>) => void;
  isNew?: boolean;
  currentUser: User | null;
}

export default function TaskDialog({ open, onClose, task, onSave, isNew, currentUser }: TaskDialogProps) {
  const [editedTask, setEditedTask] = React.useState<Partial<Task>>({
    title: '',
    description: '',
    priority: 'medium',
    status: 'todo',
    assignedTo: undefined,
  });
  const [reassignmentNotes, setReassignmentNotes] = React.useState('');
  const [previousAssignee, setPreviousAssignee] = React.useState<number | undefined>();

  // Fetch users for assignment
  const { data } = useQuery<{ data: User[] }>({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await api.get('/users');
      return response.data;
    },
  });

  const users = data?.data || [];

  React.useEffect(() => {
    if (task && !isNew) {
      setEditedTask({
        id: task.id,
        title: task.title,
        description: task.description,
        priority: task.priority,
        status: task.status,
        assignedTo: task.assignedTo,
      });
      setPreviousAssignee(task.assignedTo);
      setReassignmentNotes('');
    } else {
      setEditedTask({
        title: '',
        description: '',
        priority: 'medium',
        status: 'todo',
        assignedTo: undefined,
      });
    }
  }, [task, isNew]);

  // Handle changes for text fields
  const handleTextChange = (field: keyof Task) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setEditedTask((prev) => ({
      ...prev,
      [field]: event.target.value,
    }));
  };

  // Handle changes for select fields
  const handleSelectChange = (field: keyof Task) => (event: SelectChangeEvent) => {
    setEditedTask((prev) => ({
      ...prev,
      [field]: event.target.value,
    }));
  };

  const handleSave = () => {
    if (!isNew && editedTask.assignedTo !== previousAssignee && !reassignmentNotes) {
      return; // Don't save if reassignment notes are required but missing
    }

    const taskToSave: Partial<Task> = {
      ...editedTask,
    };
    
    if (isNew && currentUser?.id) {
      taskToSave.createdBy = currentUser.id;
    }

    // Include reassignment notes in the API call
    const payload = {
      ...taskToSave,
      reassignmentNotes: editedTask.assignedTo !== previousAssignee ? reassignmentNotes : undefined,
    };

    onSave(payload);
    onClose();
  };

  const canEdit = isNew || (task && (task.createdBy === currentUser?.id || currentUser?.role === 'admin'));

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {isNew ? 'Create New Task' : `Edit Task: ${task?.title}`}
      </DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 1 }}>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Title"
              value={editedTask.title}
              onChange={handleTextChange('title')}
              disabled={!canEdit}
            />
          </Grid>

          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Description"
              multiline
              rows={4}
              value={editedTask.description}
              onChange={handleTextChange('description')}
              disabled={!canEdit}
            />
          </Grid>

          <Grid item xs={12} md={4}>
            <FormControl fullWidth>
              <InputLabel>Priority</InputLabel>
              <Select
                value={editedTask.priority}
                onChange={handleSelectChange('priority')}
                label="Priority"
                disabled={!canEdit}
              >
                <MenuItem value="low">Low</MenuItem>
                <MenuItem value="medium">Medium</MenuItem>
                <MenuItem value="high">High</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={4}>
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                value={editedTask.status}
                onChange={handleSelectChange('status')}
                label="Status"
                disabled={!canEdit}
              >
                <MenuItem value="todo">Todo</MenuItem>
                <MenuItem value="in_progress">In Progress</MenuItem>
                <MenuItem value="done">Done</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={4}>
            <FormControl fullWidth>
              <InputLabel>Assigned To</InputLabel>
              <Select
                value={editedTask.assignedTo?.toString() || ''}
                onChange={(e) => {
                  const newAssignee = e.target.value ? Number(e.target.value) : undefined;
                  if (previousAssignee !== undefined && newAssignee !== previousAssignee) {
                    setReassignmentNotes('');
                  }
                  setEditedTask(prev => ({
                    ...prev,
                    assignedTo: newAssignee
                  }));
                }}
                label="Assigned To"
                disabled={!canEdit}
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

          {!isNew && editedTask.assignedTo !== previousAssignee && (
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Reassignment Notes"
                required
                multiline
                rows={2}
                value={reassignmentNotes}
                onChange={(e) => setReassignmentNotes(e.target.value)}
                helperText="Please explain why you are reassigning this task"
              />
            </Grid>
          )}
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        {canEdit && (
          <Button onClick={handleSave} variant="contained" color="primary">
            {isNew ? 'Create' : 'Save Changes'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}