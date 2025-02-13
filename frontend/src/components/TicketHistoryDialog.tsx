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
  Typography,
  Box,
  DialogActions,
  Button,
  useTheme,
  alpha,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import api from '../utils/axios';
import {
  colors,
  shadows,
  chipStyles,
  sectionTitleStyles,
} from '../styles/common';

interface TicketHistory {
  id: number;
  action: string;
  notes: string;
  created_at: string;
  user: {
    name: string;
    email: string;
  };
}

interface TicketHistoryDialogProps {
  open: boolean;
  onClose: () => void;
  ticketId: number;
}

export default function TicketHistoryDialog({
  open,
  onClose,
  ticketId,
}: TicketHistoryDialogProps) {
  const theme = useTheme();

  const { data: history } = useQuery<{ data: TicketHistory[] }>({
    queryKey: ['ticket-history', ticketId],
    queryFn: async () => {
      const response = await api.get(`/tickets/${ticketId}/history`);
      return response.data;
    },
    enabled: open && ticketId > 0
  });

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getActionColor = (action: string) => {
    switch (action.toLowerCase()) {
      case 'created':
        return colors.successGreen;
      case 'updated':
        return colors.primaryBlue;
      case 'assigned':
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
            Ticket History
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
                <TableCell sx={{ fontWeight: 600 }}>Date</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Action</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>User</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Notes</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {history?.data.map((entry) => (
                <TableRow 
                  key={entry.id}
                  sx={{
                    transition: 'background-color 0.2s ease-in-out',
                    '&:hover': {
                      backgroundColor: alpha(theme.palette.action.hover, 0.7),
                    },
                  }}
                >
                  <TableCell>
                    <Typography
                      variant="body2"
                      sx={{
                        color: theme.palette.text.secondary,
                        fontSize: '0.875rem',
                      }}
                    >
                      {formatDate(entry.created_at)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography
                      variant="body2"
                      sx={{
                        textTransform: 'capitalize',
                        fontWeight: 500,
                        color: getActionColor(entry.action),
                        display: 'inline-block',
                        px: 1,
                        py: 0.5,
                        borderRadius: 1,
                        backgroundColor: alpha(getActionColor(entry.action), 0.1),
                      }}
                    >
                      {entry.action.replace(/_/g, ' ')}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography 
                      variant="body2"
                      sx={{ 
                        fontWeight: 500,
                        color: theme.palette.text.primary,
                      }}
                    >
                      {entry.user.name}
                    </Typography>
                    <Typography 
                      variant="caption" 
                      sx={{ 
                        color: theme.palette.text.secondary,
                        display: 'block',
                      }}
                    >
                      {entry.user.email}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography sx={{ color: theme.palette.text.primary }}>
                      {entry.notes}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
              {(!history?.data || history.data.length === 0) && (
                <TableRow>
                  <TableCell colSpan={4}>
                    <Typography 
                      align="center" 
                      sx={{ 
                        py: 4,
                        color: theme.palette.text.secondary,
                      }}
                    >
                      No history available for this ticket
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