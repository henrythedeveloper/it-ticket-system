# Help Desk Ticket System Architecture

## System Overview

The Help Desk Ticket System is a full-stack web application that manages support tickets and internal tasks. It consists of two main interfaces:

1. Public User Portal
2. Internal Help Desk Portal

## Technical Stack

### Frontend
- **Framework:** React with TypeScript
- **Build Tool:** Vite
- **State Management:** React Context + Hooks
- **UI Components:** Material-UI
- **Form Handling:** React Hook Form
- **API Client:** Axios
- **Authentication:** JWT stored in HTTP-only cookies
- **Web Server:** Nginx for static file serving

### Backend
- **Language:** Go
- **Web Framework:** Gin
- **Database:** PostgreSQL
- **ORM:** GORM
- **Authentication:** JWT + bcrypt
- **Email:** SMTP (e.g., SendGrid)

## Project Structure

### Backend Structure
```
backend/
├── cmd/
│   └── server/           # Application entrypoint
├── internal/
│   ├── auth/            # Authentication logic
│   ├── config/          # Configuration management
│   ├── handlers/        # HTTP request handlers
│   ├── middleware/      # HTTP middleware
│   └── models/          # Database models
├── migrations/          # Database migrations
└── scripts/            # Utility scripts
```

### Frontend Structure
```
frontend/
├── src/
│   ├── components/     # Reusable UI components
│   ├── contexts/       # React contexts
│   ├── pages/
│   │   ├── auth/      # Authentication pages
│   │   ├── portal/    # Internal portal pages
│   │   └── public/    # Public pages
│   ├── types/         # TypeScript definitions
│   └── utils/         # Utility functions
├── nginx.conf         # Nginx configuration
└── vite.config.ts     # Vite configuration
```

## Core Components

### Frontend Components

1. **Public Ticket Portal (`/`)**
   - Ticket submission form
   - Category selection
   - Email confirmation display
   - Success page after submission

2. **Help Desk Portal (`/portal`)**
   - Authentication screens (login/register)
   - Dashboard
   - Ticket management interface
   - Task management interface
   - User management (admin only)

### Backend Services

1. **Authentication Service**
   ```go
   /auth
     - POST /register    // Internal staff registration
     - POST /login      // Staff login
     - POST /logout     // Clear session
     - GET  /verify     // Verify JWT token
   ```

2. **Ticket Service**
   ```go
   /tickets
     - POST /          // Create new ticket
     - GET  /          // List tickets (authenticated)
     - GET  /:id       // Get ticket details
     - PUT  /:id       // Update ticket
     - DELETE /:id     // Delete ticket (admin only)
   ```

3. **Task Service**
   ```go
   /tasks
     - POST /          // Create internal task
     - GET  /          // List tasks
     - GET  /:id       // Get task details
     - PUT  /:id       // Update task
     - DELETE /:id     // Delete task
   ```

4. **User Service**
   ```go
   /users
     - GET  /          // List users (admin only)
     - GET  /:id       // Get user details
     - PUT  /:id       // Update user
     - DELETE /:id     // Delete user (admin only)
   ```

## Database Schema

```sql
-- Users table (IT Staff)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,  -- admin, staff
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tickets table
CREATE TABLE tickets (
    id SERIAL PRIMARY KEY,
    ticket_number VARCHAR(50) UNIQUE NOT NULL,  -- Auto-generated ticket reference
    category VARCHAR(100) NOT NULL,  -- network, hardware, software
    description TEXT NOT NULL,
    submitter_email VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL,  -- open, in_progress, resolved
    assigned_to INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tasks table (Internal)
CREATE TABLE tasks (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    priority VARCHAR(50) NOT NULL,  -- low, medium, high
    status VARCHAR(50) NOT NULL,  -- todo, in_progress, done
    created_by INTEGER REFERENCES users(id),
    assigned_to INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Security Measures

1. **Authentication & Authorization**
   - JWT tokens with short expiration
   - HTTP-only cookies for token storage
   - Role-based access control
   - Password hashing with bcrypt

2. **API Security**
   - CORS configuration
   - Input validation
   - Rate limiting
   - Request sanitization

3. **Infrastructure**
   - HTTPS/TLS encryption
   - Environment variables for secrets
   - Database connection pooling
   - Prepared statements for SQL

## Development Environment

1. **Docker Compose Setup**
   - Frontend container with Node.js
   - Backend container with Go
   - PostgreSQL database container
   - Nginx reverse proxy

2. **Development Tools**
   - Hot reload for frontend (Vite)
   - Database migration scripts
   - JWT secret generation utilities
   - Password hashing utilities

## Deployment Strategy

1. **Frontend**
   - Build static assets with Vite
   - Deploy to CDN (e.g., Cloudflare, Vercel)
   - Environment-specific configuration
   - Nginx for serving static files

2. **Backend**
   - Docker containerization
   - Deploy to cloud platform (e.g., AWS, GCP)
   - Reverse proxy (Nginx)
   - SSL/TLS termination

3. **Database**
   - Managed database service
   - Regular backups
   - Migration strategy
   - Connection pooling

## Development Workflow

1. Use Git for version control
2. Implement CI/CD pipeline
3. Write unit and integration tests
4. Use environment variables for configuration
5. Follow code style guidelines
6. Regular database migrations
7. Docker-based local development