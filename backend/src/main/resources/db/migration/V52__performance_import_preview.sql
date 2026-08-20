CREATE TABLE performance_import_previews (
  token VARCHAR(36) PRIMARY KEY,
  workbook_data LONGBLOB NOT NULL,
  original_filename VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_performance_import_preview_expiry ON performance_import_previews(status, expires_at);
