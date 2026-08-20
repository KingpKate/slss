ALTER TABLE performance_cycles
  ADD COLUMN starts_at TIMESTAMP NULL,
  ADD COLUMN ends_at TIMESTAMP NULL,
  ADD COLUMN published_at TIMESTAMP NULL,
  ADD COLUMN due_at TIMESTAMP NULL;

ALTER TABLE performance_evaluations
  ADD COLUMN evaluator_user_id BIGINT NULL,
  ADD COLUMN evaluator_department_id BIGINT NULL,
  ADD COLUMN evaluation_mode VARCHAR(32) NOT NULL DEFAULT 'subject';

UPDATE performance_evaluations
SET evaluator_user_id = subject_user_id,
    evaluator_department_id = subject_department_id
WHERE evaluator_user_id IS NULL;

ALTER TABLE performance_evaluations
  ADD CONSTRAINT fk_performance_evaluation_evaluator FOREIGN KEY (evaluator_user_id) REFERENCES users(id),
  ADD CONSTRAINT fk_performance_evaluation_evaluator_department FOREIGN KEY (evaluator_department_id) REFERENCES performance_departments(id);

CREATE INDEX idx_performance_template_effective ON performance_templates(department_id, status, effective_from, effective_to);
CREATE INDEX idx_performance_evaluation_period_department ON performance_evaluations(cycle_id, subject_department_id, status);
CREATE UNIQUE INDEX uk_performance_evaluation_scope
  ON performance_evaluations(cycle_id, template_id, subject_user_id, evaluator_user_id, evaluation_mode);
