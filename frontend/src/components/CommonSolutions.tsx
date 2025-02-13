import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  Stack,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Button,
  alpha,
  useTheme,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Add as AddIcon,
  Check as CheckIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { Solution } from '../types';
import api from '../utils/axios';
import { colors, shadows, chipStyles } from '../styles/common';

interface CommonSolutionsProps {
  category?: string;
  email?: string;
  onApplySolution?: (solution: Solution) => void;
  appliedSolutionId?: number | null;
}

export default function CommonSolutions({ 
  category, 
  email,
  onApplySolution,
  appliedSolutionId
}: CommonSolutionsProps) {
  const theme = useTheme();

  const { data: solutions, isLoading } = useQuery<{ data: Solution[] }>({
    queryKey: ['solutions', category, email],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (category) params.append('category', category);
      if (email) params.append('email', email);
      const response = await api.get(`/ticket-solutions?${params.toString()}`);
      return response.data;
    },
    enabled: Boolean(category),
  });

  const groupedSolutions = React.useMemo(() => {
    if (!solutions?.data) return {};
    return solutions.data.reduce<Record<string, Solution[]>>((acc, solution) => {
      const category = solution.category || 'uncategorized';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(solution);
      return acc;
    }, {});
  }, [solutions]);

  if (isLoading) {
    return (
      <Box sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}>
        <Typography>Loading solutions...</Typography>
      </Box>
    );
  }

  if (!solutions?.data?.length) {
    return (
      <Box sx={{ 
        p: 3,
        textAlign: 'center',
        color: 'text.secondary',
        backgroundColor: alpha(theme.palette.background.paper, 0.6),
        borderRadius: 2,
      }}>
        <Typography>No solutions found for this category.</Typography>
      </Box>
    );
  }

  return (
    <Box>
      {Object.entries(groupedSolutions).map(([category, categorySolutions]) => (
        <Accordion 
          key={category} 
          defaultExpanded={true}
          elevation={0}
          sx={{
            backgroundColor: 'transparent',
            '&:before': { display: 'none' },
            '&:not(:last-child)': { mb: 2 },
          }}
        >
          <AccordionSummary 
            expandIcon={<ExpandMoreIcon />}
            sx={{
              backgroundColor: alpha(theme.palette.background.paper, 0.6),
              borderRadius: 2,
              '&.Mui-expanded': {
                borderBottomLeftRadius: 0,
                borderBottomRightRadius: 0,
              },
            }}
          >
            <Typography 
              variant="h6" 
              sx={{ 
                textTransform: 'capitalize',
                fontWeight: 600,
                letterSpacing: '-0.01em',
              }}
            >
              {category.replace('_', ' ')}
            </Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 2 }}>
            <Grid container spacing={2}>
              {categorySolutions.map((solution) => {
                const isApplied = solution.id === appliedSolutionId;
                return (
                  <Grid item xs={12} key={solution.id}>
                    <Card 
                      elevation={0}
                      sx={{
                        borderRadius: 2,
                        backgroundColor: isApplied 
                          ? alpha(colors.successGreen, 0.1)
                          : solution.previouslyUsed
                          ? alpha(colors.primaryBlue, 0.05)
                          : theme.palette.background.paper,
                        boxShadow: shadows.subtle,
                        transition: 'all 0.2s ease-in-out',
                        '&:hover': {
                          transform: 'translateY(-2px)',
                          boxShadow: shadows.medium,
                        },
                      }}
                    >
                      <CardContent>
                        <Stack spacing={2}>
                          <Box sx={{ 
                            display: 'flex', 
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            gap: 2,
                          }}>
                            <Box>
                              <Typography 
                                variant="h6" 
                                sx={{ 
                                  fontWeight: 600,
                                  mb: 0.5,
                                  color: isApplied 
                                    ? colors.successGreen 
                                    : theme.palette.text.primary,
                                }}
                              >
                                {solution.title}
                              </Typography>
                              <Stack direction="row" spacing={1}>
                                {solution.previouslyUsed && (
                                  <Chip
                                    label="Previously Used"
                                    size="small"
                                    sx={{
                                      ...chipStyles,
                                      backgroundColor: alpha(colors.primaryBlue, 0.1),
                                      color: colors.primaryBlue,
                                    }}
                                  />
                                )}
                                {isApplied && (
                                  <Chip
                                    icon={<CheckIcon />}
                                    label="Applied"
                                    size="small"
                                    sx={{
                                      ...chipStyles,
                                      backgroundColor: alpha(colors.successGreen, 0.1),
                                      color: colors.successGreen,
                                    }}
                                  />
                                )}
                              </Stack>
                            </Box>
                            {onApplySolution && !isApplied && (
                              <Button
                                startIcon={<AddIcon />}
                                onClick={() => onApplySolution(solution)}
                                sx={{
                                  ...chipStyles,
                                  backgroundColor: alpha(colors.primaryBlue, 0.1),
                                  color: colors.primaryBlue,
                                  '&:hover': {
                                    backgroundColor: alpha(colors.primaryBlue, 0.2),
                                  },
                                }}
                              >
                                Apply Solution
                              </Button>
                            )}
                          </Box>
                          <Typography 
                            variant="body2" 
                            sx={{ 
                              color: theme.palette.text.secondary,
                              whiteSpace: 'pre-wrap',
                              lineHeight: 1.6,
                            }}
                          >
                            {solution.description}
                          </Typography>
                        </Stack>
                      </CardContent>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  );
}