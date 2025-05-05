# IT Helpdesk Ticketing System

A full-stack web application designed to streamline IT support requests and management within an organization. Users can submit tickets publicly, while staff and administrators can manage tickets, users, and FAQs through an authenticated dashboard.

**Live Application:** [https://answersdesk.org](https://answersdesk.org)

## Problem Solved

Traditional methods of handling IT support (email, calls, walk-ins) often lead to:
* Lost or untracked requests.
* Lack of visibility for end-users on issue status.
* Inefficient task management and prioritization for IT staff.
* Repetitive answers to common questions.

This application aims to solve these problems by providing a centralized, efficient, and user-friendly platform.

## Features

* **Public Ticket Submission:** Allows anyone to submit a support ticket with details, urgency, type, tags, and file attachments.
* **Staff/Admin Dashboard:** Authenticated area for managing the helpdesk.
* **Ticket Management:** View, filter (by status, urgency, assignee, tags), assign, update status, and comment on tickets.
* **User Management:** Admins can create, view, edit, and delete staff/admin accounts. Staff permissions are slightly restricted (cannot delete users).
* **FAQ Management:** Admins/Staff can create, edit, and delete frequently asked questions to provide self-service support.
* **Tag Management:** Admins/Staff can manage tags used to categorize tickets.
* **File Attachments:** Users can attach files during submission; staff can view/download attachments (stored securely in Backblaze B2).
* **Email Notifications:** Automated emails (sent via Resend) for ticket creation, updates, assignments, password resets, etc.
* **Authentication:** Secure JWT-based authentication for staff/admin users, including password hashing and password reset functionality.

## Technology Stack

* **Frontend:** React, TypeScript, Rsbuild (Bundler), Zustand (State Management), Axios, SCSS, React Router
* **Backend:** Go (Golang), Echo Framework, PGX (Postgres Driver), `golang-jwt/jwt`, `bcrypt`
* **Database:** PostgreSQL
* **File Storage:** Backblaze B2 (S3-Compatible Object Storage)
* **Email:** Resend API
* **Proxy:** Nginx
* **Containerization:** Docker, Docker Compose (for local development)
* **Deployment:** Render (Web Services, Managed Postgres)
* **DNS:** Cloudflare
* **Version Control:** Git / GitHub

## Architecture

The application follows a client-server architecture:
1.  A React single-page application (SPA) frontend served by its own Nginx container.
2.  A Go (Echo) backend API handling business logic, database interactions, file storage, and email sending.
3.  A separate Nginx reverse proxy service acts as the public entry point, routing traffic to the appropriate frontend or backend service based on the URL path.
4.  Data is persisted in a PostgreSQL database.
5.  File attachments are stored in a Backblaze B2 bucket.
6.  Transactional emails are sent via the Resend API.
7.  The entire stack is containerized with Docker and deployed on the Render platform. Cloudflare manages DNS for the custom domain.

## Local Development Setup

1.  **Prerequisites:**
    * Docker and Docker Compose installed.
    * Git installed.
    * A code editor (e.g., VS Code).
2.  **Clone Repository:**
    ```bash
    git clone [Your Repository URL]
    cd it-ticket-system
    ```
3.  **Environment Variables:**
    * Create a `.env` file in the project root directory.
    * Copy the contents of `.env.example` (if available) or add the necessary variables for local development (e.g., `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `JWT_SECRET`, local S3/MinIO credentials, MailDev SMTP settings). Use `localhost` for hostnames.
4.  **Build and Run:**
    ```bash
    docker compose up --build -d
    ```
5.  **Access:**
    * Frontend: `http://localhost:80` (or the port mapped by Nginx)
    * Backend API (via proxy): `http://localhost/api/...`
    * MailDev (Email testing): `http://localhost:1080`
    * MinIO Console (File storage testing): `http://localhost:9001` (or the port configured)
6.  **Seed Database:** Connect to the local PostgreSQL container (e.g., using `psql` or a GUI tool) and run the `backend/db/seed.sql` script.

## Deployment (Render)

The application is deployed on Render using individual Web Services for the backend, frontend (Docker), and Nginx proxy, plus a managed PostgreSQL database.

* **Configuration:** Infrastructure is defined partly via `render.yaml` (for service structure) and environment variables/secrets set in the Render dashboard Environment section for the Blueprint.
* **Build:** Render builds the Docker images based on the Dockerfiles in the `backend/`, `frontend/`, and `nginx/` directories.
* **Networking:** The Nginx proxy service routes traffic to the internal hostnames of the frontend and backend services.
* **Custom Domain:** `answersdesk.org` is configured via Cloudflare DNS pointing to the Render Nginx service.
* **Secrets Management:** API keys (Resend, B2) and JWT secret are stored securely as environment variables in Render.

## Future Development Ideas

* **User Portal:** Allow end-users to log in and view their ticket history.
* **Knowledge Base Integration:** Link FAQs within ticket submission/viewing.
* **Reporting:** Add detailed reporting features for admins.
* **Real-time Updates:** Implement WebSockets for live dashboard notifications.
* **Improved Search:** Add full-text search capabilities.
* **Customizable Fields:** Allow admins to define custom ticket fields.

