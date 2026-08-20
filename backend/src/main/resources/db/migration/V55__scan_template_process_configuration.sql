ALTER TABLE scan_template_fields
  ADD COLUMN enabled_flag BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN scan_required_flag BOOLEAN NOT NULL DEFAULT FALSE;

-- Existing SN mappings are already production scan steps. Preserve their
-- behaviour while allowing new non-SN workflow steps to be checked manually.
UPDATE scan_template_fields
SET scan_required_flag = TRUE
WHERE UPPER(field_type) = 'SN'
   OR field_label REGEXP '(SN|序列号|Serial)';
