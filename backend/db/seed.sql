-- Combined Schema Creation and Seed Data Script
-- ==========================================================================
-- WARNING: Run this on an empty database or after dropping existing tables.
-- This script replaces the individual migration files for development purposes.
-- **REVISED**: Removed ticket_id column from tasks table and related inserts.
-- ==========================================================================

BEGIN; -- Start transaction

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create ENUM types
CREATE TYPE user_role AS ENUM ('Staff', 'Admin');
CREATE TYPE ticket_status AS ENUM ('Unassigned', 'Assigned', 'In Progress', 'Closed');
CREATE TYPE ticket_urgency AS ENUM ('Low', 'Medium', 'High', 'Critical');
CREATE TYPE task_status AS ENUM ('Open', 'In Progress', 'Completed');

-- Create users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'Staff',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_users_email ON users(email);

-- Create tags table
CREATE TABLE tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create tickets table
CREATE TABLE tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_number SERIAL UNIQUE NOT NULL,
    end_user_email VARCHAR(255) NOT NULL,
    issue_type VARCHAR(100) NOT NULL,
    urgency ticket_urgency NOT NULL DEFAULT 'Medium',
    subject VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    status ticket_status NOT NULL DEFAULT 'Unassigned',
    assigned_to_user_id UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    resolution_notes TEXT
);
CREATE INDEX idx_tickets_status ON tickets(status);
CREATE INDEX idx_tickets_assigned_to ON tickets(assigned_to_user_id);
CREATE INDEX idx_tickets_end_user_email ON tickets(end_user_email);
CREATE INDEX idx_tickets_created_at ON tickets(created_at);
CREATE INDEX idx_tickets_ticket_number ON tickets(ticket_number);

-- Create ticket_updates table
CREATE TABLE ticket_updates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    comment TEXT NOT NULL,
    is_internal_note BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_ticket_updates_ticket_id ON ticket_updates(ticket_id);

-- Create tasks table (NO ticket_id column)
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_number SERIAL UNIQUE NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    status task_status NOT NULL DEFAULT 'Open',
    assigned_to_user_id UUID REFERENCES users(id),
    created_by_user_id UUID NOT NULL REFERENCES users(id),
    due_date TIMESTAMPTZ,
    is_recurring BOOLEAN NOT NULL DEFAULT FALSE,
    recurrence_rule VARCHAR(255),
    -- ticket_id column removed
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_assigned_to ON tasks(assigned_to_user_id);
CREATE INDEX idx_tasks_created_by ON tasks(created_by_user_id);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);
-- Removed index on ticket_id
CREATE INDEX idx_tasks_task_number ON tasks(task_number);

-- Create task_updates table
CREATE TABLE task_updates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    comment TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_task_updates_task_id ON task_updates(task_id);

-- Create attachments table
CREATE TABLE attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    storage_path VARCHAR(512) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    size BIGINT NOT NULL,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_attachments_ticket_id ON attachments(ticket_id);

-- Create faq_entries table
CREATE TABLE faq_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    question VARCHAR(500) NOT NULL,
    answer TEXT NOT NULL,
    category VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_faq_category ON faq_entries(category);
ALTER TABLE faq_entries ADD COLUMN search_vector tsvector
    GENERATED ALWAYS AS (to_tsvector('english', question || ' ' || answer)) STORED;
CREATE INDEX idx_faq_search ON faq_entries USING GIN(search_vector);

-- Create ticket_tags table
CREATE TABLE ticket_tags (
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (ticket_id, tag_id)
);
CREATE INDEX idx_ticket_tags_ticket_id ON ticket_tags(ticket_id);
CREATE INDEX idx_ticket_tags_tag_id ON ticket_tags(tag_id);


-- ==========================================================================
-- Seed Data
-- ==========================================================================

-- Insert Initial Users
INSERT INTO users (name, email, password_hash, role) VALUES
('Admin User', 'admin@example.com', '$2a$12$2JziQOW//48h3cL2IZLVf.5ehvVwzjF/G4KprN220GQMq5.BzfR6m', 'Admin'),
('Staff User', 'staff@example.com', '$2a$12$2JziQOW//48h3cL2IZLVf.5ehvVwzjF/G4KprN220GQMq5.BzfR6m', 'Staff');

-- Insert Initial Tags
INSERT INTO tags (name, created_at) VALUES
('printer', NOW()), ('vpn', NOW()), ('password-reset', NOW()), ('email', NOW()),
('hardware', NOW()), ('software', NOW()), ('network', NOW()), ('access', NOW()),
('urgent', NOW())
ON CONFLICT (name) DO NOTHING;


-- Declare variables for seed data IDs
DO $$
DECLARE
    admin_user_id UUID;
    staff_user_id UUID;
    ticket1_id UUID;
    ticket2_id UUID;
    ticket3_id UUID;
    ticket4_id UUID;
    task1_id UUID;
    task2_id UUID;
    task3_id UUID;
    tag_hardware_id UUID;
    tag_software_id UUID;
    tag_network_id UUID;
    tag_access_id UUID;
    tag_vpn_id UUID;
    tag_urgent_id UUID;
BEGIN
    -- Fetch existing user IDs
    SELECT id INTO admin_user_id FROM users WHERE email = 'admin@example.com' LIMIT 1;
    SELECT id INTO staff_user_id FROM users WHERE email = 'staff@example.com' LIMIT 1;

    -- Fetch existing tag IDs
    SELECT id INTO tag_hardware_id FROM tags WHERE name = 'hardware' LIMIT 1;
    SELECT id INTO tag_software_id FROM tags WHERE name = 'software' LIMIT 1;
    SELECT id INTO tag_network_id FROM tags WHERE name = 'network' LIMIT 1;
    SELECT id INTO tag_vpn_id FROM tags WHERE name = 'vpn' LIMIT 1;
    SELECT id INTO tag_access_id FROM tags WHERE name = 'access' LIMIT 1;
    SELECT id INTO tag_urgent_id FROM tags WHERE name = 'urgent' LIMIT 1;

    -- Insert Tickets and capture IDs directly
    INSERT INTO tickets (end_user_email, issue_type, urgency, subject, description, status, assigned_to_user_id, created_at, updated_at) VALUES
    ('alice@example.com', 'Hardware Issue', 'High', 'Laptop screen flickering', 'My laptop screen started flickering intermittently yesterday. It happens mostly when I move the lid.', 'Assigned', staff_user_id, NOW() - interval '3 days', NOW() - interval '1 day') RETURNING id INTO ticket1_id;

    INSERT INTO tickets (end_user_email, issue_type, urgency, subject, description, status, assigned_to_user_id, created_at, updated_at) VALUES
    ('bob@sample.org', 'Software Issue', 'Medium', 'Cannot install ProjectApp v2.1', 'Getting an error message "Installation failed: Missing dependency XYZ" when trying to install ProjectApp v2.1. Version 2.0 worked fine.', 'Unassigned', NULL, NOW() - interval '2 days', NOW() - interval '2 days') RETURNING id INTO ticket2_id;

    INSERT INTO tickets (end_user_email, issue_type, urgency, subject, description, status, assigned_to_user_id, created_at, updated_at) VALUES
    ('charlie@company.net', 'Network Access', 'Low', 'Need access to shared drive "Marketing"', 'Hi team, could I please get read/write access to the Marketing shared drive? My manager approved.', 'In Progress', staff_user_id, NOW() - interval '1 day', NOW()) RETURNING id INTO ticket3_id;

    INSERT INTO tickets (end_user_email, issue_type, urgency, subject, description, status, assigned_to_user_id, created_at, updated_at) VALUES
    ('alice@example.com', 'Software Issue', 'Critical', 'System Crash - Blue Screen Error', 'My main workstation just crashed with a blue screen (BSOD). Error code STOP 0x000000FE. Cannot reboot.', 'Assigned', admin_user_id, NOW() - interval '2 hours', NOW() - interval '1 hour') RETURNING id INTO ticket4_id;

    -- Insert Ticket Updates
    INSERT INTO ticket_updates (ticket_id, user_id, comment, is_internal_note, created_at) VALUES
    (ticket1_id, staff_user_id, 'Checking the display drivers and connection cable.', false, NOW() - interval '23 hours'),
    (ticket1_id, staff_user_id, 'Driver update didn''t fix it. Might be a loose cable or hardware fault. Will schedule a checkup.', true, NOW() - interval '5 hours'),
    (ticket1_id, NULL, 'Status changed from Assigned to In Progress', false, NOW() - interval '4 hours'),
    (ticket3_id, staff_user_id, 'Forwarded request to the network team for approval.', false, NOW() - interval '23 hours'),
    (ticket3_id, admin_user_id, 'Access granted by Network Admin.', true, NOW() - interval '2 hours'),
    (ticket4_id, admin_user_id, 'Received the crash report. Investigating the stop code.', false, NOW() - interval '55 minutes');

    -- Insert Tasks (Omitting task_number, Omitting ticket_id)
    INSERT INTO tasks (title, description, status, assigned_to_user_id, created_by_user_id, due_date, is_recurring, recurrence_rule, created_at, updated_at) VALUES
    ('Order replacement screen for Alice', 'Order compatible screen for Dell XPS 13 model 9310. Check warranty status first.', 'Open', staff_user_id, admin_user_id, NOW() + interval '5 days', false, NULL, NOW() - interval '4 hours', NOW() - interval '4 hours') RETURNING id INTO task1_id;

    INSERT INTO tasks (title, description, status, assigned_to_user_id, created_by_user_id, due_date, is_recurring, recurrence_rule, created_at, updated_at) VALUES
    ('Prepare Q3 Server Maintenance Plan', 'Draft plan for patching production servers during the Q3 maintenance window. Include rollback steps.', 'In Progress', admin_user_id, admin_user_id, NOW() + interval '10 days', false, NULL, NOW() - interval '1 day', NOW()) RETURNING id INTO task2_id;

    INSERT INTO tasks (title, description, status, assigned_to_user_id, created_by_user_id, due_date, is_recurring, recurrence_rule, created_at, updated_at) VALUES
    ('Follow up with Charlie about Marketing drive access', 'Confirm if the access granted yesterday is working as expected.', 'Open', staff_user_id, staff_user_id, NOW() + interval '1 day', false, NULL, NOW(), NOW()) RETURNING id INTO task3_id;

    -- Insert Task Updates
    INSERT INTO task_updates (task_id, user_id, comment, created_at) VALUES
    (task2_id, admin_user_id, 'Initial draft complete. Sent for review.', NOW() - interval '1 hour');

    -- Insert FAQ Entries
    INSERT INTO faq_entries (question, answer, category, created_at, updated_at) VALUES
    ('How do I reset my network password?', 'You can reset your password via the self-service portal at [link] or contact the helpdesk at x1234.', 'Passwords', NOW() - interval '10 days', NOW() - interval '5 days'),
    ('How do I request VPN access?', 'Please submit a ticket under the "Network Access" category, including manager approval if required for specific resources.', 'VPN & Remote Access', NOW() - interval '10 days', NOW() - interval '10 days'),
    ('My printer shows "Offline". What should I do?', '1. Check if the printer is turned on and connected to the network cable. 2. Restart the printer. 3. Restart your computer. 4. If the issue persists, submit a ticket with the printer model and location.', 'Printers', NOW() - interval '9 days', NOW() - interval '9 days');

    -- Link Tags to Tickets
    INSERT INTO ticket_tags (ticket_id, tag_id) VALUES
    (ticket1_id, tag_hardware_id),
    (ticket2_id, tag_software_id),
    (ticket3_id, tag_access_id),
    (ticket3_id, tag_network_id),
    (ticket4_id, tag_hardware_id),
    (ticket4_id, tag_urgent_id);

    -- Insert Dummy Attachment Records
    INSERT INTO attachments (ticket_id, filename, storage_path, mime_type, size, uploaded_at) VALUES
    (ticket1_id, 'flicker_video.mov', 'tickets/placeholder/flicker_video.mov', 'video/quicktime', 50123456, NOW() - interval '3 days'),
    (ticket4_id, 'bsod_photo.jpg', 'tickets/placeholder/bsod_photo.jpg', 'image/jpeg', 2048576, NOW() - interval '1 hour');

END $$;

COMMIT; -- End transaction

