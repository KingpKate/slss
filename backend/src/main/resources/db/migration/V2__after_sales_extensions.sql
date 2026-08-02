CREATE TABLE repair_tests (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  repair_order_id BIGINT NOT NULL,
  test_type VARCHAR(80) NOT NULL,
  result VARCHAR(30) NOT NULL,
  details TEXT,
  tested_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (repair_order_id) REFERENCES repair_orders(id)
);

CREATE TABLE repair_logistics (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  repair_order_id BIGINT NOT NULL,
  direction VARCHAR(20) NOT NULL,
  carrier VARCHAR(120),
  tracking_number VARCHAR(120),
  shipped_at TIMESTAMP NULL,
  received_at TIMESTAMP NULL,
  notes TEXT,
  FOREIGN KEY (repair_order_id) REFERENCES repair_orders(id)
);

CREATE TABLE repair_reports (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  repair_order_id BIGINT NOT NULL UNIQUE,
  diagnosis TEXT NOT NULL,
  resolution TEXT NOT NULL,
  test_conclusion TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (repair_order_id) REFERENCES repair_orders(id)
);
