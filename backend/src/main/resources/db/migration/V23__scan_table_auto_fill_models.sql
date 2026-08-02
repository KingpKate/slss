ALTER TABLE scan_tables ADD COLUMN disable_auto_fill_part_models BOOLEAN NOT NULL DEFAULT FALSE AFTER dispatch_order_no;
