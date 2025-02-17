import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Typography,
  Box,
} from '@mui/material';
import { useTheme } from '../contexts/ThemeContext';
import { TicketHistory } from '../types';
import { getCommonDialogStyles } from '../contexts/ThemeContext';

interface Props {
  open: boolean;
  onClose: () => void;
  history: TicketHistory[];
  ticketNumber: string;
}

const TicketHistoryDialog: React.FC<Props> = ({
  open,
  onClose,
  history,
  ticketNumber,
}) => {
  const { theme } = useTheme();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      sx={getCommonDialogStyles(theme)}
    >
      <DialogTitle>
        <Typography
          variant="h6"
          sx={{ fontSize: theme.typography.medium }}
        >
          History for Ticket #{ticketNumber}
        </Typography>
      </DialogTitle>
      <DialogContent>
        {history.map((entry) => (
          <Box
            key={entry.id}
            sx={{
              mb: 2,
              p: 2,
              borderRadius: theme.borderRadius.sm,
              border: `1px solid ${theme.colors.divider}`,
            }}
          >
            <Typography
              variant="body1"
              sx={{
                mb: 1,
                fontSize: theme.typography.medium,
              }}
            >
              {entry.notes}
            </Typography>
            <Typography
              variant="caption"
              sx={{
                color: theme.colors.secondaryGray,
                fontSize: theme.typography.subtle,
              }}
            >
              {entry.action.replace('_', ' ').toUpperCase()} by{' '}
              {entry.user ? entry.user.name : 'System'} on{' '}
              {new Date(entry.createdAt).toLocaleString()}
            </Typography>
          </Box>
        ))}
        {history.length === 0 && (
          <Typography
            color="textSecondary"
            sx={{
              textAlign: 'center',
              py: 3,
              fontSize: theme.typography.medium,
            }}
          >
            No history available
          </Typography>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default TicketHistoryDialog;