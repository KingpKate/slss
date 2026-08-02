-- P3: 为查询热路径补充索引（MySQL 语法）
-- 列名与 V1(repair_orders/lifecycle_events) / V4(audit_logs) / V5(sla_due_at) / V20(scan_tables) 一致
CREATE INDEX ix_repair_machine_sn ON repair_orders(machine_sn);
CREATE INDEX ix_repair_status ON repair_orders(status);
CREATE INDEX ix_repair_sla ON repair_orders(sla_due_at);
CREATE INDEX ix_scan_table_status_created ON scan_tables(status, created_at);
CREATE INDEX ix_lifecycle_type_occurred ON lifecycle_events(event_type, occurred_at);
CREATE INDEX ix_audit_action_time ON audit_logs(action, created_at);
