CREATE TABLE faq_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    question VARCHAR(500) NOT NULL,
    answer TEXT NOT NULL,
    category VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_faq_category ON faq_entries(category);

-- Add full-text search capabilities
ALTER TABLE faq_entries ADD COLUMN search_vector tsvector 
    GENERATED ALWAYS AS (to_tsvector('english', question || ' ' || answer)) STORED;

CREATE INDEX idx_faq_search ON faq_entries USING GIN(search_vector);