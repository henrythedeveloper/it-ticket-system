-- Migration to create the task_updates table

CREATE TABLE task_updates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), 
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE, -- Foreign key to tasks table
    user_id UUID REFERENCES users(id), -- User who made the update (can be NULL for system updates)
    comment TEXT NOT NULL, -- The content of the update/comment
    -- is_internal_note BOOLEAN NOT NULL DEFAULT FALSE, -- Optional: Add if you need internal notes for tasks
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW() -- Timestamp of the update
);

-- Index for faster querying of updates for a specific task
CREATE INDEX idx_task_updates_task_id ON task_updates(task_id);

-- Optional: Index for user ID if you query updates by user often
-- CREATE INDEX idx_task_updates_user_id ON task_updates(user_id);

