ALTER TABLE repair_orders
  ADD COLUMN sla_paused_at DATETIME(6) NULL,
  ADD COLUMN sla_remaining_seconds BIGINT NULL;

ALTER TABLE order_status_history
  ADD COLUMN operated_by VARCHAR(100) NULL;
