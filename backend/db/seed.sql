-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL, -- 'Admin', 'Staff', 'User'
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Tags table
CREATE TABLE tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) UNIQUE NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Tickets table
CREATE TABLE tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_number SERIAL UNIQUE NOT NULL,
    submitter_name VARCHAR(100),
    end_user_email VARCHAR(255) NOT NULL,
    issue_type VARCHAR(100),
    urgency VARCHAR(20) NOT NULL, -- 'Low', 'Medium', 'High', 'Critical'
    subject VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(20) NOT NULL, -- 'Open', 'In Progress', 'Closed'
    assigned_to_user_id UUID REFERENCES users(id),
    submitter_id UUID REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMP,
    resolution_notes TEXT
);

-- Ticket-Tag join table (many-to-many)
CREATE TABLE ticket_tags (
    ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
    tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (ticket_id, tag_id)
);

-- Ticket updates (comments, status changes)
CREATE TABLE ticket_updates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    comment TEXT NOT NULL,
    is_internal_note BOOLEAN NOT NULL DEFAULT FALSE,
    is_system_update BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Attachments
CREATE TABLE attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    storage_path VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    size BIGINT NOT NULL,
    uploaded_at TIMESTAMP NOT NULL DEFAULT NOW(),
    url VARCHAR(255)
);

-- FAQ entries
CREATE TABLE faqs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    category VARCHAR(100) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Notifications
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    related_ticket_id UUID REFERENCES tickets(id),
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Users table
INSERT INTO users (id, name, email, password_hash, role, created_at, updated_at)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'Alice Admin', 'admin@example.com', '$2a$12$g/oVUahtVD05SCL/ywPUceXaCKOp4q7pMStPt/81qO1BkZcDulUSq', 'Admin', NOW(), NOW()),
  ('22222222-2222-2222-2222-222222222222', 'Bob Staff', 'staff@example.com', '$2a$12$g/oVUahtVD05SCL/ywPUceXaCKOp4q7pMStPt/81qO1BkZcDulUSq', 'Staff', NOW(), NOW());

-- Tags table
INSERT INTO tags (id, name, created_at) VALUES
  ('aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Network', NOW()),
  ('aaaaaaa2-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Hardware', NOW());

-- Tickets table
INSERT INTO tickets (id, ticket_number, submitter_name, end_user_email, issue_type, urgency, subject, description, status, assigned_to_user_id, submitter_id, created_at, updated_at, closed_at, resolution_notes)
VALUES
  ('bbbbbbb1-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 1001, 'Charlie', 'charlie@example.com', 'Printer', 'High', 'Printer not working', 'The printer in room 101 is jammed.', 'Open', '22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', NOW(), NOW(), NULL, NULL),
  ('bbbbbbb2-bbbb-bbbb-bbbb-bbbbbbbbbbbc', 1002, 'Dana', 'dana@example.com', 'Network', 'Medium', 'WiFi issues', 'Cannot connect to WiFi in conference room.', 'In Progress', '22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', NOW(), NOW(), NULL, NULL),
  -- Assigned to Alice Admin
  ('bbbbbbb3-bbbb-bbbb-bbbb-bbbbbbbbbbbd', 1003, 'Eve', 'eve@example.com', 'Software', 'Low', 'Software update needed', 'Please update the accounting software.', 'Open', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', NOW(), NOW(), NULL, NULL),
  ('bbbbbbb4-bbbb-bbbb-bbbb-bbbbbbbbbbbe', 1004, 'Frank', 'frank@example.com', 'Hardware', 'Critical', 'Server down', 'The main server is not responding.', 'In Progress', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', NOW(), NOW(), NULL, NULL),
  -- Unassigned ticket
  ('bbbbbbb5-bbbb-bbbb-bbbb-bbbbbbbbbbbf', 1005, 'Grace', 'grace@example.com', 'Network', 'High', 'VPN not working', 'Cannot connect to VPN from home.', 'Open', NULL, '11111111-1111-1111-1111-111111111111', NOW(), NOW(), NULL, NULL);

-- Ticket-Tag join table
INSERT INTO ticket_tags (ticket_id, tag_id) VALUES
  ('bbbbbbb1-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'aaaaaaa2-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  ('bbbbbbb2-bbbb-bbbb-bbbb-bbbbbbbbbbbc', 'aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaaa');

-- Ticket updates
INSERT INTO ticket_updates (id, ticket_id, user_id, comment, is_internal_note, is_system_update, created_at)
VALUES
  ('ccccccc1-cccc-cccc-cccc-cccccccccccc', 'bbbbbbb1-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'Checked the printer, waiting for parts.', FALSE, FALSE, NOW()),
  ('ccccccc2-cccc-cccc-cccc-cccccccccccd', 'bbbbbbb2-bbbb-bbbb-bbbb-bbbbbbbbbbbc', '11111111-1111-1111-1111-111111111111', 'Investigating WiFi issue.', TRUE, FALSE, NOW());

-- FAQ entries
INSERT INTO faqs (id, question, answer, category, created_at, updated_at)
VALUES
  ('eeeeeee1-eeee-eeee-eeee-eeeeeeeeeeee', 'How to reset your password?', 'Click on Forgot Password on the login page.', 'Account', NOW(), NOW());

-- Notifications
INSERT INTO notifications (id, user_id, type, message, related_ticket_id, is_read, created_at)
VALUES
  ('fffffff1-ffff-ffff-ffff-ffffffffffff', '22222222-2222-2222-2222-222222222222', 'TicketAssigned', 'You have been assigned a new ticket.', 'bbbbbbb1-bbbb-bbbb-bbbb-bbbbbbbbbbbb', FALSE, NOW());