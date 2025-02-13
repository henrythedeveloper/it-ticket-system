import React, { useState } from 'react';
import {
  Box,
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
  Button,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Edit as EditIcon,
  PlayArrow as StartIcon,
  Done as DoneIcon,
  Person as PersonIcon,
  History as HistoryIcon,
  Download as DownloadIcon,
  CalendarToday as CalendarTodayIcon,
  ArrowForward as ArrowForwardIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ticket } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import api from '../../utils/axios';
import TicketDialog from '../../components/TicketDialog';
import SubmitterTicketsDialog from '../../components/SubmitterTicketsDialog';
import TicketHistoryDialog from '../../components/TicketHistoryDialog';
import { 
  colors, 
  shadows, 
  chipStyles, 
  sectionTitleStyles 
} from '../../styles/common';

// Helper functions
const getStatusColor = (status: string): string => {
  switch (status) {
    case 'open':
      return colors.errorRed;
    case 'in_progress':
      return colors.warningYellow;
    case 'resolved':
      return colors.successGreen;
    default:
      return colors.secondaryGray;
  }
};

const getUrgencyColor = (urgency: string): string => {
  switch (urgency) {
    case 'critical':
      return colors.errorRed;
    case 'high':
      return colors.warningYellow;
    case 'low':
      return colors.successGreen;
    default:
      return colors.secondaryGray;
  }
};

const getCategoryLabel = (category: string): string => {
  return category.charAt(0).toUpperCase() + category.slice(1).replace('_', ' ');
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

// Due Items Section Component
const DueItemsSection = ({ 
  title, 
  tickets, 
  icon: Icon, 
  color,
  onTicketClick,
}: { 
  title: string;
  tickets: Ticket[];
  icon: React.ElementType;
  color: string;
  onTicketClick: (ticket: Ticket) => void;
}) => {
  const theme = useTheme();
  
  if (tickets.length === 0) return null;

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
          {tickets.length} {tickets.length === 1 ? 'ticket' : 'tickets'}
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
              <TableCell>Ticket #</TableCell>
              <TableCell>Category</TableCell>
              <TableCell>Description</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Urgency</TableCell>
              <TableCell>Due</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {tickets.map((ticket) => (
              <TableRow 
                key={ticket.id}
                onClick={() => onTicketClick(ticket)}
                sx={{
                  cursor: 'pointer',
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': { 
                    backgroundColor: alpha(theme.palette.action.hover, 0.7),
                    transform: 'translateX(6px)',
                  },
                }}
              >
                <TableCell>
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      fontFamily: 'monospace',
                      fontWeight: 600,
                      color: colors.primaryBlue,
                    }}
                  >
                    {ticket.ticketNumber || '-'}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip
                    label={getCategoryLabel(ticket.category)}
                    size="small"
                    sx={{
                      ...chipStyles,
                      backgroundColor: alpha(colors.primaryBlue, 0.1),
                      color: colors.primaryBlue,
                      textTransform: 'capitalize',
                    }}
                  />
                </TableCell>
                <TableCell>
                  <Typography 
                    sx={{ 
                      color: theme.palette.text.primary,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: 300,
                    }}
                  >
                    {ticket.description}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip
                    label={ticket.status}
                    size="small"
                    sx={{
                      ...chipStyles,
                      backgroundColor: alpha(getStatusColor(ticket.status), 0.1),
                      color: getStatusColor(ticket.status),
                      textTransform: 'capitalize',
                    }}
                  />
                </TableCell>
                <TableCell>
                  <Chip
                    label={ticket.urgency}
                    size="small"
                    sx={{
                      ...chipStyles,
                      backgroundColor: alpha(getUrgencyColor(ticket.urgency), 0.1),
                      color: getUrgencyColor(ticket.urgency),
                      textTransform: 'capitalize',
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
                    {formatDueDate(ticket.dueDate)}
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

export default function TicketList() {
  const theme = useTheme();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitterDialogOpen, setSubmitterDialogOpen] = useState(false);
  const [selectedSubmitterEmail, setSelectedSubmitterEmail] = useState('');
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);

  // Get today's date at midnight for comparison
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const { data: tickets, isLoading } = useQuery<{ data: Ticket[] }>({
    queryKey: ['tickets'],
    queryFn: async () => {
      const response = await api.get('/tickets');
      return response.data;
    },
  });

  const updateTicketMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const response = await api.patch(`/tickets/${id}`, { status });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
  });

  const handleStatusChange = (ticket: Ticket, status: string) => {
    if (ticket.id) {
      updateTicketMutation.mutate({ id: ticket.id, status });
    }
  };

  const handleSaveTicket = (updatedTicket: Partial<Ticket>) => {
    if (!selectedTicket?.id) return;
    updateTicketMutation.mutate({ 
      id: selectedTicket.id, 
      status: updatedTicket.status || selectedTicket.status 
    });
    setDialogOpen(false);
  };

  const handleExportTickets = async (format: 'csv' | 'pdf') => {
    try {
      const response = await api.get(`/tickets/export?format=${format}`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `tickets-export.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error(`Error exporting tickets as ${format}:`, error);
    }
  };

  const filteredTickets = React.useMemo(() => {
    if (!Array.isArray(tickets?.data)) return [];
    return tickets.data.filter((ticket) => {
      if (!ticket) return false;
      const matchesStatus = statusFilter === 'all' || ticket.status === statusFilter;
      const matchesSearch =
        searchQuery === '' ||
        ticket.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ticket.submitterEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ticket.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (ticket.ticketNumber && ticket.ticketNumber.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesStatus && matchesSearch;
    });
  }, [tickets, statusFilter, searchQuery]);

  const dueTodayTickets = filteredTickets.filter(ticket => 
    ticket.dueDate && new Date(ticket.dueDate).getDate() === today.getDate()
  );

  const dueTomorrowTickets = filteredTickets.filter(ticket => 
    ticket.dueDate && new Date(ticket.dueDate).getDate() === tomorrow.getDate()
  );

  const handleTicketClick = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setDialogOpen(true);
  };

  if (isLoading) {
    return (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: 200,
      }}>
        <Typography 
          sx={{ 
            color: theme.palette.text.secondary,
            fontWeight: 500,
          }}
        >
          Loading tickets...
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ mb: 4 }}
      >
        <Typography sx={sectionTitleStyles}>
          Help Desk Tickets
        </Typography>
        {user?.role === 'admin' && (
          <Stack direction="row" spacing={1}>
            <Button
              startIcon={<DownloadIcon />}
              onClick={() => handleExportTickets('csv')}
              sx={{
                ...chipStyles,
                backgroundColor: alpha(colors.primaryBlue, 0.1),
                color: colors.primaryBlue,
                '&:hover': {
                  backgroundColor: alpha(colors.primaryBlue, 0.2),
                },
              }}
            >
              Export CSV
            </Button>
            <Button
              startIcon={<DownloadIcon />}
              onClick={() => handleExportTickets('pdf')}
              sx={{
                ...chipStyles,
                backgroundColor: alpha(colors.successGreen, 0.1),
                color: colors.successGreen,
                '&:hover': {
                  backgroundColor: alpha(colors.successGreen, 0.2),
                },
              }}
            >
              Export PDF
            </Button>
          </Stack>
        )}
      </Stack>

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        sx={{
          mb: 3,
          p: 3,
          backgroundColor: alpha(theme.palette.background.paper, 0.6),
          backdropFilter: 'blur(10px)',
          borderRadius: 2,
          boxShadow: shadows.subtle,
        }}
      >
        <TextField
          label="Search tickets"
          variant="outlined"
          size="small"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          sx={{
            width: { xs: '100%', sm: 300 },
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
        />
        <TextField
          select
          label="Status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          size="small"
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
        >
          <MenuItem value="all">All Status</MenuItem>
          <MenuItem value="open">Open</MenuItem>
          <MenuItem value="in_progress">In Progress</MenuItem>
          <MenuItem value="resolved">Resolved</MenuItem>
        </TextField>
      </Stack>

      <DueItemsSection 
        title="Due Today"
        tickets={dueTodayTickets}
        icon={CalendarTodayIcon}
        color={colors.warningYellow}
        onTicketClick={handleTicketClick}
      />

      <DueItemsSection 
        title="Due Tomorrow"
        tickets={dueTomorrowTickets}
        icon={ArrowForwardIcon}
        color={colors.primaryBlue}
        onTicketClick={handleTicketClick}
      />

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
        <Table stickyHeader>
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
              <TableCell>Ticket #</TableCell>
              <TableCell>Category</TableCell>
              <TableCell>Description</TableCell>
              <TableCell>Submitter</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Urgency</TableCell>
              <TableCell>Due</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredTickets.map((ticket) => (
              <TableRow
                key={ticket.id}
                sx={{
                  cursor: 'pointer',
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': { 
                    backgroundColor: alpha(theme.palette.action.hover, 0.7),
                    transform: 'translateX(6px)',
                  },
                }}
              >
                <TableCell>{ticket.ticketNumber}</TableCell>
                <TableCell>
                  <Chip
                    label={getCategoryLabel(ticket.category)}
                    size="small"
                    sx={{
                      ...chipStyles,
                      backgroundColor: alpha(colors.primaryBlue, 0.1),
                      color: colors.primaryBlue,
                      textTransform: 'capitalize',
                    }}
                  />
                </TableCell>
                <TableCell>
                  <Typography
                    sx={{
                      display: '-webkit-box',
                      WebkitBoxOrient: 'vertical',
                      WebkitLineClamp: 2,
                      overflow: 'hidden',
                      lineHeight: 1.5,
                    }}
                  >
                    {ticket.description}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Button
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedSubmitterEmail(ticket.submitterEmail);
                      setSubmitterDialogOpen(true);
                    }}
                    sx={{
                      ...chipStyles,
                      backgroundColor: alpha(colors.primaryBlue, 0.1),
                      color: colors.primaryBlue,
                      '&:hover': {
                        backgroundColor: alpha(colors.primaryBlue, 0.2),
                      },
                    }}
                    endIcon={<PersonIcon />}
                  >
                    {ticket.submitterEmail}
                  </Button>
                </TableCell>
                <TableCell>
                  <Chip
                    label={ticket.status}
                    size="small"
                    sx={{
                      ...chipStyles,
                      backgroundColor: alpha(getStatusColor(ticket.status), 0.1),
                      color: getStatusColor(ticket.status),
                      textTransform: 'capitalize',
                    }}
                  />
                </TableCell>
                <TableCell>
                  <Chip
                    label={ticket.urgency}
                    size="small"
                    sx={{
                      ...chipStyles,
                      backgroundColor: alpha(getUrgencyColor(ticket.urgency), 0.1),
                      color: getUrgencyColor(ticket.urgency),
                      textTransform: 'capitalize',
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
                    {formatDueDate(ticket.dueDate)}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Stack direction="row" spacing={1}>
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStatusChange(ticket, 'in_progress');
                      }}
                      disabled={ticket.status === 'in_progress' || ticket.status === 'resolved'}
                      sx={{
                        ...chipStyles,
                        backgroundColor: alpha(colors.warningYellow, 0.1),
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
                        handleStatusChange(ticket, 'resolved');
                      }}
                      disabled={ticket.status === 'resolved'}
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
                        setSelectedTicket(ticket);
                        setHistoryDialogOpen(true);
                      }}
                      sx={{
                        ...chipStyles,
                        backgroundColor: alpha(colors.secondaryGray, 0.1),
                        color: colors.secondaryGray,
                        '&:hover': {
                          backgroundColor: alpha(colors.secondaryGray, 0.2),
                        },
                      }}
                    >
                      <HistoryIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedTicket(ticket);
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
            {filteredTickets.length === 0 && (
              <TableRow>
                <TableCell colSpan={8}>
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
                      No tickets found
                    </Typography>
                  </Box>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <TicketDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        ticket={selectedTicket}
        onSave={handleSaveTicket}
      />
      
      <SubmitterTicketsDialog
        open={submitterDialogOpen}
        onClose={() => setSubmitterDialogOpen(false)}
        email={selectedSubmitterEmail}
        onTicketClick={(ticket: Ticket) => {
          setSelectedTicket(ticket);
          setDialogOpen(true);
          setSubmitterDialogOpen(false);
        }}
      />

      {selectedTicket && (
        <TicketHistoryDialog
          open={historyDialogOpen}
          onClose={() => setHistoryDialogOpen(false)}
          ticketId={selectedTicket.id!}
        />
      )}
    </Box>
  );
}