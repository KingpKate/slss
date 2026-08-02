INSERT IGNORE INTO permissions(code,name)
VALUES ('DELETE_PRODUCTION_COLUMN','删除扫码表列');

ALTER TABLE scan_tables
  ADD COLUMN hidden_field_keys TEXT NULL AFTER disable_auto_fill_part_models;
