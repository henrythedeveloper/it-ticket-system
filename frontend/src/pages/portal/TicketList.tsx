import React from 'react';
import {
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
  Box,
} from '@mui/material';
import {
  Edit as EditIcon,
  PlayArrow as StartIcon,
  Done as DoneIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ticket } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../utils/axios';
import PageContainer from '../../components/layout/PageContainer';
import TicketDialog from '../../components/TicketDialog';

type StatusColor = 'error' | 'warning' | 'success' | 'default';

export default function TicketList() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = React.useState('all');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedTicket, setSelectedTicket] = React.useState<Ticket | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [expandedTicketId, setExpandedTicketId] = React.useState<number | null>(null);

  const truncateDescription = (text: string, maxLength: number = 50) => {
    if (text.length <= maxLength) return text;
    return `${text.slice(0, maxLength)}...`;
  };

  const { data, isLoading } = useQuery<{ data: Ticket[] }>({
    queryKey: ['tickets'],
    queryFn: async () => {
      const response = await api.get('/tickets');
      return response.data;
    },
  });

  const tickets = data?.data || [];

  const updateTicketMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const response = await api.patch(`/tickets/${id}`, { status });
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
    if (!Array.isArray(tickets)) return [];
    return tickets.filter((ticket) => {
      const matchesStatus =
        statusFilter === 'all' || ticket.status === statusFilter;
      const matchesSearch =
        searchQuery === '' ||
        ticket.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ticket.submitterEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ticket.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (ticket.ticketNumber && ticket.ticketNumber.toLowerCase().includes(searchQuery.toLowerCase()));
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

  const updateTicketDetailsMutation = useMutation({
    mutationFn: async (updatedTicket: Partial<Ticket>) => {
      if (!selectedTicket?.id) return;
      const response = await api.patch(`/tickets/${selectedTicket.id}`, updatedTicket);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
  });

  const handleSaveTicket = (updatedTicket: Partial<Ticket>) => {
    updateTicketDetailsMutation.mutate(updatedTicket);
  };

  if (isLoading) {
    return <Typography>Loading tickets...</Typography>;
  }

  return (
    <PageContainer>
      <TicketDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        ticket={selectedTicket}
        onSave={handleSaveTicket}
        isAdmin={user?.role === 'admin'}
      />
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

      <TableContainer sx={{ maxHeight: 'calc(100vh - 300px)' }}>
        <Table stickyHeader sx={{ tableLayout: 'fixed' }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: '12%' }}>Ticket #</TableCell>
              <TableCell sx={{ width: '10%' }}>Category</TableCell>
              <TableCell sx={{ width: '30%' }}>Description</TableCell>
              <TableCell sx={{ width: '15%' }}>Submitter</TableCell>
              <TableCell sx={{ width: '10%' }}>Status</TableCell>
              <TableCell sx={{ width: '13%' }}>Assigned To</TableCell>
              <TableCell sx={{ width: '10%' }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredTickets.map((ticket) => (
              <TableRow
                key={ticket.id}
                onClick={() => {
                  setSelectedTicket(ticket);
                  setDialogOpen(true);
                }}
                sx={{ cursor: 'pointer', '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.04)' } }}
              >
                <TableCell>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                    {ticket.ticketNumber || '-'}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip
                    label={getCategoryLabel(ticket.category)}
                    size="small"
                  />
                </TableCell>
                <TableCell
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpandedTicketId(expandedTicketId === ticket.id ? null : ticket.id || null);
                  }}
                  sx={{
                    cursor: 'pointer',
                    '&:hover': {
                      backgroundColor: 'rgba(0, 0, 0, 0.04)',
                      textDecoration: 'underline'
                    }
                  }}
                >
                  {expandedTicketId === ticket.id ? ticket.description : truncateDescription(ticket.description)}
                </TableCell>
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
                  <Box onClick={(e) => e.stopPropagation()}>
                    <IconButton
                      size="small"
                      onClick={() => handleStatusChange(ticket, 'in_progress')}
                      disabled={ticket.status === 'in_progress' || ticket.status === 'resolved'}
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
                      onClick={() => {
                        setSelectedTicket(ticket);
                        setDialogOpen(true);
                      }}
                    >
                      <EditIcon />
                    </IconButton>
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {user && (
        <>
          <Typography variant="h5" sx={{ mt: 4, mb: 2 }}>
            Tickets Assigned to You
          </Typography>
          <TableContainer sx={{ maxHeight: 'calc(100vh - 300px)' }}>
            <Table stickyHeader sx={{ tableLayout: 'fixed' }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: '12%' }}>Ticket #</TableCell>
                  <TableCell sx={{ width: '10%' }}>Category</TableCell>
                  <TableCell sx={{ width: '30%' }}>Description</TableCell>
                  <TableCell sx={{ width: '15%' }}>Submitter</TableCell>
                  <TableCell sx={{ width: '10%' }}>Status</TableCell>
                  <TableCell sx={{ width: '23%' }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredTickets
                  .filter(ticket => ticket.assignedTo === user.id)
                  .map((ticket) => (
                    <TableRow
                      key={ticket.id}
                      onClick={() => {
                        setSelectedTicket(ticket);
                        setDialogOpen(true);
                      }}
                      sx={(theme) => ({
                        cursor: 'pointer',
                        backgroundColor: theme.palette.mode === 'light' ? 'primary.light' : 'primary.dark',
                        '&:hover': {
                          backgroundColor: theme.palette.primary.main,
                          '& .MuiTypography-root': { 
                            color: theme.palette.primary.contrastText 
                          },
                          '& .MuiChip-root': { 
                            backgroundColor: theme.palette.background.paper,
                            color: theme.palette.text.primary
                          },
                          '& .MuiIconButton-root': {
                            color: theme.palette.primary.contrastText
                          }
                        }
                      })}
                    >
                      <TableCell>
                        <Typography 
                          variant="body2" 
                          sx={(theme) => ({
                            fontFamily: 'monospace',
                            color: theme.palette.primary.contrastText
                          })}
                        >
                          {ticket.ticketNumber || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={getCategoryLabel(ticket.category)}
                          size="small"
                          sx={{ backgroundColor: 'white' }}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography sx={(theme) => ({ color: theme.palette.primary.contrastText })}>
                          {ticket.description.length > 50
                            ? `${ticket.description.slice(0, 50)}...`
                            : ticket.description}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography sx={(theme) => ({ color: theme.palette.primary.contrastText })}>
                          {ticket.submitterEmail}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={ticket.status}
                          color={getStatusColor(ticket.status)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Box onClick={(e) => e.stopPropagation()}>
                          <IconButton
                            size="small"
                            onClick={() => handleStatusChange(ticket, 'in_progress')}
                            disabled={ticket.status === 'in_progress' || ticket.status === 'resolved'}
                            sx={{ color: 'white' }}
                          >
                            <StartIcon />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => handleStatusChange(ticket, 'resolved')}
                            disabled={ticket.status === 'resolved'}
                            sx={{ color: 'white' }}
                          >
                            <DoneIcon />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => {
                              setSelectedTicket(ticket);
                              setDialogOpen(true);
                            }}
                            sx={{ color: 'white' }}
                          >
                            <EditIcon />
                          </IconButton>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}
    </PageContainer>
  );
}