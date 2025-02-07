-- Drop triggers
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
DROP TRIGGER IF EXISTS update_tickets_updated_at ON tickets;
DROP TRIGGER IF EXISTS update_tasks_updated_at ON tasks;
DROP TRIGGER IF EXISTS update_ticket_solutions_updated_at ON ticket_solutions;
DROP TRIGGER IF EXISTS update_solutions_updated_at ON solutions;

-- Drop function
DROP FUNCTION IF EXISTS update_updated_at_column();

-- Drop tables in correct order to handle foreign key dependencies
DROP TABLE IF EXISTS task_history;
DROP TABLE IF EXISTS ticket_history;
DROP TABLE IF EXISTS ticket_solutions;
DROP TABLE IF EXISTS email_solutions_history;
DROP TABLE IF EXISTS tasks;
DROP TABLE IF EXISTS tickets;
DROP TABLE IF EXISTS solutions;
DROP TABLE IF EXISTS users;

-- Drop sequences
DROP SEQUENCE IF EXISTS ticket_number_seq;

-- Drop extensions
DROP EXTENSION IF EXISTS "uuid-ossp";