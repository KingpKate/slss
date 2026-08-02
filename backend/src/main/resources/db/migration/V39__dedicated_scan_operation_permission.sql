INSERT IGNORE INTO permissions(code,name) VALUES ('OPERATE_SCAN','扫码录入与完工');
INSERT IGNORE INTO permission_group_permissions(group_id,permission_id)
SELECT g.id,p.id FROM permission_groups g JOIN permissions p
WHERE g.code='PRODUCTION' AND p.code='OPERATE_SCAN';
