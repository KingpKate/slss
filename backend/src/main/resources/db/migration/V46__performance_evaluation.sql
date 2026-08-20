CREATE TABLE performance_departments (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  department_code VARCHAR(80) NOT NULL UNIQUE,
  department_name VARCHAR(120) NOT NULL UNIQUE,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  version BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE user_department_memberships (
  user_id BIGINT NOT NULL,
  department_id BIGINT NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  effective_from TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  effective_to TIMESTAMP NULL,
  PRIMARY KEY (user_id, department_id, effective_from),
  CONSTRAINT fk_user_department_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_user_department_department FOREIGN KEY (department_id) REFERENCES performance_departments(id)
);
CREATE INDEX idx_user_department_current ON user_department_memberships(user_id, is_primary, effective_to);

CREATE TABLE performance_templates (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  tenant_id BIGINT NULL,
  department_id BIGINT NOT NULL,
  template_name VARCHAR(160) NOT NULL,
  source_sheet VARCHAR(160) NOT NULL,
  schema_version VARCHAR(30) NOT NULL DEFAULT '1.0',
  template_version INT NOT NULL DEFAULT 1,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  total_score DECIMAL(8,2) NOT NULL DEFAULT 100,
  effective_from DATE NULL,
  effective_to DATE NULL,
  created_by BIGINT NULL,
  version BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_performance_template_version(tenant_id, department_id, template_name, template_version),
  CONSTRAINT fk_performance_template_tenant FOREIGN KEY (tenant_id) REFERENCES customer_tenants(id),
  CONSTRAINT fk_performance_template_department FOREIGN KEY (department_id) REFERENCES performance_departments(id),
  CONSTRAINT fk_performance_template_user FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE performance_sections (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  template_id BIGINT NOT NULL,
  section_code VARCHAR(100) NOT NULL,
  section_name VARCHAR(160) NOT NULL,
  section_weight DECIMAL(8,6) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  version BIGINT NOT NULL DEFAULT 0,
  UNIQUE KEY uk_performance_section(template_id, section_code),
  CONSTRAINT fk_performance_section_template FOREIGN KEY (template_id) REFERENCES performance_templates(id) ON DELETE CASCADE
);

CREATE TABLE performance_items (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  section_id BIGINT NOT NULL,
  department_id BIGINT NOT NULL,
  item_code VARCHAR(120) NOT NULL,
  key_factor VARCHAR(255) NOT NULL,
  standard_text TEXT NOT NULL,
  max_score DECIMAL(8,2) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  version BIGINT NOT NULL DEFAULT 0,
  UNIQUE KEY uk_performance_item(section_id, item_code),
  CONSTRAINT fk_performance_item_section FOREIGN KEY (section_id) REFERENCES performance_sections(id) ON DELETE CASCADE,
  CONSTRAINT fk_performance_item_department FOREIGN KEY (department_id) REFERENCES performance_departments(id)
);

CREATE TABLE performance_item_scopes (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  item_id BIGINT NOT NULL,
  scope_type VARCHAR(20) NOT NULL,
  scope_value VARCHAR(120) NULL,
  UNIQUE KEY uk_performance_item_scope(item_id, scope_type, scope_value),
  CONSTRAINT fk_performance_item_scope_item FOREIGN KEY (item_id) REFERENCES performance_items(id) ON DELETE CASCADE
);

CREATE TABLE performance_cycles (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  tenant_id BIGINT NULL,
  period_code VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
  opened_at TIMESTAMP NULL,
  closed_at TIMESTAMP NULL,
  version BIGINT NOT NULL DEFAULT 0,
  UNIQUE KEY uk_performance_cycle(tenant_id, period_code),
  CONSTRAINT fk_performance_cycle_tenant FOREIGN KEY (tenant_id) REFERENCES customer_tenants(id)
);

CREATE TABLE performance_evaluations (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  cycle_id BIGINT NOT NULL,
  template_id BIGINT NOT NULL,
  subject_user_id BIGINT NOT NULL,
  subject_department_id BIGINT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
  raw_score DECIMAL(8,2) NULL,
  normalized_score DECIMAL(8,2) NULL,
  visible_weight DECIMAL(8,6) NULL,
  submitted_by BIGINT NULL,
  submitted_at TIMESTAMP NULL,
  signature_hash VARCHAR(128) NULL,
  version BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_performance_evaluation(cycle_id, subject_user_id, template_id),
  CONSTRAINT fk_performance_evaluation_cycle FOREIGN KEY (cycle_id) REFERENCES performance_cycles(id),
  CONSTRAINT fk_performance_evaluation_template FOREIGN KEY (template_id) REFERENCES performance_templates(id),
  CONSTRAINT fk_performance_evaluation_user FOREIGN KEY (subject_user_id) REFERENCES users(id),
  CONSTRAINT fk_performance_evaluation_department FOREIGN KEY (subject_department_id) REFERENCES performance_departments(id)
);

CREATE TABLE performance_scores (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  evaluation_id BIGINT NOT NULL,
  item_id BIGINT NOT NULL,
  evaluator_user_id BIGINT NOT NULL,
  evaluator_department_id BIGINT NOT NULL,
  score DECIMAL(8,2) NOT NULL,
  comment VARCHAR(1000),
  signed_at TIMESTAMP NULL,
  version BIGINT NOT NULL DEFAULT 0,
  UNIQUE KEY uk_performance_score(evaluation_id, item_id, evaluator_user_id),
  CONSTRAINT fk_performance_score_evaluation FOREIGN KEY (evaluation_id) REFERENCES performance_evaluations(id) ON DELETE CASCADE,
  CONSTRAINT fk_performance_score_item FOREIGN KEY (item_id) REFERENCES performance_items(id),
  CONSTRAINT fk_performance_score_user FOREIGN KEY (evaluator_user_id) REFERENCES users(id),
  CONSTRAINT fk_performance_score_department FOREIGN KEY (evaluator_department_id) REFERENCES performance_departments(id)
);

INSERT IGNORE INTO permissions(code,name) VALUES ('MANAGE_PERFORMANCE','管理主管绩效评价');
INSERT IGNORE INTO role_permissions(role_id,permission_id)
 SELECT r.id,p.id FROM roles r JOIN permissions p ON p.code='MANAGE_PERFORMANCE' WHERE r.code='ADMIN';
INSERT IGNORE INTO performance_departments(department_code,department_name) VALUES
 ('SALES','销售部'),('MARKET','市场部'),('BUSINESS','商务部'),('STRUCTURE','结构部'),
 ('ELECTRONICS','电子电路部'),('PRODUCT','产品部'),('SOLUTION','解决方案部'),('PROCUREMENT','采购部'),
 ('PRODUCTION','生产部'),('HR','人事部'),('AFTER_SALES','售后部'),('TEST','测试部'),
 ('FINANCE','财务部'),('QUALITY','品质部'),('WAREHOUSE','仓储部');
