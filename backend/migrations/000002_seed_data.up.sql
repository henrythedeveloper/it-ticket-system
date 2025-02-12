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

-- Insert common solutions
INSERT INTO solutions (title, description, category) VALUES
('Reset Password', 'Try resetting your password by clicking the "Forgot Password" link on the login page.', 'access'),
('Clear Browser Cache', 'Clear your browser cache and cookies, then restart the browser.', 'software'),
('Check Network Connection', 'Ensure your device is properly connected to the network and try restarting your router.', 'network'),
('Update Browser', 'Make sure you are using the latest version of your web browser.', 'software'),
('Check System Requirements', 'Verify that your system meets the minimum requirements for the software.', 'software'),
('Reconnect Peripherals', 'Try unplugging and reconnecting your keyboard, mouse, or other peripherals.', 'hardware'),
('Run Windows Update', 'Check for and install any pending Windows updates.', 'software'),
('Disk Cleanup', 'Run disk cleanup to free up space and improve system performance.', 'hardware'),
('Check Firewall Settings', 'Verify that the firewall is not blocking the required application or service.', 'network'),
('Update Drivers', 'Download and install the latest drivers for your hardware devices.', 'hardware');

-- Insert sample tickets
INSERT INTO tickets (category, description, status, submitter_email, assigned_to, urgency, due_date)
VALUES
    ('Hardware', 'My laptop won''t turn on', 'open', 'employee@company.com', 2, 'critical', NOW() + INTERVAL '1 day'),
    ('Software', 'Need Microsoft Office installed', 'in_progress', 'manager@company.com', 3, 'normal', NOW() + INTERVAL '3 days'),
    ('Network', 'Cannot connect to WiFi', 'resolved', 'user@company.com', 2, 'high', NOW() - INTERVAL '1 day');

-- Insert comprehensive ticket solutions
INSERT INTO ticket_solutions (category, title, description, created_by)
VALUES
    -- Hardware Solutions
    ('hardware', 'Common Laptop Power Issues', 
     '1. Check power cable connection is secure
2. Ensure battery is properly seated
3. Try a different power outlet
4. Hold power button for 30 seconds
5. Check if battery needs replacement
6. Remove battery and try direct power
7. Check for physical damage to power port',
     1),
    ('hardware', 'Monitor Display Problems',
     '1. Check monitor power connection
2. Verify cable connections (HDMI/DisplayPort)
3. Test with different cable
4. Try monitor with different computer
5. Check display settings in Windows
6. Update graphics drivers
7. Test different display port on computer',
     1),
    ('hardware', 'Printer Issues',
     '1. Check printer power and connections
2. Verify paper feed and ink/toner levels
3. Clear paper jams
4. Restart printer
5. Remove and re-add printer in Windows
6. Update printer drivers
7. Check network connection for network printers',
     1),

    -- Software Solutions
    ('software', 'Standard Software Installation Guide',
     '1. Use Software Center for approved applications
2. Ensure proper licenses are available
3. Close all running applications
4. Run installer as administrator
5. Follow company installation guidelines
6. Test functionality after installation
7. Contact IT if additional configuration needed',
     1),
    ('software', 'Common Application Crashes',
     '1. Save work and restart application
2. Update application to latest version
3. Clear application cache/temporary files
4. Check system requirements
5. Scan for malware
6. Update Windows
7. Reinstall application if persistent',
     1),
    ('software', 'Windows Updates Troubleshooting',
     '1. Check internet connection
2. Run Windows Update troubleshooter
3. Clear Windows Update cache
4. Check disk space
5. Disable antivirus temporarily
6. Run system file checker (sfc /scannow)
7. Reset Windows Update components',
     1),

    -- Network Solutions
    ('network', 'WiFi Connectivity Troubleshooting',
     '1. Check WiFi is enabled on device
2. Forget and reconnect to network
3. Restart device
4. Verify network credentials
5. Check signal strength
6. Reset network adapter
7. Update network drivers',
     1),
    ('network', 'VPN Connection Issues',
     '1. Verify internet connection
2. Check VPN credentials
3. Clear VPN client cache
4. Disable firewall temporarily
5. Update VPN client
6. Check if VPN server is operational
7. Try alternate VPN server',
     1),
    ('network', 'Slow Internet Performance',
     '1. Run speed test
2. Check other devices
3. Reset network equipment
4. Scan for malware
5. Check background downloads
6. Update network drivers
7. Contact ISP if persistent',
     1),

    -- Access Solutions
    ('access', 'Account Login Problems',
     '1. Verify username and password
2. Check CAPS LOCK is off
3. Clear browser cache
4. Try different browser
5. Reset password if needed
6. Check account is not locked
7. Contact IT for account status',
     1),
    ('access', 'File Share Access Issues',
     '1. Verify network connection
2. Check share permissions
3. Map network drive again
4. Use full UNC path
5. Ensure group membership
6. Restart computer
7. Contact IT for permission review',
     1),
    ('access', 'Email Access Problems',
     '1. Check internet connection
2. Verify email credentials
3. Clear email client cache
4. Test webmail access
5. Check mailbox quota
6. Update email client
7. Reset email profile',
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