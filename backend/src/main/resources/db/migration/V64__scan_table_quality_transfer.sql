ALTER TABLE scan_tables ADD COLUMN quality_transferred BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE scan_tables ADD COLUMN quality_transferred_at TIMESTAMP NULL;
ALTER TABLE scan_tables ADD COLUMN quality_transferred_by VARCHAR(120) NULL;
CREATE INDEX idx_scan_tables_quality_transfer ON scan_tables (quality_transferred, created_at);
