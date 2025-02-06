-- Insert admin user
INSERT INTO users (name, email, password, role)
VALUES ('Admin User', 'admin@busitticket.com',
        '$2a$10$/3R2Ldhwt/oVRxM6I9paLuZgEsZHLX64Rlv6rNqR75vex3ehl9i5y', -- password is 'admin123'
        'admin');

-- Insert staff users
INSERT INTO users (name, email, password, role)
VALUES 
    ('John Smith', 'john.smith@busitticket.com',
     '$2a$10$jINNGmtL/Yuh8GwiY76Eueo.TGgACW7BQvM6LH/KLTrMidWky0xtS', -- password is 'staff123'
     'staff'),
    ('Jane Doe', 'jane.doe@busitticket.com',
     '$2a$10$jINNGmtL/Yuh8GwiY76Eueo.TGgACW7BQvM6LH/KLTrMidWky0xtS', -- password is 'staff123'
     'staff');

-- Insert sample tickets
INSERT INTO tickets (category, description, status, submitter_email, assigned_to)
VALUES
    ('Hardware', 'My laptop won''t turn on', 'open', 'employee@company.com', 2),
    ('Software', 'Need Microsoft Office installed', 'in_progress', 'manager@company.com', 3),
    ('Network', 'Cannot connect to WiFi', 'resolved', 'user@company.com', 2);

-- Insert sample ticket solutions
INSERT INTO ticket_solutions (category, title, description, created_by)
VALUES
    ('Hardware', 'Common Laptop Power Issues', 
     'Check power cable connection\nEnsure battery is properly seated\nTry a different power outlet\nCheck if battery needs replacement',
     1),
    ('Software', 'Standard Software Installation Guide',
     'Use Software Center for installation\nEnsure proper licenses are available\nFollow company installation guidelines\nTest functionality after installation',
     1),
    ('Network', 'WiFi Connectivity Troubleshooting',
     'Check WiFi is enabled\nForget and reconnect to network\nRestart device\nVerify network credentials',
     1);

-- Insert ticket history for resolved ticket
INSERT INTO ticket_history (ticket_id, user_id, action, notes)
VALUES
    (3, 2, 'created', 'Ticket created'),
    (3, 2, 'assigned', 'Assigned to John Smith'),
    (3, 2, 'in_progress', 'Working on resolution'),
    (3, 2, 'resolved', 'Issue resolved: Reset network adapter and reconnected successfully');

-- Insert sample tasks
INSERT INTO tasks (title, description, priority, status, created_by, assigned_to)
VALUES
    ('Update software inventory', 'Create a spreadsheet of all installed software and licenses', 'high', 'todo', 1, 2),
    ('Hardware audit', 'Perform quarterly hardware audit for all departments', 'medium', 'in_progress', 1, 3),
    ('Network maintenance', 'Schedule and perform routine network maintenance', 'low', 'done', 1, 2);

-- Insert task history
INSERT INTO task_history (task_id, user_id, action, notes)
VALUES
    (1, 1, 'created', 'Task created and assigned to John'),
    (2, 1, 'created', 'Task created and assigned to Jane'),
    (2, 3, 'status_changed', 'Started working on the audit'),
    (3, 1, 'created', 'Task created'),
    (3, 2, 'status_changed', 'Completed maintenance tasks'),
    (3, 2, 'status_changed', 'Marked as done after verification');