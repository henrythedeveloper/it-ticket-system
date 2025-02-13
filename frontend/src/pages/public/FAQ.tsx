import { useState } from 'react';
import {
  Box,
  Typography,
  Container,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Paper,
  useTheme,
  alpha,
} from '@mui/material';
import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material';
import { 
  colors, 
  shadows, 
  sectionTitleStyles 
} from '../../styles/common';

const faqs = [
  {
    question: "How do I submit a support ticket?",
    answer: "You can submit a support ticket by clicking on the 'Submit Ticket' button in the navigation menu. Fill out the form with your issue details, and our support team will respond as soon as possible."
  },
  {
    question: "What information should I include in my ticket?",
    answer: "To help us assist you better, please include: a clear description of the issue, steps to reproduce the problem, any error messages you've received, and what you've already tried to resolve it."
  },
  {
    question: "How long does it take to get a response?",
    answer: "We aim to respond to all tickets within 24 hours during business days. Priority issues are handled more quickly. You'll receive email updates when there's any activity on your ticket."
  },
  {
    question: "Can I track the status of my ticket?",
    answer: "Yes, you can track your ticket status through the portal. Each ticket has a unique ID that you receive via email when submitting. You can use this to check the status and any updates."
  },
  {
    question: "What are the support hours?",
    answer: "Our support team is available Monday through Friday, 9 AM to 5 PM Mountain Time. For urgent issues outside these hours, please follow the emergency contact procedures provided to your organization."
  }
];

export default function FAQ() {
  const theme = useTheme();
  const [expandedPanel, setExpandedPanel] = useState<number | false>(false);

  const handleChange = (panel: number) => (
    _event: React.SyntheticEvent,
    isExpanded: boolean
  ) => {
    setExpandedPanel(isExpanded ? panel : false);
  };

  return (
    <Container maxWidth="lg" sx={{ py: 6 }}>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          mb: 6,
        }}
      >
        <Typography 
          sx={{
            ...sectionTitleStyles,
            fontSize: { xs: '2rem', sm: '2.5rem' },
            mb: 2,
          }}
        >
          Frequently Asked Questions
        </Typography>
        <Typography
          variant="subtitle1"
          sx={{
            color: alpha(theme.palette.text.primary, 0.7),
            maxWidth: 600,
            mb: 4,
          }}
        >
          Find quick answers to common questions about our help desk system
        </Typography>
      </Box>

      <Paper 
        elevation={0} 
        sx={{ 
          p: { xs: 2, sm: 4 }, 
          backgroundColor: alpha(theme.palette.background.paper, 0.6),
          backdropFilter: 'blur(10px)',
          borderRadius: 3,
          boxShadow: shadows.subtle,
          border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
        }}
      >
        <Box>
          {faqs.map((faq, index) => (
            <Accordion
              key={index}
              expanded={expandedPanel === index}
              onChange={handleChange(index)}
              elevation={0}
              disableGutters
              sx={{
                '&:not(:last-child)': {
                  borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                },
                '&:before': {
                  display: 'none',
                },
                backgroundColor: 'transparent',
                transition: 'all 0.3s ease-in-out',
                '& .MuiAccordionSummary-root': {
                  transition: 'all 0.2s ease-in-out',
                  borderRadius: 2,
                  mx: -1,
                  px: 1,
                },
                '& .MuiAccordionSummary-root:hover': {
                  backgroundColor: alpha(theme.palette.action.hover, 0.1),
                },
                '&.Mui-expanded': {
                  '& .MuiAccordionSummary-root': {
                    backgroundColor: alpha(colors.primaryBlue, 0.05),
                  },
                  '& .MuiAccordionSummary-expandIconWrapper': {
                    color: colors.primaryBlue,
                    transform: 'rotate(180deg) !important',
                  },
                },
              }}
            >
              <AccordionSummary
                expandIcon={
                  <ExpandMoreIcon 
                    sx={{ 
                      transition: 'transform 0.3s ease-in-out, color 0.2s ease-in-out',
                      color: expandedPanel === index 
                        ? colors.primaryBlue 
                        : alpha(theme.palette.text.primary, 0.5),
                    }}
                  />
                }
                sx={{
                  '& .MuiAccordionSummary-content': {
                    py: 1.5,
                  },
                }}
              >
                <Typography 
                  variant="h6" 
                  sx={{ 
                    fontSize: '1.1rem',
                    fontWeight: 500,
                    color: expandedPanel === index 
                      ? colors.primaryBlue 
                      : theme.palette.text.primary,
                    transition: 'color 0.2s ease-in-out',
                  }}
                >
                  {faq.question}
                </Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ pt: 0, pb: 3 }}>
                <Typography
                  sx={{
                    color: alpha(theme.palette.text.primary, 0.7),
                    lineHeight: 1.7,
                    fontSize: '0.95rem',
                  }}
                >
                  {faq.answer}
                </Typography>
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>
      </Paper>

      <Box sx={{ mt: 4, textAlign: 'center' }}>
        <Typography
          variant="body2"
          sx={{
            color: alpha(theme.palette.text.secondary, 0.8),
            backgroundColor: alpha(colors.primaryBlue, 0.05),
            border: `1px solid ${alpha(colors.primaryBlue, 0.1)}`,
            borderRadius: 2,
            p: 2,
            display: 'inline-block',
          }}
        >
          Can't find what you're looking for? Submit a ticket and we'll help you out.
        </Typography>
      </Box>
    </Container>
  );
}