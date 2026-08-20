ALTER TABLE performance_templates
  ADD COLUMN subject_user_id BIGINT NULL,
  ADD CONSTRAINT fk_performance_template_subject_user FOREIGN KEY (subject_user_id) REFERENCES users(id);

ALTER TABLE performance_items
  ADD COLUMN score_required BOOLEAN NOT NULL DEFAULT TRUE;

-- V46's legacy unique key did not include evaluator scope. Remove only that
-- obsolete constraint; V49's scoped unique key remains authoritative.
ALTER TABLE performance_evaluations DROP INDEX uk_performance_evaluation;

CREATE INDEX idx_performance_template_subject
  ON performance_templates(department_id, subject_user_id, status, effective_from, effective_to);

CREATE TABLE performance_assignments (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  cycle_id BIGINT NOT NULL,
  template_id BIGINT NOT NULL,
  subject_user_id BIGINT NOT NULL,
  subject_department_id BIGINT NOT NULL,
  evaluator_user_id BIGINT NOT NULL,
  evaluator_department_id BIGINT NULL,
  evaluation_mode VARCHAR(32) NOT NULL DEFAULT 'subject',
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  due_at TIMESTAMP NULL,
  evaluation_id BIGINT NULL,
  created_by BIGINT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  version BIGINT NOT NULL DEFAULT 0,
  CONSTRAINT fk_performance_assignment_cycle FOREIGN KEY (cycle_id) REFERENCES performance_cycles(id),
  CONSTRAINT fk_performance_assignment_template FOREIGN KEY (template_id) REFERENCES performance_templates(id),
  CONSTRAINT fk_performance_assignment_subject FOREIGN KEY (subject_user_id) REFERENCES users(id),
  CONSTRAINT fk_performance_assignment_subject_department FOREIGN KEY (subject_department_id) REFERENCES performance_departments(id),
  CONSTRAINT fk_performance_assignment_evaluator FOREIGN KEY (evaluator_user_id) REFERENCES users(id),
  CONSTRAINT fk_performance_assignment_evaluator_department FOREIGN KEY (evaluator_department_id) REFERENCES performance_departments(id),
  CONSTRAINT fk_performance_assignment_evaluation FOREIGN KEY (evaluation_id) REFERENCES performance_evaluations(id),
  CONSTRAINT fk_performance_assignment_created_by FOREIGN KEY (created_by) REFERENCES users(id),
  UNIQUE KEY uk_performance_assignment(cycle_id, template_id, subject_user_id, evaluator_user_id, evaluation_mode)
);
CREATE INDEX idx_performance_assignment_inbox ON performance_assignments(evaluator_user_id, cycle_id, status, due_at);
CREATE INDEX idx_performance_assignment_subject ON performance_assignments(subject_user_id, cycle_id, status);
