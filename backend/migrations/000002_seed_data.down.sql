-- Delete all data in correct order to handle foreign key constraints
DELETE FROM task_history;
DELETE FROM ticket_history;
DELETE FROM tasks;
DELETE FROM ticket_solutions;
DELETE FROM tickets;
DELETE FROM users;

-- Reset sequences
ALTER SEQUENCE tasks_id_seq RESTART WITH 1;
ALTER SEQUENCE tickets_id_seq RESTART WITH 1;
ALTER SEQUENCE users_id_seq RESTART WITH 1;
ALTER SEQUENCE ticket_solutions_id_seq RESTART WITH 1;
ALTER SEQUENCE ticket_number_seq RESTART WITH 1;
ALTER SEQUENCE ticket_history_id_seq RESTART WITH 1;
ALTER SEQUENCE task_history_id_seq RESTART WITH 1;