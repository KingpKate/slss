ALTER TABLE performance_templates
  ADD COLUMN published_at TIMESTAMP NULL,
  ADD COLUMN published_by BIGINT NULL;
