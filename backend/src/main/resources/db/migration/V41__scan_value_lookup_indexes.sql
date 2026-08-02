-- Supports case-insensitive SN duplicate lookup without loading all scan tables.
-- The existing value index remains for backwards compatibility; this composite
-- index also makes the row join selective for the write path.
CREATE INDEX idx_scan_value_value_row ON scan_table_values(field_value, row_id);
CREATE INDEX idx_scan_row_table_row ON scan_table_rows(scan_table_id, row_no);
