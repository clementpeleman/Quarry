-- Quarry Database Schema
-- Auto-runs when PostgreSQL container starts

-- Column metadata for semantic layer
CREATE TABLE IF NOT EXISTS column_metadata (
    id SERIAL PRIMARY KEY,
    table_name VARCHAR(255) NOT NULL,
    column_name VARCHAR(255) NOT NULL,
    description TEXT,
    alias VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(table_name, column_name)
);

-- Relationships between tables
CREATE TABLE IF NOT EXISTS relationships (
    id SERIAL PRIMARY KEY,
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
    name VARCHAR(255) NOT NULL UNIQUE,
    display_name VARCHAR(255),
    description TEXT,
    table_name VARCHAR(255) NOT NULL,
    expression TEXT NOT NULL,
    metric_type VARCHAR(50) DEFAULT 'measure',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
CREATE INDEX IF NOT EXISTS idx_column_metadata_table ON column_metadata(table_name);
CREATE INDEX IF NOT EXISTS idx_relationships_tables ON relationships(from_table, to_table);
