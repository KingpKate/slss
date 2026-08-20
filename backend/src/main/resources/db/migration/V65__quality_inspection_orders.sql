CREATE TABLE quality_inspection_orders (
 id BIGINT PRIMARY KEY AUTO_INCREMENT,
 source_scan_table_id BIGINT NOT NULL,
 customer_name VARCHAR(200) NOT NULL,
 machine_model VARCHAR(120) NOT NULL,
 quantity INT NOT NULL,
 stages_json LONGTEXT NOT NULL,
 status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
 created_by VARCHAR(120), created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT uk_quality_order_source UNIQUE (source_scan_table_id)
);
