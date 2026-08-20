CREATE TABLE quality_inspection_templates (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  customer_name VARCHAR(200) NOT NULL,
  dispatch_order_no VARCHAR(120) NOT NULL,
  stages_json LONGTEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by VARCHAR(120),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_quality_template_customer_dispatch (customer_name, dispatch_order_no)
);
