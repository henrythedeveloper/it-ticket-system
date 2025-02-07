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
} from '@mui/material';
import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { Solution } from '../types';
import api from '../utils/axios';

interface CommonSolutionsProps {
  category?: string;
  email?: string;
}

export default function CommonSolutions({ category, email }: CommonSolutionsProps) {
  const { data: solutions, isLoading } = useQuery<{ data: Solution[] }>({
    queryKey: ['solutions', category, email],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (category) params.append('category', category);
      if (email) params.append('email', email);
      const response = await api.get(`/solutions?${params.toString()}`);
      return response.data;
    },
    enabled: Boolean(category), // Only run query if category is provided
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
      <Box sx={{ p: 2 }}>
        <Typography>Loading solutions...</Typography>
      </Box>
    );
  }

  if (!solutions?.data?.length) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography>No solutions found for this category.</Typography>
      </Box>
    );
  }

  return (
    <Box>
      {Object.entries(groupedSolutions).map(([category, categorySolutions]) => (
        <Accordion key={category} defaultExpanded={true}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="h6" sx={{ textTransform: 'capitalize' }}>
              {category.replace('_', ' ')}
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={2}>
              {categorySolutions.map((solution) => (
                <Grid item xs={12} key={solution.id}>
                  <Card 
                    variant="outlined"
                    sx={{
                      borderColor: solution.previouslyUsed 
                        ? 'primary.main' 
                        : 'divider',
                    }}
                  >
                    <CardContent>
                      <Stack spacing={1}>
                        <Box 
                          sx={{ 
                            display: 'flex', 
                            justifyContent: 'space-between',
                            alignItems: 'flex-start' 
                          }}
                        >
                          <Typography variant="h6" gutterBottom>
                            {solution.title}
                          </Typography>
                          {solution.previouslyUsed && (
                            <Chip
                              label="Previously Used"
                              color="primary"
                              size="small"
                              sx={{ ml: 1 }}
                            />
                          )}
                        </Box>
                        <Typography 
                          variant="body2" 
                          color="text.secondary"
                          sx={{ 
                            whiteSpace: 'pre-wrap',
                            mb: 1 
                          }}
                        >
                          {solution.description}
                        </Typography>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  );
}