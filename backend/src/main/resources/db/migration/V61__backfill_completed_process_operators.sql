-- Legacy completed rows predate process-level operator persistence. Backfill
-- only empty operator values so completed/statistics details remain traceable;
-- never overwrite an operator that was already recorded during scanning.
UPDATE scan_table_values v
JOIN scan_table_rows r ON r.id=v.row_id
SET v.operator_no=r.completed_by
WHERE r.status='COMPLETED'
  AND (v.operator_no IS NULL OR TRIM(v.operator_no)='')
  AND r.completed_by IS NOT NULL
  AND TRIM(r.completed_by)<>'';
