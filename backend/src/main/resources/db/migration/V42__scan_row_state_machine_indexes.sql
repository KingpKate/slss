-- Row state is persisted as text; index it for paged OPEN/IN_PROGRESS views.
CREATE INDEX idx_scan_row_status ON scan_table_rows(status);
CREATE INDEX idx_scan_table_status_created ON scan_tables(status, created_at);
