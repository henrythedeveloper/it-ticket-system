-- Insert admin user (password: admin123)
INSERT INTO users (name, email, password, role)
VALUES (
    'Admin User',
    'admin@helpdesk.local',
    '$2a$10$zYeHvhbXb9bPaFWEqK9KOeWAg9RNbG9f4Qj1hj6KNJ6hrNlyfI4c2', -- hashed password
    'admin'
) ON CONFLICT DO NOTHING;

-- Insert test staff user (password: staff123)
INSERT INTO users (name, email, password, role)
VALUES (
    'Staff User',
    'staff@helpdesk.local',
    '$2a$10$BZx1bIwBEg1HqK9WDHJ7NOl5f4JR0weYUHxIYxAWK4hI2f8F.ThGC', -- hashed password
    'staff'
) ON CONFLICT DO NOTHING;

-- Insert sample tickets
INSERT INTO tickets (category, description, status, submitter_email)
VALUES
    ('network', 'Cannot connect to office WiFi', 'open', 'john@example.com'),
    ('hardware', 'My laptop screen is flickering', 'open', 'sarah@example.com'),
    ('software', 'Need Microsoft Office installation', 'in_progress', 'mike@example.com'),
    ('access', 'Please grant access to shared drive', 'resolved', 'lisa@example.com')
ON CONFLICT DO NOTHING;

-- Insert sample tasks
INSERT INTO tasks (title, description, priority, status, created_by)
SELECT 
    'Set up new employee laptops',
    'Configure 5 new laptops for incoming developers',
    'high',
    'todo',
    id
FROM users 
WHERE email = 'admin@helpdesk.local'
ON CONFLICT DO NOTHING;

INSERT INTO tasks (title, description, priority, status, created_by)
SELECT 
    'Update network security policy',
    'Review and update network security policies and procedures',
    'medium',
    'in_progress',
    id
FROM users 
WHERE email = 'admin@helpdesk.local'
ON CONFLICT DO NOTHING;

-- Assign some tickets to staff
UPDATE tickets 
SET assigned_to = (SELECT id FROM users WHERE email = 'staff@helpdesk.local')
WHERE status = 'in_progress';