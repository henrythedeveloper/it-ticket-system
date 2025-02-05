# Help Desk Ticket System

A full-stack help desk ticket management system built with React and Go. The system provides a public ticket submission portal and an internal help desk portal for managing tickets and tasks.

## Quick Start

1. Clone the repository:
```bash
git clone [repository-url]
cd helpdesk-ticket-system
```

2. Generate secure JWT secrets:
```bash
cd backend/scripts
./generate-jwt-secrets.sh
cd ../..
```

3. Set up environment files:
```bash
# Copy the example environment file
cp .env.example .env

# Update the JWT secrets in .env with the values generated in step 2
# Update other configuration values as needed
```

4. Start the application using Docker:
```bash
docker-compose up --build
```

5. Access the application:
- Frontend: http://localhost:3000
- API: http://localhost:8080

Default admin credentials:
- Email: admin@helpdesk.local
- Password: admin123

## Features

### Public Portal
- Simple ticket submission form
- Category selection (network, hardware, software, etc.)
- Email notifications for ticket status updates
- No login required for submission

### Help Desk Portal (Internal)
- Secure authentication system
- Role-based access control (admin/staff)
- Ticket management
- Internal task tracking
- User management (admin only)
- Dashboard with statistics

## Tech Stack

### Frontend
- React 18 with TypeScript
- Material-UI for components
- React Query for data fetching
- React Router for navigation
- React Hook Form for forms

### Backend
- Go with Gin web framework
- PostgreSQL database
- GORM for ORM
- JWT authentication
- Email notifications

### Infrastructure
- Docker and Docker Compose
- Nginx for reverse proxy
- Automated database migrations
- Environment-based configuration

## Development Setup

### Prerequisites
- Node.js >= 16
- Go >= 1.19
- PostgreSQL >= 13

### Frontend Setup
```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

### Backend Setup
```bash
cd backend

# Generate JWT secrets first
cd scripts
./generate-jwt-secrets.sh
cd ..

# Set up Go dependencies
go mod download

# Copy and configure environment file
cp .env.example .env
# Update JWT secrets and other configurations in .env

# Set up the database
cd scripts
./setup-db.sh
cd ..

# Start the server
go run cmd/server/main.go
```

### Database Migrations
The system uses plain SQL migrations in `backend/migrations/`:
- `000001_initial_schema.up.sql`: Creates tables and indexes
- `000001_initial_schema.down.sql`: Reverts schema changes
- `000002_seed_data.up.sql`: Adds test data
- `000002_seed_data.down.sql`: Removes test data

To run migrations manually:
```bash
cd backend/scripts
./setup-db.sh
```

## Project Structure

```
├── frontend/               # React application
│   ├── src/
│   │   ├── components/    # Reusable components
│   │   ├── contexts/      # React contexts
│   │   ├── hooks/        # Custom hooks
│   │   ├── pages/        # Page components
│   │   └── types/        # TypeScript definitions
│   └── public/           # Static assets
│
├── backend/               # Go API server
│   ├── cmd/              # Entry points
│   ├── internal/         # Private packages
│   │   ├── auth/        # Authentication
│   │   ├── config/      # Configuration
│   │   ├── handlers/    # HTTP handlers
│   │   ├── middleware/  # HTTP middleware
│   │   ├── models/      # Database models
│   │   └── services/    # Business logic
│   ├── migrations/      # SQL migrations
│   └── scripts/         # Utility scripts
│
└── docker/              # Docker configuration
```

## Security Setup

### Generating JWT Secrets
The application uses two types of JWT secrets:
- `JWT_SECRET`: Used for access tokens
- `JWT_REFRESH_SECRET`: Used for refresh tokens

To generate secure random values for these secrets:
```bash
cd backend/scripts
./generate-jwt-secrets.sh
```

Copy the generated values into your `.env` file:
```env
JWT_SECRET=your-generated-secret
JWT_REFRESH_SECRET=your-generated-refresh-secret
```

### Production Security Checklist
- [ ] Generate new JWT secrets for production
- [ ] Update default admin credentials
- [ ] Configure proper CORS settings
- [ ] Set up SSL/TLS certificates
- [ ] Configure secure email settings
- [ ] Set appropriate rate limits
- [ ] Enable security headers
- [ ] Configure proper database access

## API Documentation

### Public Endpoints
- `POST /api/v1/tickets`: Submit ticket
- `POST /api/v1/auth/login`: Staff login
- `POST /api/v1/auth/register`: Staff registration (disabled by default)

### Protected Endpoints (requires authentication)
- `GET /api/v1/tickets`: List tickets
- `PATCH /api/v1/tickets/:id`: Update ticket
- `GET /api/v1/tasks`: List tasks
- `POST /api/v1/tasks`: Create task
- `PATCH /api/v1/tasks/:id`: Update task

### Admin Only Endpoints
- `GET /api/v1/users`: List users
- `PATCH /api/v1/users/:id`: Update user
- `DELETE /api/v1/users/:id`: Delete user

## Production Deployment

1. Generate new secure JWT secrets:
```bash
cd backend/scripts
./generate-jwt-secrets.sh
```

2. Configure environment variables for production:
```bash
# Frontend
VITE_API_URL=https://api.yourcompany.com

# Backend
GIN_MODE=release
JWT_SECRET=<generated-secret>
JWT_REFRESH_SECRET=<generated-refresh-secret>
CORS_ORIGIN=https://helpdesk.yourcompany.com
```

3. Build and deploy using Docker:
```bash
docker-compose -f docker-compose.prod.yml up -d
```

4. Set up SSL/TLS:
- Use Nginx as a reverse proxy
- Configure SSL certificates
- Enable HTTP/2
- Set up proper security headers

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to your branch
5. Open a pull request

Please ensure your code:
- Follows the existing style
- Includes appropriate tests
- Has meaningful commit messages
- Is properly documented

## License

MIT License - See LICENSE file for details