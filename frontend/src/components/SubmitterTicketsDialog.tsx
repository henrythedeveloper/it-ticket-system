import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Box,
  Typography,
  Chip,
  DialogActions,
  Button,
  useTheme,
  alpha,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { Ticket } from '../types';
import api from '../utils/axios';
import { 
  colors, 
  shadows, 
  chipStyles, 
  sectionTitleStyles,
} from '../styles/common';

interface SubmitterTicketsDialogProps {
  open: boolean;
  onClose: () => void;
  email: string;
  onTicketClick: (ticket: Ticket) => void;
}

export default function SubmitterTicketsDialog({
  open,
  onClose,
  email,
  onTicketClick,
}: SubmitterTicketsDialogProps) {
  const theme = useTheme();
  
  const { data: tickets } = useQuery<{ data: Ticket[] }>({
    queryKey: ['tickets', 'submitter', email],
    queryFn: async () => {
      const response = await api.get('/tickets', {
        params: { submitterEmail: email }
      });
      return response.data;
    },
    enabled: open
  });

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

  const getStatusColor = (status: string) => {
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

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        elevation: 0,
        sx: {
          borderRadius: 3,
          backgroundColor: theme.palette.background.default,
          boxShadow: shadows.strong,
        }
      }}
    >
      <DialogTitle sx={{ p: 3, pb: 2 }}>
        <Box 
          sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between' 
          }}
        >
          <Typography sx={sectionTitleStyles}>
            Tickets from {email}
          </Typography>
          <IconButton 
            onClick={onClose} 
            size="small"
            sx={{
              ...chipStyles,
              backgroundColor: alpha(theme.palette.text.primary, 0.1),
              '&:hover': {
                backgroundColor: alpha(theme.palette.text.primary, 0.2),
              }
            }}
          >
            <CloseIcon sx={{ color: theme.palette.text.primary }} />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent sx={{ px: 3 }}>
        <TableContainer
          sx={{
            mt: 2,
            backgroundColor: theme.palette.background.paper,
            borderRadius: 2,
            boxShadow: shadows.subtle,
            overflow: 'hidden',
            '& .MuiTableCell-root': {
              borderColor: theme.palette.divider,
            },
          }}
        >
          <Table size="small">
            <TableHead>
              <TableRow
                sx={{
                  backgroundColor: alpha(theme.palette.background.paper, 0.6),
                  backdropFilter: 'blur(8px)',
                }}
              >
                <TableCell sx={{ fontWeight: 600 }}>Ticket #</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Description</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Due Date</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {tickets?.data.map((ticket) => (
                <TableRow
                  key={ticket.id}
                  onClick={() => onTicketClick(ticket)}
                  sx={{
                    cursor: 'pointer',
                    transition: 'all 0.2s ease-in-out',
                    '&:hover': { 
                      backgroundColor: alpha(theme.palette.action.hover, 0.7),
                      transform: 'translateX(4px)',
                    }
                  }}
                >
                  <TableCell>
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        fontFamily: 'monospace',
                        fontWeight: 500,
                        color: colors.primaryBlue,
                      }}
                    >
                      {ticket.ticketNumber}
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
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography
                      sx={{
                        color: theme.palette.text.primary,
                        fontWeight: 400,
                      }}
                    >
                      {ticket.description.length > 50
                        ? `${ticket.description.slice(0, 50)}...`
                        : ticket.description}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography
                      sx={{
                        color: theme.palette.text.secondary,
                        fontSize: '0.875rem',
                      }}
                    >
                      {formatDueDate(ticket.dueDate)}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
              {(!tickets?.data || tickets.data.length === 0) && (
                <TableRow>
                  <TableCell colSpan={4}>
                    <Typography 
                      align="center" 
                      sx={{ 
                        py: 4,
                        color: theme.palette.text.secondary,
                      }}
                    >
                      No tickets found for this email address
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </DialogContent>
      <DialogActions sx={{ p: 3, pt: 2 }}>
        <Button 
          onClick={onClose}
          sx={{
            ...chipStyles,
            color: theme.palette.text.primary,
            '&:hover': {
              backgroundColor: alpha(theme.palette.text.primary, 0.1),
            }
          }}
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}