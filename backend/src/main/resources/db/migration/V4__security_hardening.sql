ALTER TABLE users
  ADD COLUMN failed_login_attempts INT NOT NULL DEFAULT 0,
  ADD COLUMN locked_until TIMESTAMP NULL,
  ADD COLUMN must_change_password BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN last_login_at TIMESTAMP NULL;

UPDATE users SET must_change_password = TRUE WHERE username = 'admin';

CREATE TABLE audit_logs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  actor VARCHAR(80),
  action VARCHAR(100) NOT NULL,
  target_type VARCHAR(80),
  target_id VARCHAR(120),
  details TEXT,
  ip_address VARCHAR(64),
  success BOOLEAN NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_actor_time(actor, created_at),
  INDEX idx_audit_target(target_type, target_id)
);

INSERT IGNORE INTO permissions(code, name) VALUES ('MANAGE_SYSTEM', '管理系统用户与安全');
INSERT IGNORE INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code='MANAGE_SYSTEM'
WHERE r.code='ADMIN';
