-- Ensure uuid-ossp extension is created (usually done in 000001)
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp"; 

CREATE TYPE ticket_status AS ENUM ('Unassigned', 'Assigned', 'In Progress', 'Closed');
CREATE TYPE ticket_urgency AS ENUM ('Low', 'Medium', 'High', 'Critical');

CREATE TABLE tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    issue_type VARCHAR(100) NOT NULL,
    urgency ticket_urgency NOT NULL DEFAULT 'Medium',
    subject VARCHAR(200) NOT NULL,
    body TEXT NOT NULL,
    status ticket_status NOT NULL DEFAULT 'Unassigned',
    assigned_to_user_id UUID REFERENCES users(id), 
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    resolution_notes TEXT
);

-- Indexes for common queries
CREATE INDEX idx_tickets_status ON tickets(status);
CREATE INDEX idx_tickets_assigned_to ON tickets(assigned_to_user_id);
CREATE INDEX idx_tickets_end_user_email ON tickets(end_user_email);
CREATE INDEX idx_tickets_created_at ON tickets(created_at);

-- Create ticket updates table for comments and history
CREATE TABLE ticket_updates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), 
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id), 
    comment TEXT NOT NULL,
    is_internal_note BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ticket_updates_ticket_id ON ticket_updates(ticket_id);