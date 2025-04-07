# IT Helpdesk System Project Structure

```
helpdesk-system/
├── docker-compose.yml        # Defines all services and their relationships
├── .env                      # Environment variables (don't commit secrets to repo)
├── .gitignore                # Git ignore file
│
├── frontend/                 # React TypeScript frontend
│   ├── Dockerfile            # Multi-stage build for frontend
│   ├── package.json          # Frontend dependencies
│   ├── tsconfig.json         # TypeScript configuration
│   ├── public/               # Static assets
│   └── src/                  # Source code
│       ├── components/       # React components
│       ├── pages/            # Page components
│       ├── services/         # API client services
│       ├── styles/           # SCSS styles
│       ├── types/            # TypeScript type definitions
│       ├── utils/            # Utility functions
│       ├── App.tsx           # Main App component
│       └── index.tsx         # Entry point
│
├── backend/                  # Go backend API
│   ├── Dockerfile            # Go build Dockerfile
│   ├── go.mod                # Go module definitions
│   ├── go.sum                # Go module checksums
│   ├── cmd/                  # Application entry points
│   │   └── server/           # API server entry point
│   │       └── main.go       # Main Go application
│   ├── internal/             # Internal packages
│   │   ├── api/              # API handlers
│   │   ├── auth/             # Authentication logic
│   │   ├── config/           # Configuration
│   │   ├── db/               # Database connection and migrations
│   │   ├── email/            # Email service implementation
│   │   ├── file/             # File storage implementation
│   │   └── models/           # Data models
│   └── migrations/           # Database migrations
│
└── nginx/                    # Nginx configuration
    ├── Dockerfile            # Nginx container setup
    └── nginx.conf            # Nginx config for reverse proxy
```