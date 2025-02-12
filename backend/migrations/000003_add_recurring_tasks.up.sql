-- Add recurring task fields to tasks table
ALTER TABLE tasks
ADD COLUMN due_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN is_recurring BOOLEAN DEFAULT FALSE,
ADD COLUMN recurring_type VARCHAR(20),
ADD COLUMN recurring_parent INTEGER REFERENCES tasks(id),
ADD COLUMN next_occurrence TIMESTAMP WITH TIME ZONE;

-- Create index on next_occurrence for efficient scheduling queries
CREATE INDEX idx_tasks_next_occurrence ON tasks(next_occurrence) WHERE next_occurrence IS NOT NULL;

-- Create index on recurring_type for filtering recurring tasks
CREATE INDEX idx_tasks_recurring_type ON tasks(recurring_type) WHERE recurring_type IS NOT NULL;