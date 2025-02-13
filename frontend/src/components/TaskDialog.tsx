import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Box,
  Typography,
  Stack,
  useTheme,
  alpha,
  Collapse,
} from '@mui/material';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { Task, User } from '../types';
import { colors, shadows, chipStyles } from '../styles/common';
import dayjs from 'dayjs';

interface Props {
  open: boolean;
  onClose: () => void;
  task: Task | null;
  onSave: (task: Partial<Task>) => void;
  isNew?: boolean;
  currentUser: User;
}

export default function TaskDialog({ open, onClose, task, onSave, isNew = false, currentUser }: Props) {
  const theme = useTheme();
  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [status, setStatus] = React.useState('todo');
  const [priority, setPriority] = React.useState('medium');
  const [assignedTo, setAssignedTo] = React.useState<number | null>(null);
  const [dueDate, setDueDate] = React.useState<Date | null>(null);
  const [showRecurrence, setShowRecurrence] = React.useState(false);
  const [recurrenceType, setRecurrenceType] = React.useState('none');
  const [recurrenceInterval, setRecurrenceInterval] = React.useState(1);
  const [recurrenceEndDate, setRecurrenceEndDate] = React.useState<Date | null>(null);

  React.useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description);
      setStatus(task.status);
      setPriority(task.priority);
      setAssignedTo(task.assignedTo || null);
      setDueDate(task.dueDate ? new Date(task.dueDate) : null);
      setRecurrenceType(task.recurrenceType || 'none');
      setRecurrenceInterval(task.recurrenceInterval || 1);
      setRecurrenceEndDate(task.recurrenceEndDate ? new Date(task.recurrenceEndDate) : null);
      setShowRecurrence(task.recurrenceType !== 'none');
    } else {
      resetForm();
    }
  }, [task]);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setStatus('todo');
    setPriority('medium');
    setAssignedTo(currentUser.id);
    setDueDate(null);
    setRecurrenceType('none');
    setRecurrenceInterval(1);
    setRecurrenceEndDate(null);
    setShowRecurrence(false);
  };

  const handleSave = () => {
    onSave({
      ...task,
      title,
      description,
      status,
      priority,
      assignedTo,
      dueDate: dueDate?.toISOString(),
      recurrenceType: showRecurrence ? recurrenceType : 'none',
      recurrenceInterval: showRecurrence ? recurrenceInterval : 1,
      recurrenceEndDate: showRecurrence && recurrenceEndDate ? recurrenceEndDate.toISOString() : null,
    });
    onClose();
  };

  const inputStyles = {
    '& .MuiOutlinedInput-root': {
      borderRadius: 2,
      backgroundColor: alpha(theme.palette.background.paper, 0.5),
      backdropFilter: 'blur(8px)',
      transition: 'all 0.2s ease-in-out',
      '&:hover': {
        backgroundColor: alpha(theme.palette.background.paper, 0.7),
        boxShadow: shadows.subtle,
      },
      '&.Mui-focused': {
        backgroundColor: alpha(theme.palette.background.paper, 0.9),
        boxShadow: shadows.medium,
      },
    },
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          backgroundColor: alpha(theme.palette.background.paper, 0.8),
          backdropFilter: 'blur(20px)',
          borderRadius: 3,
          boxShadow: shadows.large,
        }
      }}
    >
      <DialogTitle sx={{ pb: 0 }}>
        {isNew ? 'Create New Task' : 'Edit Task'}
      </DialogTitle>

      <DialogContent>
        <Stack spacing={3} sx={{ mt: 2 }}>
          <TextField
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            fullWidth
            required
            sx={inputStyles}
          />

          <TextField
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            fullWidth
            multiline
            rows={4}
            required
            sx={inputStyles}
          />

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <FormControl fullWidth sx={inputStyles}>
              <InputLabel>Status</InputLabel>
              <Select
                value={status}
                label="Status"
                onChange={(e) => setStatus(e.target.value)}
              >
                <MenuItem value="todo">Todo</MenuItem>
                <MenuItem value="in_progress">In Progress</MenuItem>
                <MenuItem value="done">Done</MenuItem>
              </Select>
            </FormControl>

            <FormControl fullWidth sx={inputStyles}>
              <InputLabel>Priority</InputLabel>
              <Select
                value={priority}
                label="Priority"
                onChange={(e) => setPriority(e.target.value)}
              >
                <MenuItem value="low">Low</MenuItem>
                <MenuItem value="medium">Medium</MenuItem>
                <MenuItem value="high">High</MenuItem>
              </Select>
            </FormControl>
          </Stack>

          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <DateTimePicker
              label="Due Date"
              value={dueDate ? dayjs(dueDate) : null}
              onChange={(newValue) => setDueDate(newValue ? newValue.toDate() : null)}
              slotProps={{
                textField: {
                  fullWidth: true,
                  sx: inputStyles,
                },
              }}
            />
          </LocalizationProvider>

          <Box>
            <Button
              variant="outlined"
              onClick={() => setShowRecurrence(!showRecurrence)}
              sx={{
                ...chipStyles,
                color: showRecurrence ? colors.primaryBlue : theme.palette.text.secondary,
                borderColor: showRecurrence ? colors.primaryBlue : theme.palette.divider,
                '&:hover': {
                  borderColor: colors.primaryBlue,
                },
              }}
            >
              {showRecurrence ? 'Hide Recurrence Options' : 'Show Recurrence Options'}
            </Button>
          </Box>

          <Collapse in={showRecurrence}>
            <Stack spacing={2}>
              <Typography variant="subtitle2" color="textSecondary">
                Recurrence Settings
              </Typography>

              <FormControl fullWidth sx={inputStyles}>
                <InputLabel>Repeat</InputLabel>
                <Select
                  value={recurrenceType}
                  label="Repeat"
                  onChange={(e) => setRecurrenceType(e.target.value)}
                >
                  <MenuItem value="none">Never</MenuItem>
                  <MenuItem value="daily">Daily</MenuItem>
                  <MenuItem value="weekly">Weekly</MenuItem>
                  <MenuItem value="monthly">Monthly</MenuItem>
                  <MenuItem value="yearly">Yearly</MenuItem>
                </Select>
              </FormControl>

              {recurrenceType !== 'none' && (
                <>
                  <TextField
                    label="Every"
                    type="number"
                    value={recurrenceInterval}
                    onChange={(e) => setRecurrenceInterval(parseInt(e.target.value) || 1)}
                    InputProps={{
                      inputProps: { min: 1 },
                    }}
                    sx={inputStyles}
                    helperText={`Repeat every ${recurrenceInterval} ${recurrenceType.slice(0, -2)}(s)`}
                  />

                  <LocalizationProvider dateAdapter={AdapterDayjs}>
                    <DateTimePicker
                      label="End Date (Optional)"
                      value={recurrenceEndDate ? dayjs(recurrenceEndDate) : null}
                      onChange={(newValue) => setRecurrenceEndDate(newValue ? newValue.toDate() : null)}
                      slotProps={{
                        textField: {
                          fullWidth: true,
                          sx: inputStyles,
                        },
                      }}
                    />
                  </LocalizationProvider>
                </>
              )}
            </Stack>
          </Collapse>
        </Stack>
      </DialogContent>

      <DialogActions sx={{ p: 3 }}>
        <Button 
          onClick={onClose}
          sx={{
            ...chipStyles,
            color: theme.palette.text.secondary,
            '&:hover': {
              backgroundColor: alpha(theme.palette.text.secondary, 0.1),
            },
          }}
        >
          Cancel
        </Button>
        <Button 
          onClick={handleSave}
          variant="contained"
          disabled={!title || !description}
          sx={{
            ...chipStyles,
            backgroundColor: colors.primaryBlue,
            color: 'white',
            '&:hover': {
              backgroundColor: alpha(colors.primaryBlue, 0.9),
            },
          }}
        >
          {isNew ? 'Create' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}