CREATE TABLE permission_overrides (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  permission_code VARCHAR(100) NOT NULL,
  effect VARCHAR(10) NOT NULL,
  created_by VARCHAR(100) NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_permission_override_user_code (user_id, permission_code),
  CONSTRAINT fk_permission_override_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE permission_scope_bindings (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  subject_type VARCHAR(20) NOT NULL,
  subject_id BIGINT NOT NULL,
  permission_code VARCHAR(100) NOT NULL,
  scope_type VARCHAR(30) NOT NULL,
  scope_value VARCHAR(160) NULL,
  version BIGINT NOT NULL DEFAULT 0,
  updated_by VARCHAR(100),
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_permission_scope (subject_type, subject_id, permission_code, scope_type, scope_value),
  KEY idx_permission_scope_subject (subject_type, subject_id)
);

CREATE TABLE permission_cache_versions (
  id BIGINT PRIMARY KEY,
  version BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
INSERT INTO permission_cache_versions(id, version) VALUES (1, 0);

CREATE TABLE permission_change_requests (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  target_type VARCHAR(30) NOT NULL,
  target_id BIGINT NOT NULL,
  change_type VARCHAR(40) NOT NULL,
  payload_json TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  requested_by VARCHAR(100) NOT NULL,
  reviewed_by VARCHAR(100),
  review_comment VARCHAR(500),
  requested_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TIMESTAMP NULL,
  version BIGINT NOT NULL DEFAULT 0,
  KEY idx_permission_request_status (status, requested_at)
);
