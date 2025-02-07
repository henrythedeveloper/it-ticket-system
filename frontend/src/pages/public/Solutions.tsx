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
} from '@mui/icons-material';

// Static solutions data
const solutions = [
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

const categories = [
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
    <Box sx={{ pb: 8 }}>
      {/* Hero Section */}
      <Box
        sx={{
          position: 'relative',
          bgcolor: 'primary.main',
          color: 'primary.contrastText',
          py: { xs: 6, md: 10 },
          mb: 6,
        }}
      >
        <Container maxWidth="lg">
          <Typography
            variant="h2"
            sx={{
              fontWeight: 'bold',
              fontSize: { xs: '2rem', md: '3rem' },
              textAlign: 'center',
              mb: 2,
            }}
          >
            Find Solutions
          </Typography>
          <Typography
            variant="h6"
            sx={{
              textAlign: 'center',
              mb: 4,
              fontWeight: 'normal',
              maxWidth: '600px',
              mx: 'auto',
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
                    <SearchIcon />
                  </InputAdornment>
                ),
                sx: {
                  bgcolor: 'background.paper',
                  borderRadius: 2,
                  '& fieldset': {
                    borderColor: 'transparent',
                  },
                  '&:hover fieldset': {
                    borderColor: 'transparent',
                  },
                }
              }}
            />
          </Box>
        </Container>
      </Box>

      {/* Categories Grid */}
      <Container maxWidth="lg">
        <Grid
          container
          spacing={3}
          sx={{
            mb: 6,
            '& .MuiGrid-item': {
              display: 'flex',
            }
          }}
        >
          {categories.map((category) => {
            const Icon = category.icon;
            const isSelected = selectedCategory === category.id;
            return (
              <Grid item xs={6} sm={4} md={2} key={category.id}>
                <Card
                  onClick={() => setSelectedCategory(isSelected ? null : category.id)}
                  sx={{
                    cursor: 'pointer',
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'all 0.3s',
                    bgcolor: isSelected ? 'primary.main' : 'background.paper',
                    color: isSelected ? 'primary.contrastText' : 'text.primary',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: theme.shadows[4],
                      bgcolor: isSelected
                        ? 'primary.dark'
                        : alpha(theme.palette.primary.main, 0.1),
                    },
                  }}
                >
                  <CardContent
                    sx={{
                      textAlign: 'center',
                      p: 3,
                      minHeight: 120,
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
                        transition: 'transform 0.2s',
                        '&:hover': {
                          transform: 'scale(1.1)'
                        }
                      }}
                    />
                    <Typography
                      variant="subtitle2"
                      sx={{
                        fontSize: '0.875rem',
                        fontWeight: 'medium',
                        letterSpacing: '0.01em'
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
        <Grid
          container
          spacing={3}
          sx={{
            '& .MuiGrid-item': {
              display: 'flex',
            }
          }}
        >
          {filteredSolutions.map((solution) => (
            <Grid item xs={12} md={6} key={solution.id} sx={{ minHeight: '100%' }}>
              <Card
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  width: '100%',
                  height: '100%',
                  transition: 'all 0.3s',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: theme.shadows[4],
                  },
                }}
              >
                <CardContent
                  sx={{
                    minHeight: '200px',
                    p: 3,
                    '&:last-child': { pb: 3 }
                  }}
                >
                  <Typography
                    variant="subtitle2"
                    color="primary"
                    sx={{
                      mb: 1,
                      textTransform: 'uppercase',
                      fontSize: '0.75rem',
                      letterSpacing: '0.1em'
                    }}
                  >
                    {solution.category}
                  </Typography>
                  <Typography
                    variant="h6"
                    gutterBottom
                    sx={{
                      fontSize: '1.1rem',
                      fontWeight: 'medium',
                      mb: 2
                    }}
                  >
                    {solution.title}
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      lineHeight: 1.6,
                      fontSize: '0.875rem'
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
        {(!filteredSolutions || filteredSolutions.length === 0) && (
          <Box
            sx={{
              textAlign: 'center',
              py: 8,
            }}
          >
            <Typography variant="h6" color="text.secondary">
              No solutions found
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Try adjusting your search or category filters
            </Typography>
          </Box>
        )}
      </Container>
    </Box>
  );
}