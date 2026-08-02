-- Bootstrap account for the first production login.
-- Password: admin123
-- Change it immediately after the first login in a production deployment.
INSERT IGNORE INTO users (username, password_hash, display_name, status)
VALUES ('admin', '$2b$12$kWAR0HY1vlkFb.TmyPLYG.Y7ILWBDmEWjcLB2SFGjzUCMB9j2ctPK', '系统管理员', 'ACTIVE');

INSERT IGNORE INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u
JOIN roles r ON r.code = 'ADMIN'
WHERE u.username = 'admin';

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.code = 'ADMIN';
