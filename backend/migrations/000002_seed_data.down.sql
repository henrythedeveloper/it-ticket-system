-- Remove sample data in reverse order of dependencies

-- Remove ticket assignments
UPDATE tickets SET assigned_to = NULL;

-- Remove tasks
DELETE FROM tasks 
WHERE title IN (
    'Set up new employee laptops',
    'Update network security policy'
);

-- Remove sample tickets
DELETE FROM tickets 
WHERE submitter_email IN (
    'john@example.com',
    'sarah@example.com',
    'mike@example.com',
    'lisa@example.com'
);

-- Remove test users
DELETE FROM users 
WHERE email IN (
    'admin@helpdesk.local',
    'staff@helpdesk.local'
);