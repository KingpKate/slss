ALTER TABLE scan_template_fields
  ADD COLUMN require_model_flag BOOLEAN NOT NULL DEFAULT FALSE;
