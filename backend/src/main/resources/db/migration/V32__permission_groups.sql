CREATE TABLE permission_groups (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  code VARCHAR(80) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
CREATE TABLE user_permission_groups (
  user_id BIGINT NOT NULL,
  group_id BIGINT NOT NULL,
  PRIMARY KEY(user_id, group_id),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(group_id) REFERENCES permission_groups(id) ON DELETE CASCADE
);
CREATE TABLE permission_group_permissions (
  group_id BIGINT NOT NULL,
  permission_id BIGINT NOT NULL,
  PRIMARY KEY(group_id, permission_id),
  FOREIGN KEY(group_id) REFERENCES permission_groups(id) ON DELETE CASCADE,
  FOREIGN KEY(permission_id) REFERENCES permissions(id) ON DELETE CASCADE
);
CREATE INDEX idx_permission_group_enabled ON permission_groups(enabled);
