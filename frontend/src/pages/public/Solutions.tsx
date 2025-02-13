import { useState } from 'react';
import {
  Box,
  Typography,
  Container,
  Grid,
  Card,
  CardContent,
  TextField,
  InputAdornment,
  alpha,
  useTheme,
} from '@mui/material';
import { 
  Search as SearchIcon,
  ComputerOutlined,
  SecurityOutlined,
  StorageOutlined,
  NetworkCheckOutlined,
  BuildOutlined,
  SettingsOutlined,
  SvgIconComponent,
} from '@mui/icons-material';
import { 
  colors, 
  shadows, 
  sectionTitleStyles 
} from '../../styles/common';

interface Solution {
  id: number;
  category: string;
  title: string;
  description: string;
}

interface Category {
  id: string;
  name: string;
  icon: SvgIconComponent;
}

const solutions: Solution[] = [
  {
    id: 1,
    category: 'hardware',
    title: 'Printer Connection Issues',
    description: 'Learn how to troubleshoot common printer connection problems, including network connectivity, driver updates, and hardware checks.'
  },
  {
    id: 2,
    category: 'software',
    title: 'Software Installation Guide',
    description: 'Step-by-step guide for installing and configuring common software applications, including troubleshooting installation errors.'
  },
  {
    id: 3,
    category: 'network',
    title: 'Wi-Fi Connectivity Solutions',
    description: 'Solutions for common Wi-Fi issues, including weak signals, connection drops, and network configuration problems.'
  },
  {
    id: 4,
    category: 'security',
    title: 'Account Security Best Practices',
    description: 'Learn about password management, two-factor authentication, and other security measures to protect your account.'
  },
  {
    id: 5,
    category: 'database',
    title: 'Database Backup Guide',
    description: 'Instructions for backing up and restoring database content, including automated backup procedures and recovery steps.'
  },
  {
    id: 6,
    category: 'system',
    title: 'System Performance Optimization',
    description: 'Tips and techniques for improving system performance, including cleanup procedures and optimization settings.'
  },
  {
    id: 7,
    category: 'hardware',
    title: 'Monitor Display Issues',
    description: 'Solutions for common monitor problems, including resolution settings, connection types, and display calibration.'
  },
  {
    id: 8,
    category: 'software',
    title: 'Software Update Problems',
    description: 'Troubleshooting guide for software update issues, including error messages and compatibility problems.'
  }
];

const categories: Category[] = [
  { id: 'hardware', name: 'Hardware', icon: ComputerOutlined },
  { id: 'software', name: 'Software', icon: BuildOutlined },
  { id: 'network', name: 'Network', icon: NetworkCheckOutlined },
  { id: 'security', name: 'Security', icon: SecurityOutlined },
  { id: 'database', name: 'Database', icon: StorageOutlined },
  { id: 'system', name: 'System', icon: SettingsOutlined },
];

export default function Solutions() {
  const theme = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const filteredSolutions = solutions.filter(solution => {
    const matchesSearch = searchQuery === '' || 
      solution.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      solution.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !selectedCategory || solution.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <Box>
      {/* Hero Section */}
      <Box
        sx={{
          position: 'relative',
          background: `linear-gradient(120deg, ${alpha(colors.primaryBlue, 0.95)}, ${alpha(colors.primaryBlue, 0.8)})`,
          color: 'white',
          py: { xs: 8, md: 12 },
          mb: 6,
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'url(/path/to/pattern.png) repeat',
            opacity: 0.1,
            zIndex: 0,
          },
        }}
      >
        <Container 
          maxWidth="lg"
          sx={{
            position: 'relative',
            zIndex: 1,
          }}
        >
          <Typography
            sx={{
              ...sectionTitleStyles,
              color: 'white',
              fontSize: { xs: '2.5rem', md: '3.5rem' },
              textAlign: 'center',
              mb: 3,
              textShadow: '0 2px 4px rgba(0,0,0,0.1)',
            }}
          >
            Find Solutions
          </Typography>
          <Typography
            variant="h6"
            sx={{
              textAlign: 'center',
              mb: 5,
              fontWeight: 'normal',
              maxWidth: '600px',
              mx: 'auto',
              color: alpha('#fff', 0.9),
              fontSize: { xs: '1rem', md: '1.25rem' },
            }}
          >
            Browse our collection of solutions and guides to help resolve common issues quickly.
          </Typography>
          <Box sx={{ maxWidth: '600px', mx: 'auto' }}>
            <TextField
              fullWidth
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search solutions..."
              variant="outlined"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: alpha(theme.palette.text.primary, 0.5) }} />
                  </InputAdornment>
                ),
                sx: {
                  bgcolor: alpha(theme.palette.background.paper, 0.9),
                  backdropFilter: 'blur(10px)',
                  borderRadius: 2,
                  boxShadow: shadows.medium,
                  transition: 'all 0.2s ease-in-out',
                  '& fieldset': {
                    borderColor: 'transparent',
                  },
                  '&:hover': {
                    bgcolor: alpha(theme.palette.background.paper, 0.95),
                    boxShadow: shadows.strong,
                  },
                  '&.Mui-focused': {
                    bgcolor: theme.palette.background.paper,
                    boxShadow: shadows.strong,
                  },
                }
              }}
            />
          </Box>
        </Container>
      </Box>

      {/* Categories Grid */}
      <Container maxWidth="lg">
        <Grid container spacing={3} sx={{ mb: 6 }}>
          {categories.map((category) => {
            const Icon = category.icon;
            const isSelected = selectedCategory === category.id;
            return (
              <Grid item xs={6} sm={4} md={2} key={category.id}>
                <Card
                  onClick={() => setSelectedCategory(isSelected ? null : category.id)}
                  sx={{
                    cursor: 'pointer',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'all 0.3s ease-in-out',
                    bgcolor: isSelected 
                      ? alpha(colors.primaryBlue, 0.1)
                      : theme.palette.background.paper,
                    border: `1px solid ${isSelected 
                      ? alpha(colors.primaryBlue, 0.2)
                      : alpha(theme.palette.divider, 0.1)}`,
                    boxShadow: isSelected ? shadows.subtle : 'none',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: shadows.medium,
                      bgcolor: isSelected
                        ? alpha(colors.primaryBlue, 0.15)
                        : alpha(theme.palette.background.paper, 0.9),
                    },
                  }}
                >
                  <CardContent
                    sx={{
                      textAlign: 'center',
                      p: 3,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      alignItems: 'center',
                      flex: 1,
                      '&:last-child': { pb: 3 }
                    }}
                  >
                    <Icon
                      sx={{
                        fontSize: 48,
                        mb: 2,
                        color: isSelected ? colors.primaryBlue : colors.secondaryGray,
                        transition: 'all 0.2s ease-in-out',
                        '&:hover': {
                          transform: 'scale(1.1)',
                        }
                      }}
                    />
                    <Typography
                      variant="subtitle2"
                      sx={{
                        fontSize: '0.875rem',
                        fontWeight: 500,
                        color: isSelected ? colors.primaryBlue : theme.palette.text.primary,
                      }}
                    >
                      {category.name}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>

        {/* Solutions Grid */}
        <Grid container spacing={3}>
          {filteredSolutions.map((solution) => (
            <Grid item xs={12} md={6} key={solution.id}>
              <Card
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'all 0.3s ease-in-out',
                  border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                  boxShadow: 'none',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: shadows.medium,
                    bgcolor: alpha(theme.palette.background.paper, 0.9),
                    borderColor: alpha(colors.primaryBlue, 0.1),
                  },
                }}
              >
                <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
                  <Typography
                    variant="subtitle2"
                    sx={{
                      mb: 1,
                      color: colors.primaryBlue,
                      textTransform: 'uppercase',
                      fontSize: '0.75rem',
                      letterSpacing: '0.1em',
                      fontWeight: 600,
                    }}
                  >
                    {solution.category}
                  </Typography>
                  <Typography
                    variant="h6"
                    gutterBottom
                    sx={{
                      fontSize: '1.25rem',
                      fontWeight: 500,
                      mb: 2,
                      color: theme.palette.text.primary,
                    }}
                  >
                    {solution.title}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      color: alpha(theme.palette.text.primary, 0.7),
                      lineHeight: 1.7,
                      fontSize: '0.875rem',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                    }}
                  >
                    {solution.description}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        {/* Empty State */}
        {filteredSolutions.length === 0 && (
          <Box
            sx={{
              textAlign: 'center',
              py: 8,
              px: 2,
              backgroundColor: alpha(theme.palette.background.paper, 0.6),
              backdropFilter: 'blur(10px)',
              borderRadius: 3,
              border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
              maxWidth: 600,
              mx: 'auto',
            }}
          >
            <Typography 
              variant="h6" 
              sx={{
                color: theme.palette.text.primary,
                mb: 1,
                fontWeight: 500,
              }}
            >
              No solutions found
            </Typography>
            <Typography 
              variant="body2" 
              sx={{
                color: alpha(theme.palette.text.primary, 0.7),
                fontSize: '0.875rem',
              }}
            >
              Try adjusting your search or category filters
            </Typography>
          </Box>
        )}
      </Container>
    </Box>
  );
}