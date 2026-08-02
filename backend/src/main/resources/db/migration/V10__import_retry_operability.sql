ALTER TABLE production_import_jobs
  ADD COLUMN retry_count INT NOT NULL DEFAULT 0,
  ADD COLUMN max_retries INT NOT NULL DEFAULT 3,
  ADD COLUMN next_attempt_at TIMESTAMP NULL,
  ADD COLUMN last_heartbeat_at TIMESTAMP NULL;

ALTER TABLE production_import_failures
  ADD COLUMN error_category VARCHAR(80) NULL,
  ADD COLUMN raw_row_json JSON NULL;
