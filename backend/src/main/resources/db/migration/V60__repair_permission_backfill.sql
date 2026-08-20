-- Backfill the dedicated production-repair permission for installations that
-- created the default group before the permission seed was applied.
INSERT IGNORE INTO permissions(code,name)
VALUES ('MANAGE_PRODUCTION_REPAIR','生产维修');

INSERT IGNORE INTO permission_group_permissions(group_id,permission_id)
SELECT g.id,p.id
FROM permission_groups g
JOIN permissions p ON p.code='MANAGE_PRODUCTION_REPAIR'
WHERE g.code='PRODUCTION';

-- 007 is the production repair account used by the deployment. Keep the
-- grant conditional and idempotent so existing users/data are preserved.
INSERT IGNORE INTO roles(code,name)
SELECT CONCAT('USER_',u.id,'_CUSTOM'),'007个人权限'
FROM users u
WHERE u.username='007';

INSERT IGNORE INTO user_roles(user_id,role_id)
SELECT u.id,r.id
FROM users u
JOIN roles r ON r.code=CONCAT('USER_',u.id,'_CUSTOM')
WHERE u.username='007';

INSERT IGNORE INTO role_permissions(role_id,permission_id)
SELECT r.id,p.id
FROM users u
JOIN roles r ON r.code=CONCAT('USER_',u.id,'_CUSTOM')
JOIN permissions p ON p.code='MANAGE_PRODUCTION_REPAIR'
WHERE u.username='007';
