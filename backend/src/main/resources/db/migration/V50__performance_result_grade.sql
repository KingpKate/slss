ALTER TABLE performance_evaluations
  ADD COLUMN grade_code VARCHAR(4) NULL,
  ADD COLUMN reward_adjustment DECIMAL(10,2) NULL;
