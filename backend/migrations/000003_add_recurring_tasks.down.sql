-- Drop indexes first
DROP INDEX IF EXISTS idx_tasks_next_occurrence;
DROP INDEX IF EXISTS idx_tasks_recurring_type;

-- Remove recurring task columns
ALTER TABLE tasks
DROP COLUMN IF EXISTS due_date,
DROP COLUMN IF EXISTS is_recurring,
DROP COLUMN IF EXISTS recurring_type,
DROP COLUMN IF EXISTS recurring_parent,
DROP COLUMN IF EXISTS next_occurrence;