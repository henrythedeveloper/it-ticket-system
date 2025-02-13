ALTER TABLE tasks
ADD COLUMN recurrence_type VARCHAR(20) CHECK (recurrence_type IN ('none', 'daily', 'weekly', 'monthly', 'yearly')),
ADD COLUMN recurrence_interval INTEGER DEFAULT 1,
ADD COLUMN recurrence_end_date TIMESTAMP,
ADD COLUMN parent_task_id INTEGER REFERENCES tasks(id),
ADD COLUMN next_occurrence TIMESTAMP;

-- Update existing tasks to have 'none' as recurrence_type
UPDATE tasks SET recurrence_type = 'none' WHERE recurrence_type IS NULL;

-- Make recurrence_type NOT NULL after setting default value
ALTER TABLE tasks ALTER COLUMN recurrence_type SET NOT NULL;