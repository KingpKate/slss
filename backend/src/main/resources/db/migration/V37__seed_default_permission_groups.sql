INSERT INTO permission_groups(code,name,description,enabled)
SELECT 'MANAGEMENT','管理人员','系统管理、运营与审批权限组',TRUE
WHERE NOT EXISTS (SELECT 1 FROM permission_groups WHERE code='MANAGEMENT');
INSERT INTO permission_groups(code,name,description,enabled)
SELECT 'PRODUCTION','生产人员','生产录入、扫码和生产维修权限组',TRUE
WHERE NOT EXISTS (SELECT 1 FROM permission_groups WHERE code='PRODUCTION');
INSERT INTO permission_groups(code,name,description,enabled)
SELECT 'BUSINESS','商务人员','客户、工单、销售与采购协同权限组',TRUE
WHERE NOT EXISTS (SELECT 1 FROM permission_groups WHERE code='BUSINESS');

INSERT IGNORE INTO permission_group_permissions(group_id,permission_id)
SELECT g.id,p.id FROM permission_groups g JOIN permissions p
WHERE g.code='MANAGEMENT' AND p.code IN ('VIEW_DASHBOARD','VIEW_ORDERS','MANAGE_ORDERS','MANAGE_SALES','MANAGE_PROCUREMENT','MANAGE_SYSTEM');
INSERT IGNORE INTO permission_group_permissions(group_id,permission_id)
SELECT g.id,p.id FROM permission_groups g JOIN permissions p
WHERE g.code='PRODUCTION' AND p.code IN ('VIEW_DASHBOARD','VIEW_PRODUCTION','MANAGE_PRODUCTION','CREATE_SCAN_TABLE','USE_SCAN_TEMPLATE','MANAGE_PRODUCTION_REPAIR');
INSERT IGNORE INTO permission_group_permissions(group_id,permission_id)
SELECT g.id,p.id FROM permission_groups g JOIN permissions p
WHERE g.code='BUSINESS' AND p.code IN ('VIEW_DASHBOARD','VIEW_ORDERS','MANAGE_ORDERS','MANAGE_SALES','MANAGE_PROCUREMENT');
