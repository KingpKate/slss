-- Repair operators already have MANAGE_PRODUCTION_REPAIR. Give the two
-- existing production repair accounts access to every active customer tenant
-- so completed devices can be looked up regardless of which customer created
-- the flow sheet. The composite primary key makes this idempotent.
INSERT IGNORE INTO user_tenants (user_id, tenant_id)
SELECT u.id, t.id
FROM users u
JOIN customer_tenants t ON t.status = 'ACTIVE'
WHERE u.status = 'ACTIVE'
  AND u.username IN ('007乔红泽', '008于顺堂');
