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
  Tab,
  Tabs,
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  Paper,
} from '@mui/material';
import { Task, User, TaskHistory } from '../types';
import { useQuery } from '@tanstack/react-query';
import api from '../utils/axios';
import { format } from 'date-fns';

interface TaskDialogProps {
  open: boolean;
  onClose: () => void;
  task: Task | null;
  onSave: (task: Partial<Task>) => void;
  isNew?: boolean;
  currentUser: User | null;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`task-tabpanel-${index}`}
      aria-labelledby={`task-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

interface TaskFormData extends Omit<Partial<Task>, 'assignedTo'> {
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  status: 'todo' | 'in_progress' | 'done';
  assignedTo: number | null;
}

export default function TaskDialog({ open, onClose, task, onSave, isNew, currentUser }: TaskDialogProps) {
  const [editedTask, setEditedTask] = React.useState<TaskFormData>({
    title: '',
    description: '',
    priority: 'medium',
    status: 'todo',
    assignedTo: null,
  });
  const [reassignmentNotes, setReassignmentNotes] = React.useState('');
  const [previousAssignee, setPreviousAssignee] = React.useState<number | null>(null);
  const [tabValue, setTabValue] = React.useState(0);

  // Fetch users for assignment
  const { data: usersData } = useQuery<{ data: User[] }>({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await api.get('/users');
      return response.data;
    },
  });

  // Fetch task history if task exists
  const { data: historyData } = useQuery<{ data: TaskHistory[] }>({
    queryKey: ['taskHistory', task?.id],
    queryFn: async () => {
      if (!task?.id) return { data: [] };
      const response = await api.get(`/tasks/${task.id}/history`);
      return response.data;
    },
    enabled: !!task?.id && !isNew,
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  const users = usersData?.data || [];
  const history = historyData?.data || [];

  React.useEffect(() => {
    if (task && !isNew) {
      setEditedTask({
        ...task,
        assignedTo: task.assignedTo ?? null,
      });
      setPreviousAssignee(task.assignedTo ?? null);
      setReassignmentNotes('');
    } else {
      setEditedTask({
        title: '',
        description: '',
        priority: 'medium',
        status: 'todo',
        assignedTo: null,
      });
    }
  }, [task, isNew]);

  const handleTextChange = (field: keyof TaskFormData) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setEditedTask((prev) => ({
      ...prev,
      [field]: event.target.value,
    }));
  };

  const handleSelectChange = (field: keyof TaskFormData) => (event: SelectChangeEvent<string>) => {
    const value = event.target.value;
    setEditedTask((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleSave = () => {
    if (!isNew && editedTask.assignedTo !== previousAssignee && !reassignmentNotes) {
      return; // Don't save if reassignment notes are required but missing
    }

    const taskToSave: Partial<Task> = {
      ...editedTask,
      assignedTo: editedTask.assignedTo,
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

  const canEdit = isNew || task;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {isNew ? 'Create New Task' : `Edit Task: ${task?.title}`}
      </DialogTitle>
      <DialogContent>
        {!isNew && (
          <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
            <Tabs value={tabValue} onChange={handleTabChange}>
              <Tab label="Details" />
              <Tab label="History" />
            </Tabs>
          </Box>
        )}

        <TabPanel value={tabValue} index={0}>
          <Grid container spacing={2}>
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
                maxRows={8}
                value={editedTask.description}
                onChange={handleTextChange('description')}
                disabled={!canEdit}
                sx={{
                  '& .MuiInputBase-root': {
                    maxHeight: '200px',
                    overflow: 'auto'
                  }
                }}
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
                  value={editedTask.assignedTo?.toString() ?? ''}
                  onChange={(e: SelectChangeEvent<string>) => {
                    const newAssignee = e.target.value ? Number(e.target.value) : null;
                    setEditedTask(prev => ({
                      ...prev,
                      assignedTo: newAssignee
                    }));
                    if (previousAssignee !== newAssignee) {
                      setReassignmentNotes('');
                    }
                  }}
                  label="Assigned To"
                  disabled={!canEdit}
                >
                  <MenuItem value="">Unassigned</MenuItem>
                  {users
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((user) => (
                      <MenuItem key={user.id} value={user.id?.toString() ?? ''}>
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
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <Paper 
            variant="outlined" 
            sx={{ 
              maxHeight: '400px',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
              <Typography variant="h6">History</Typography>
            </Box>
            <List sx={{ 
              flex: 1, 
              overflow: 'auto',
              p: 0,
              '& .MuiListItem-root': {
                borderBottom: '1px solid',
                borderColor: 'divider',
                '&:last-child': {
                  borderBottom: 'none'
                }
              }
            }}>
              {history?.map((entry) => (
                <ListItem key={entry.id}>
                  <ListItemText
                    primary={entry.notes}
                    secondary={
                      <>
                        <Typography component="span" variant="body2" color="textSecondary">
                          {entry.user?.name} - {format(new Date(entry.createdAt), 'MMM d, yyyy h:mm a')}
                        </Typography>
                      </>
                    }
                  />
                </ListItem>
              ))}
              {history.length === 0 && (
                <ListItem>
                  <ListItemText
                    primary={<Typography color="textSecondary">No history available</Typography>}
                  />
                </ListItem>
              )}
            </List>
          </Paper>
        </TabPanel>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        {canEdit && tabValue === 0 && (
          <Button 
            onClick={handleSave} 
            variant="contained" 
            color="primary"
            disabled={!editedTask.title || !editedTask.description}
          >
            {isNew ? 'Create' : 'Save Changes'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}