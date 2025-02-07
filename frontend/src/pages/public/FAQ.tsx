import {
  Box,
  Typography,
  Container,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Paper,
} from '@mui/material';
import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material';

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
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Paper 
        elevation={0} 
        sx={{ 
          p: 4, 
          backgroundColor: (theme) => 
            theme.palette.mode === 'dark' 
              ? 'rgba(255, 255, 255, 0.05)' 
              : 'rgba(0, 0, 0, 0.02)',
          borderRadius: 2
        }}
      >
        <Typography 
          variant="h4" 
          gutterBottom 
          sx={{ 
            fontWeight: 'medium',
            mb: 3
          }}
        >
          Frequently Asked Questions
        </Typography>
        
        <Box sx={{ mt: 4 }}>
          {faqs.map((faq, index) => (
            <Accordion
              key={index}
              elevation={0}
              sx={{
                '&:not(:last-child)': {
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                },
                '&:before': {
                  display: 'none',
                },
                backgroundColor: 'transparent',
                '& .MuiAccordionSummary-root:hover': {
                  backgroundColor: (theme) =>
                    theme.palette.mode === 'dark'
                      ? 'rgba(255, 255, 255, 0.05)'
                      : 'rgba(0, 0, 0, 0.02)',
                },
              }}
            >
              <AccordionSummary
                expandIcon={<ExpandMoreIcon />}
                sx={{
                  '& .MuiAccordionSummary-content': {
                    py: 1,
                  },
                }}
              >
                <Typography 
                  variant="h6" 
                  sx={{ 
                    fontSize: '1.1rem',
                    fontWeight: 'medium'
                  }}
                >
                  {faq.question}
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography
                  sx={{
                    color: 'text.secondary',
                    lineHeight: 1.7,
                  }}
                >
                  {faq.answer}
                </Typography>
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>
      </Paper>
    </Container>
  );
}