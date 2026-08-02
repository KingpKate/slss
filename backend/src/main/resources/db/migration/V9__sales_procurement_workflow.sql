CREATE TABLE sales_approval_history (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  initiation_id BIGINT NOT NULL,
  from_status VARCHAR(40),
  to_status VARCHAR(40) NOT NULL,
  comment VARCHAR(1000),
  operated_by VARCHAR(100) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(initiation_id) REFERENCES sales_initiations(id)
);

CREATE TABLE supplier_quotations (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  procurement_project_id BIGINT NOT NULL,
  supplier_name VARCHAR(200) NOT NULL,
  amount DECIMAL(18,2) NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'CNY',
  delivery_date DATE,
  validity_date DATE,
  notes TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'SUBMITTED',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(procurement_project_id) REFERENCES procurement_projects(id)
);

CREATE TABLE sales_attachments (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  initiation_id BIGINT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  storage_key VARCHAR(500) NOT NULL,
  content_type VARCHAR(120),
  file_size BIGINT NOT NULL,
  uploaded_by VARCHAR(100) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(initiation_id) REFERENCES sales_initiations(id)
);

ALTER TABLE procurement_projects ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;
