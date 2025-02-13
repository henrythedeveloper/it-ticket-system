ALTER TABLE tasks
DROP COLUMN recurrence_type,
DROP COLUMN recurrence_interval,
DROP COLUMN recurrence_end_date,
DROP COLUMN parent_task_id,
DROP COLUMN next_occurrence;