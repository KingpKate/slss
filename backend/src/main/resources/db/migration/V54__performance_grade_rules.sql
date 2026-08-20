CREATE TABLE performance_grade_rules (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  grade_code VARCHAR(8) NOT NULL,
  grade_label VARCHAR(128) NOT NULL,
  min_score DECIMAL(8,2) NOT NULL,
  max_score DECIMAL(8,2) NULL,
  reward_adjustment DECIMAL(10,2) NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  version BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_performance_grade_rule_code (grade_code)
);
INSERT INTO performance_grade_rules (grade_code, grade_label, min_score, max_score, reward_adjustment)
SELECT * FROM (
  SELECT 'A','突出贡献',100.00,NULL,500.00 UNION ALL
  SELECT 'B','优秀',90.00,99.99,0.00 UNION ALL
  SELECT 'C','一般',80.00,89.99,-200.00 UNION ALL
  SELECT 'D','较差',70.00,79.99,-300.00 UNION ALL
  SELECT 'E','不合格',60.00,69.99,-500.00 UNION ALL
  SELECT 'F','严重不合格',0.00,59.99,NULL
) AS seed
WHERE NOT EXISTS (SELECT 1 FROM performance_grade_rules);
