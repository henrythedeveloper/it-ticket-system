-- Delete data in reverse order of dependencies
DELETE FROM task_history;
DELETE FROM tasks;
DELETE FROM recurring_tasks;
DELETE FROM ticket_history;
DELETE FROM email_solutions_history;
DELETE FROM ticket_solutions;
DELETE FROM tickets;
DELETE FROM solutions;
DELETE FROM users;