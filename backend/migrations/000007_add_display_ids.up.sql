-- File: backend/migrations/000007_add_display_ids.up.sql

-- Add sequential number to tickets table
ALTER TABLE tickets
ADD COLUMN ticket_number SERIAL UNIQUE NOT NULL; 
-- SERIAL automatically creates a sequence and makes it increment
-- UNIQUE ensures no two tickets get the same display number (important!)
-- NOT NULL ensures it always has a value

-- Backfill existing tickets with sequential numbers based on creation date
WITH numbered_tickets AS (
    SELECT 
        id, 
        ROW_NUMBER() OVER (ORDER BY created_at ASC) as rn 
    FROM tickets
)
UPDATE tickets t
SET ticket_number = nt.rn
FROM numbered_tickets nt
WHERE t.id = nt.id;

-- Add sequential number to tasks table
ALTER TABLE tasks
ADD COLUMN task_number SERIAL UNIQUE NOT NULL; 
-- Add the new column similar to tickets

-- Backfill existing tasks with sequential numbers based on creation date
WITH numbered_tasks AS (
    SELECT 
        id, 
        ROW_NUMBER() OVER (ORDER BY created_at ASC) as rn 
    FROM tasks
)
UPDATE tasks t
SET task_number = nt.rn
FROM numbered_tasks nt
WHERE t.id = nt.id;


-- Optionally, add index if you query by ticket_number or task_number often
-- CREATE INDEX idx_tickets_ticket_number ON tickets(ticket_number);
-- CREATE INDEX idx_tasks_task_number ON tasks(task_number);

-- Note: If you also want this for Attachments, add similar ALTER TABLE and UPDATE blocks here.