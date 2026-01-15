-- Quarry Database Schema
-- Auto-runs when PostgreSQL container starts

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Connections table (must be created first for foreign keys)
CREATE TABLE IF NOT EXISTS connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    host VARCHAR(255) NOT NULL,
    port INTEGER DEFAULT 5432,
    database_name VARCHAR(255) NOT NULL,
    username VARCHAR(255) NOT NULL,
    password_encrypted TEXT,
    ssl BOOLEAN DEFAULT false,
    is_demo BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert demo connection (fixed UUID for consistency)
INSERT INTO connections (id, name, host, port, database_name, username, password_encrypted, is_demo, is_active)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Demo Database',
    'db',
    5432,
    'quarry',
    'quarry',
    'quarry_secret',
    true,
    true
) ON CONFLICT (id) DO NOTHING;

-- Column metadata for semantic layer
CREATE TABLE IF NOT EXISTS column_metadata (
    id SERIAL PRIMARY KEY,
    connection_id UUID NOT NULL REFERENCES connections(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001',
    table_name VARCHAR(255) NOT NULL,
    column_name VARCHAR(255) NOT NULL,
    description TEXT,
    alias VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(connection_id, table_name, column_name)
);

-- Relationships between tables
CREATE TABLE IF NOT EXISTS relationships (
    id SERIAL PRIMARY KEY,
    connection_id UUID NOT NULL REFERENCES connections(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001',
    from_table VARCHAR(255) NOT NULL,
    from_column VARCHAR(255) NOT NULL,
    to_table VARCHAR(255) NOT NULL,
    to_column VARCHAR(255) NOT NULL,
    relationship_type VARCHAR(50) NOT NULL DEFAULT 'one-to-many',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Calculated fields / Metrics
CREATE TABLE IF NOT EXISTS metrics (
    id SERIAL PRIMARY KEY,
    connection_id UUID NOT NULL REFERENCES connections(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001',
    name VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    description TEXT,
    table_name VARCHAR(255) NOT NULL,
    expression TEXT NOT NULL,
    metric_type VARCHAR(50) DEFAULT 'measure',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(connection_id, name)
);

-- Saved canvases
CREATE TABLE IF NOT EXISTS canvases (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    nodes JSONB NOT NULL DEFAULT '[]',
    edges JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_connections_active ON connections(is_active);
CREATE INDEX IF NOT EXISTS idx_column_metadata_connection ON column_metadata(connection_id);
CREATE INDEX IF NOT EXISTS idx_column_metadata_table ON column_metadata(table_name);
CREATE INDEX IF NOT EXISTS idx_relationships_connection ON relationships(connection_id);
CREATE INDEX IF NOT EXISTS idx_relationships_tables ON relationships(from_table, to_table);
CREATE INDEX IF NOT EXISTS idx_metrics_connection ON metrics(connection_id);
