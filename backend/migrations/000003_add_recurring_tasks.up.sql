-- Create recurring_tasks table
CREATE TABLE IF NOT EXISTS recurring_tasks (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    priority VARCHAR(50) NOT NULL,
    frequency VARCHAR(50) NOT NULL, -- daily, weekly, monthly, etc.
    next_run TIMESTAMP WITH TIME ZONE NOT NULL,
    assigned_to INTEGER REFERENCES users(id),
    created_by INTEGER NOT NULL REFERENCES users(id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Add due_date to tasks table if not exists
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS due_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS recurring_task_id INTEGER REFERENCES recurring_tasks(id);

-- Create trigger for recurring_tasks updated_at
CREATE TRIGGER update_recurring_tasks_updated_at
    BEFORE UPDATE ON recurring_tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_recurring_tasks_next_run ON recurring_tasks(next_run);
CREATE INDEX IF NOT EXISTS idx_recurring_tasks_frequency ON recurring_tasks(frequency);
CREATE INDEX IF NOT EXISTS idx_recurring_tasks_assigned_to ON recurring_tasks(assigned_to);