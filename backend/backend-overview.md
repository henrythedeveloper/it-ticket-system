# IT Helpdesk Ticket System Backend Overview

## Overview
The backend is a Go (Golang) REST API built with the Echo framework. It manages tickets, users, tags, FAQs, notifications, file attachments, and authentication for an IT helpdesk system. It is designed for containerized deployment (Docker) and integrates with PostgreSQL, S3-compatible storage (e.g., MinIO), and supports both in-memory and Redis caching.

---

## Main Components

- **Entry Point:**
  - `cmd/server/main.go`: Loads config, initializes services, starts the API server, and handles graceful shutdown.

- **API Server:**
  - `internal/api/server.go`: Sets up the Echo server, middleware, route groups, and handler registration.

- **Handlers:**
  - `internal/api/handlers/`
    - `ticket/`: Ticket CRUD, comments, attachments, and search.
    - `user/`: User CRUD, authentication (login), and profile.
    - `faq/`: FAQ CRUD and query.
    - `tag/`: Tag CRUD and query.
    - `notification/`: (Planned/partial) In-app notification endpoints.

- **Middleware:**
  - `internal/api/middleware/auth/`: JWT authentication and admin role checks.

- **Core Services:**
  - `internal/auth/`: Password hashing, JWT creation/validation.
  - `internal/email/`: Email sending (SMTP), with HTML templates for ticket events.
  - `internal/file/`: File storage abstraction (S3/MinIO).
  - `internal/cache/`: In-memory and Redis cache implementations.
  - `internal/db/`: PostgreSQL connection pool and migration logic.
  - `internal/config/`: Loads and validates environment config (using Viper).
  - `internal/models/`: All data models (User, Ticket, Tag, FAQ, Notification, etc).

- **Database:**
  - PostgreSQL, schema managed via SQL migrations (see `db/seed.sql`).

- **Docker:**
  - `Dockerfile` for backend image. `docker-compose.yml` for multi-service orchestration.

---

## API Structure & Flow

- **Authentication:**
  - JWT-based. Login returns a token; protected routes require JWT in `Authorization` header.
  - Admin-only routes are protected by middleware.

- **Tickets:**
  - Users (public or authenticated) can create tickets (with optional attachments).
  - Staff/Admins can view, update, assign, and comment on tickets.
  - Attachments are uploaded to S3/MinIO and metadata is stored in the DB.
  - Comments and status changes are tracked.

- **Users:**
  - Admins can create, update, and delete users.
  - Users can view and update their own profile.

- **Tags & FAQs:**
  - Tags categorize tickets. FAQs provide help content. Both have CRUD endpoints (admin-protected for write).

- **Notifications:**
  - (Planned/partial) In-app notifications for ticket events, stored in DB and exposed via API.

- **Caching:**
  - Used for performance (e.g., frequently accessed queries). Supports in-memory and Redis.

- **Email:**
  - Sends notifications for ticket creation, assignment, progress, and closure using HTML templates.

- **File Attachments:**
  - Uploaded files are stored in S3/MinIO. Download links are provided via the API.

---

## How It Works (Typical Flow)

1. **User submits a ticket** via the frontend (optionally with attachments).
2. **Backend validates** input, stores ticket in DB, uploads files to S3/MinIO, and sends a confirmation email.
3. **Staff/Admins** log in, view/manage tickets, add comments, change status, assign tickets, etc.
4. **Notifications** (in-app/email) are generated for relevant events.
5. **All data** (tickets, users, tags, FAQs, notifications, attachments) is persisted in PostgreSQL.
6. **APIs** are protected by JWT authentication and role-based access control.

---

## Key Files & Folders

- `cmd/server/main.go` — Application entry point
- `internal/api/server.go` — API server setup
- `internal/api/handlers/` — All resource handlers (ticket, user, tag, faq, notification)
- `internal/models/models.go` — Data models
- `internal/config/config.go` — Config loading/validation
- `internal/email/` — Email service and templates
- `internal/file/` — File storage abstraction
- `internal/cache/` — Cache implementations
- `db/seed.sql` — DB schema seed
- `Dockerfile`, `docker-compose.yml` — Containerization

---

## Environment & Configuration

- All config is loaded from environment variables (see `internal/config/config.go`).
- Required: DB credentials, JWT secret, SMTP/email settings, S3/MinIO settings, cache settings.
- See `.env.example` or code comments for details.

---

## Extending/Debugging

- Add new endpoints by creating handler methods and registering them in `server.go`.
- Use structured logging (`log/slog`) for debugging.
- Run locally with Docker Compose for full stack.

---

## See Also
- See `readme.md` in the project root for a high-level overview and setup instructions.
