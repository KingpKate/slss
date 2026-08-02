-- MySQL's DDL is non-transactional. The core schema already contains
-- assigned_to in some deployed V1 databases, so every operation is idempotent
-- to allow a failed/partially-applied Flyway migration to recover safely.
SET @slss_add_sla = (SELECT IF(COUNT(*)=0, 'ALTER TABLE repair_orders ADD COLUMN sla_due_at TIMESTAMP NULL', 'SELECT 1') FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='repair_orders' AND column_name='sla_due_at');
PREPARE slss_stmt FROM @slss_add_sla;
EXECUTE slss_stmt;
DEALLOCATE PREPARE slss_stmt;
SET @slss_add_version = (SELECT IF(COUNT(*)=0, 'ALTER TABLE repair_orders ADD COLUMN version BIGINT NOT NULL DEFAULT 0', 'SELECT 1') FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='repair_orders' AND column_name='version');
PREPARE slss_stmt FROM @slss_add_version;
EXECUTE slss_stmt;
DEALLOCATE PREPARE slss_stmt;
CREATE TABLE IF NOT EXISTS production_import_jobs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  batch_name VARCHAR(120) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  status VARCHAR(30) NOT NULL,
  total_rows INT NOT NULL DEFAULT 0,
  success_rows INT NOT NULL DEFAULT 0,
  failed_rows INT NOT NULL DEFAULT 0,
  error_message TEXT,
  created_by VARCHAR(80),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  started_at TIMESTAMP NULL,
  finished_at TIMESTAMP NULL,
  INDEX idx_import_job_created(created_at)
);

CREATE TABLE IF NOT EXISTS production_import_failures (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  job_id BIGINT NOT NULL,
  `row_number` INT NOT NULL,
  machine_sn VARCHAR(160),
  error_message VARCHAR(500) NOT NULL,
  raw_data TEXT,
  FOREIGN KEY(job_id) REFERENCES production_import_jobs(id)
);
