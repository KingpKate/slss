CREATE TABLE scan_templates (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  customer_name VARCHAR(128) NOT NULL,
  model VARCHAR(128) NOT NULL,
  description VARCHAR(500),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by VARCHAR(64) NOT NULL,
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  CONSTRAINT uk_scan_template_customer_model UNIQUE (customer_name, model)
);

CREATE TABLE scan_template_fields (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  template_id BIGINT NOT NULL,
  field_key VARCHAR(64) NOT NULL,
  field_label VARCHAR(128) NOT NULL,
  field_type VARCHAR(32) NOT NULL DEFAULT 'SN',
  required_flag BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INT NOT NULL,
  CONSTRAINT fk_scan_template_field_template FOREIGN KEY (template_id) REFERENCES scan_templates(id) ON DELETE CASCADE,
  CONSTRAINT uk_scan_template_field_key UNIQUE (template_id, field_key)
);

CREATE TABLE scan_tables (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  template_id BIGINT NOT NULL,
  customer_name VARCHAR(128) NOT NULL,
  model VARCHAR(128) NOT NULL,
  quantity INT NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'OPEN',
  created_by VARCHAR(64) NOT NULL,
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  completed_at TIMESTAMP(6),
  CONSTRAINT fk_scan_table_template FOREIGN KEY (template_id) REFERENCES scan_templates(id),
  INDEX ix_scan_table_customer_status (customer_name, status)
);

CREATE TABLE scan_table_rows (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  scan_table_id BIGINT NOT NULL,
  row_no INT NOT NULL,
  machine_sn VARCHAR(128),
  status VARCHAR(32) NOT NULL DEFAULT 'OPEN',
  completed_by VARCHAR(64),
  completed_at TIMESTAMP(6),
  version BIGINT NOT NULL DEFAULT 0,
  CONSTRAINT fk_scan_row_table FOREIGN KEY (scan_table_id) REFERENCES scan_tables(id) ON DELETE CASCADE,
  CONSTRAINT uk_scan_row_number UNIQUE (scan_table_id, row_no),
  INDEX ix_scan_row_machine_sn (machine_sn)
);

CREATE TABLE scan_table_values (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  row_id BIGINT NOT NULL,
  field_key VARCHAR(64) NOT NULL,
  field_value VARCHAR(256),
  operator_no VARCHAR(64),
  scanned_at TIMESTAMP(6),
  CONSTRAINT fk_scan_value_row FOREIGN KEY (row_id) REFERENCES scan_table_rows(id) ON DELETE CASCADE,
  CONSTRAINT uk_scan_value_field UNIQUE (row_id, field_key),
  INDEX ix_scan_value_value (field_value)
);
