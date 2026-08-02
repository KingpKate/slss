ALTER TABLE permission_groups
  ADD COLUMN version BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN deleted_at TIMESTAMP NULL,
  ADD COLUMN deleted_by VARCHAR(100) NULL,
  ADD COLUMN updated_by VARCHAR(100) NULL;

CREATE INDEX idx_permission_group_active ON permission_groups(enabled, deleted_at);
