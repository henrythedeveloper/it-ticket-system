CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE user_role AS ENUM ('Staff', 'Admin');

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'Staff',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index on email for faster login lookups
CREATE INDEX idx_users_email ON users(email);

-- Initial admin user (password should be hashed in real implementation)
INSERT INTO users (id, name, email, password_hash, role, created_at, updated_at)
VALUES (
    uuid_generate_v4(),
    'Admin User',
    'admin@example.com',
    '$2a$12$2JziQOW//48h3cL2IZLVf.5ehvVwzjF/G4KprN220GQMq5.BzfR6m', -- 'password123'
    'Admin',
    NOW(),
    NOW()
);