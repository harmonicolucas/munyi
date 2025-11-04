-- MUNYI production schema for PostgreSQL.
-- The FastAPI app also creates these tables on SQLite for the local demo.

CREATE TABLE IF NOT EXISTS incidents (
    id VARCHAR(32) PRIMARY KEY,
    incident_type VARCHAR(32) NOT NULL,
    severity VARCHAR(16) NOT NULL,
    description TEXT NOT NULL,
    summary TEXT NOT NULL,
    affected_area VARCHAR(200) NOT NULL,
    location_text VARCHAR(200) DEFAULT '',
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    status VARCHAR(32) NOT NULL DEFAULT 'pending_validation',
    channel VARCHAR(16) NOT NULL DEFAULT 'text',
    evidence_path VARCHAR(300),
    source VARCHAR(64) NOT NULL DEFAULT 'deterministic_rules',
    analysis JSONB NOT NULL,
    segmentation JSONB,
    cluster_id VARCHAR(32),
    requires_confirmation BOOLEAN NOT NULL DEFAULT TRUE,
    people_at_risk TEXT,
    recommended_actions JSONB NOT NULL,
    simple_alert TEXT NOT NULL,
    lang VARCHAR(8) NOT NULL DEFAULT 'pt',
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_incidents_severity ON incidents (severity);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents (status);
CREATE INDEX IF NOT EXISTS idx_incidents_cluster ON incidents (cluster_id);
CREATE INDEX IF NOT EXISTS idx_incidents_created ON incidents (created_at);
