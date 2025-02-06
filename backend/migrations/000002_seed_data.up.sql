-- First clear existing data
TRUNCATE tasks CASCADE;
TRUNCATE tickets CASCADE;
TRUNCATE users CASCADE;

-- Add ticket number column and trigger
ALTER TABLE tickets 
ADD COLUMN IF NOT EXISTS ticket_number VARCHAR(20) UNIQUE;

CREATE OR REPLACE FUNCTION generate_ticket_number()
RETURNS TRIGGER AS $$
BEGIN
    NEW.ticket_number := 'TKT-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || 
                        LPAD(CAST(NEXTVAL('tickets_id_seq') AS TEXT), 4, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_ticket_number
    BEFORE INSERT ON tickets
    FOR EACH ROW
    EXECUTE FUNCTION generate_ticket_number();

-- Insert users with new hashes (replace these hashes with the ones generated from the Go script)
INSERT INTO users (name, email, password, role)
VALUES (
    'Admin User',
    'admin@helpdesk.local',
    '$2a$10$PBgo9JdCGBnaW6s1twmKgeC7dOR7lAZ81iDehZUX3OOm6JmMZlkZW',
    'admin'
);

INSERT INTO users (name, email, password, role)
VALUES (
    'Staff User',
    'staff@helpdesk.local',
    '$2a$10$PBgo9JdCGBnaW6s1twmKgeC7dOR7lAZ81iDehZUX3OOm6JmMZlkZW',
    'staff'
);

-- Insert sample tickets
INSERT INTO tickets (category, description, status, submitter_email)
VALUES
    ('network', 'Cannot connect to office WiFi', 'open', 'john@example.com'),
    ('hardware', 'My laptop screen is flickering', 'open', 'sarah@example.com'),
    ('software', 'Need Microsoft Office installation', 'in_progress', 'mike@example.com'),
    ('access', 'Please grant access to shared drive', 'resolved', 'lisa@example.com');

-- Insert sample tasks
INSERT INTO tasks (title, description, priority, status, created_by)
SELECT
    'Set up new employee laptops',
    'Configure 5 new laptops for incoming developers',
    'high',
    'todo',
    id
FROM users
WHERE email = 'admin@helpdesk.local';

INSERT INTO tasks (title, description, priority, status, created_by)
SELECT
    'Update network security policy',
    'Review and update network security policies and procedures',
    'medium',
    'in_progress',
    id
FROM users
WHERE email = 'admin@helpdesk.local';

-- Assign tickets to staff
UPDATE tickets
SET assigned_to = (SELECT id FROM users WHERE email = 'staff@helpdesk.local')
WHERE status = 'in_progress';