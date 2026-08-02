SET @slss_column_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'scan_table_rows' AND column_name = 'completed_at'
);
SET @slss_add_column = IF(@slss_column_exists = 0,
  'ALTER TABLE scan_table_rows ADD COLUMN completed_at TIMESTAMP NULL',
  'SELECT 1');
PREPARE slss_stmt FROM @slss_add_column;
EXECUTE slss_stmt;
DEALLOCATE PREPARE slss_stmt;
