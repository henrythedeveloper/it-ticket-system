-- Create archived_tasks table with the same structure as tasks
CREATE TABLE archived_tasks (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(20) CHECK (status IN ('todo', 'in_progress', 'done')),
    priority VARCHAR(20) CHECK (priority IN ('low', 'medium', 'high')),
    created_by INTEGER REFERENCES users(id),
    assigned_to INTEGER REFERENCES users(id),
    due_date TIMESTAMP,
    recurrence_type VARCHAR(20) CHECK (recurrence_type IN ('none', 'daily', 'weekly', 'monthly', 'yearly')),
    recurrence_interval INTEGER DEFAULT 1,
    recurrence_end_date TIMESTAMP,
    parent_task_id INTEGER REFERENCES tasks(id),
    next_occurrence TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP,
    archived_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Add indexes for better query performance
CREATE INDEX idx_archived_tasks_created_by ON archived_tasks(created_by);
CREATE INDEX idx_archived_tasks_assigned_to ON archived_tasks(assigned_to);
CREATE INDEX idx_archived_tasks_parent_task_id ON archived_tasks(parent_task_id);
CREATE INDEX idx_archived_tasks_archived_at ON archived_tasks(archived_at);