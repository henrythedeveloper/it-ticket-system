# IT Helpdesk Ticketing System

## Overview

This project is a web-based IT Helpdesk Ticketing System designed to streamline the process of submitting, tracking, and managing IT support requests and internal tasks within an organization. It provides a user-friendly interface for end-users to submit tickets and a more comprehensive dashboard for IT staff and administrators to manage tickets, tasks, users, and FAQs.

## Purpose

The primary goals of this system are:

* **Centralize Support Requests:** Provide a single point of entry for all IT support needs.
* **Improve Tracking & Visibility:** Allow users and staff to easily track the status and history of support tickets and tasks.
* **Enhance Efficiency:** Enable IT staff to manage their workload effectively through assignments, status updates, and internal task management.
* **Facilitate Communication:** Capture communication history through comments and updates on tickets and tasks.
* **Knowledge Sharing:** Provide a simple FAQ management system for common issues.

## Features

* **Ticket Management:**
    * End-user ticket submission (public endpoint).
    * Ticket viewing, filtering (by status, urgency, assignee, tags, etc.), and searching.
    * Ticket assignment to staff members.
    * Status updates (Unassigned, Assigned, In Progress, Closed).
    * Adding public/internal comments and updates.
    * File attachments (upload, download).
    * Tagging for categorization.
* **Task Management:**
    * Internal task creation, assignment, and tracking for IT staff.
    * Task status updates (Open, In Progress, Completed).
    * Due dates and optional recurrence rules.
    * Adding comments/updates to tasks.
* **User Management (Admin):**
    * User creation, viewing, updating, and deletion.
    * Role-based access control (Admin, Staff).
* **FAQ Management (Admin):**
    * Create, Read, Update, Delete (CRUD) operations for FAQ entries.
    * Categorization of FAQs.
* **Authentication:** JWT-based authentication for staff/admin access.

## System Architecture

The system follows a standard client-server architecture:

1.  **Frontend:** A single-page application (SPA) built with **React**. It provides the user interface for both end-users (ticket submission) and authenticated staff/admins (management dashboards). It communicates with the backend via a REST API.
2.  **Backend:** A RESTful API server built with **Go** using the **Echo** framework. It handles:
    * Business logic for tickets, tasks, users, etc.
    * API request handling and validation.
    * Authentication (JWT generation/validation).
    * Database interactions.
    * Email notifications.
    * Interaction with the file storage service.
3.  **Database:** A **PostgreSQL** database stores all persistent data, including users, tickets, tasks, tags, FAQs, comments, and attachment metadata. Database migrations are managed using `golang-migrate`.
4.  **File Storage:** An **S3-compatible** object storage service (like AWS S3 or **MinIO** for local development) stores uploaded file attachments.
5.  **Email Service:** An external email service (like **Resend**) is used to send notifications (e.g., ticket confirmation, closure, task assignment).

*(A visual diagram representing this architecture could be added here separately if desired.)*

## Tech Stack

* **Frontend:** React, Javascript, HTML, CSS (Tailwind CSS likely, based on common practices)
* **Backend:** Go, Echo Framework
* **Database:** PostgreSQL
* **File Storage:** MinIO (or any S3-compatible service)
* **Authentication:** JWT (JSON Web Tokens)
* **Database Migrations:** golang-migrate
* **Containerization:** Docker, Docker Compose

## Backend Structure (Refactored)

The Go backend code is organized as follows:

* `cmd/server/main.go`: Entry point for the application, initializes services and starts the server.
* `internal/api/`: Contains the API server setup (`server.go`), handlers, and middleware.
    * `handlers/`: Request handlers organized by resource type (faq, tag, task, ticket, user). Each handler package contains:
        * `base.go`: Handler struct definition and route registration.
        * `*.go`: Files implementing specific CRUD operations (e.g., `create.go`, `query.go`, `update.go`).
        * `utils.go` (optional): Helper functions specific to the handler.
    * `middleware/auth/`: Authentication middleware (JWT validation, Admin checks).
* `internal/auth/`: Core authentication service logic (password hashing, JWT generation/validation).
* `internal/config/`: Configuration loading from environment variables.
* `internal/db/`: Database connection management and migration execution.
* `internal/email/`: Email sending service implementation and templates.
* `internal/file/`: File storage service implementation (S3/MinIO).
* `internal/models/`: Core data structures (structs) and enums used across the application.
* `migrations/`: SQL files for database schema migrations.

## Setup & Running

The application is designed to be run using Docker Compose.

1.  **Prerequisites:**
    * Docker
    * Docker Compose
2.  **Configuration:**
    * Create a `.env` file in the `backend` directory.
    * Populate the `.env` file with the required environment variables (refer to `internal/config/config.go` for the list, including database credentials, JWT secret, S3/MinIO details, email settings, etc.).
3.  **Build & Run:**
    * Navigate to the project's root directory (where the `docker-compose.yml` file is located).
    * Run the command: `docker-compose up --build -d`
4.  **Access:**
    * The frontend should be accessible at `http://localhost:3000` (or the port configured for the frontend service).
    * The backend API will be running internally, accessible by the frontend via the Docker network, typically on port 8080 within the container.

*(Note: Adjust ports and URLs based on your specific `docker-compose.yml` configuration if different from standard defaults.)*
