import React from 'react';
import {
  Box,
  Paper,
  Typography,
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
  Edit as EditIcon,
  PlayArrow as StartIcon,
  Done as DoneIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Ticket } from '../../types';
import { useAuth } from '../../contexts/AuthContext';

const API_URL = import.meta.env.VITE_API_URL;

type StatusColor = 'error' | 'warning' | 'success' | 'default';

export default function TicketList() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = React.useState('all');
  const [searchQuery, setSearchQuery] = React.useState('');

  const { data: tickets = [], isLoading } = useQuery<Ticket[]>({
    queryKey: ['tickets'],
    queryFn: async () => {
      const response = await axios.get(`${API_URL}/tickets`);
      return response.data;
    },
  });

  const updateTicketMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const response = await axios.patch(`${API_URL}/tickets/${id}`, { status });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
  });

  const handleStatusChange = (ticket: Ticket, newStatus: string) => {
    if (ticket.id) {
      updateTicketMutation.mutate({ id: ticket.id, status: newStatus });
    }
  };

  const filteredTickets = React.useMemo(() => {
    return tickets.filter((ticket) => {
      const matchesStatus =
        statusFilter === 'all' || ticket.status === statusFilter;
      const matchesSearch =
        searchQuery === '' ||
        ticket.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ticket.submitterEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ticket.category.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [tickets, statusFilter, searchQuery]);

  const getStatusColor = (status: string): StatusColor => {
    switch (status) {
      case 'open':
        return 'error';
      case 'in_progress':
        return 'warning';
      case 'resolved':
        return 'success';
      default:
        return 'default';
    }
  };

  const getCategoryLabel = (category: string): string => {
    return category.charAt(0).toUpperCase() + category.slice(1).replace('_', ' ');
  };

  if (isLoading) {
    return <Typography>Loading tickets...</Typography>;
  }

  return (
    <Box>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{ mb: 3 }}
      >
        <Typography variant="h4">Help Desk Tickets</Typography>
      </Stack>

      <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
        <TextField
          label="Search tickets"
          variant="outlined"
          size="small"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          sx={{ width: 300 }}
        />
        <TextField
          select
          label="Status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          size="small"
          sx={{ width: 150 }}
        >
          <MenuItem value="all">All Status</MenuItem>
          <MenuItem value="open">Open</MenuItem>
          <MenuItem value="in_progress">In Progress</MenuItem>
          <MenuItem value="resolved">Resolved</MenuItem>
        </TextField>
      </Stack>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Category</TableCell>
              <TableCell>Description</TableCell>
              <TableCell>Submitter</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Assigned To</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredTickets.map((ticket) => (
              <TableRow key={ticket.id}>
                <TableCell>
                  <Chip
                    label={getCategoryLabel(ticket.category)}
                    size="small"
                  />
                </TableCell>
                <TableCell>{ticket.description}</TableCell>
                <TableCell>{ticket.submitterEmail}</TableCell>
                <TableCell>
                  <Chip
                    label={ticket.status}
                    color={getStatusColor(ticket.status)}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  {ticket.assignedTo ? (
                    <Chip
                      icon={<PersonIcon />}
                      label={user?.id === ticket.assignedTo ? 'You' : 'Assigned'}
                      size="small"
                      color="primary"
                    />
                  ) : (
                    <Chip
                      label="Unassigned"
                      size="small"
                      variant="outlined"
                    />
                  )}
                </TableCell>
                <TableCell>
                  <IconButton
                    size="small"
                    onClick={() => handleStatusChange(ticket, 'in_progress')}
                    disabled={
                      ticket.status === 'in_progress' ||
                      ticket.status === 'resolved'
                    }
                  >
                    <StartIcon />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => handleStatusChange(ticket, 'resolved')}
                    disabled={ticket.status === 'resolved'}
                  >
                    <DoneIcon />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => {/* TODO: Open edit ticket dialog */}}
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