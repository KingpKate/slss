CREATE TABLE customer_tenants (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  tenant_code VARCHAR(80) NOT NULL UNIQUE,
  tenant_name VARCHAR(200) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_tenants (
  user_id BIGINT NOT NULL,
  tenant_id BIGINT NOT NULL,
  PRIMARY KEY(user_id,tenant_id),
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(tenant_id) REFERENCES customer_tenants(id)
);

ALTER TABLE assets ADD COLUMN tenant_id BIGINT NULL, ADD CONSTRAINT fk_asset_tenant FOREIGN KEY(tenant_id) REFERENCES customer_tenants(id);
CREATE INDEX idx_asset_tenant ON assets(tenant_id);
