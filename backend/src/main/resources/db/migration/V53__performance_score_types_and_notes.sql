ALTER TABLE performance_scores
  ADD COLUMN score_type VARCHAR(24) NOT NULL DEFAULT 'SUBJECT',
  ADD COLUMN monthly_score DECIMAL(8,2) NULL;
CREATE INDEX idx_performance_score_type ON performance_scores(evaluation_id, score_type, evaluator_user_id);

ALTER TABLE performance_evaluations
  ADD COLUMN self_comment VARCHAR(2000) NULL,
  ADD COLUMN good_deeds VARCHAR(2000) NULL,
  ADD COLUMN remarks VARCHAR(2000) NULL;

CREATE TABLE performance_template_fields (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  template_id BIGINT NOT NULL,
  field_code VARCHAR(64) NOT NULL,
  field_label VARCHAR(160) NOT NULL,
  field_type VARCHAR(24) NOT NULL DEFAULT 'TEXT',
  required_flag BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INT NOT NULL DEFAULT 0,
  CONSTRAINT fk_performance_template_field_template FOREIGN KEY (template_id) REFERENCES performance_templates(id) ON DELETE CASCADE,
  UNIQUE KEY uk_performance_template_field(template_id, field_code)
);
