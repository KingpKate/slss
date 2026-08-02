CREATE TABLE IF NOT EXISTS login_background_assets (
 id BIGINT AUTO_INCREMENT PRIMARY KEY,
 file_name VARCHAR(255) NOT NULL,
 mime_type VARCHAR(64) NOT NULL,
 file_size BIGINT NOT NULL,
 width INT NOT NULL,
 height INT NOT NULL,
 sha256 VARCHAR(64) NOT NULL,
 sort_order INT NOT NULL DEFAULT 0,
 enabled BOOLEAN NOT NULL DEFAULT TRUE,
 image_data LONGBLOB NOT NULL,
 created_by VARCHAR(100) NOT NULL,
 created_at TIMESTAMP(6) NOT NULL,
 updated_at TIMESTAMP(6) NOT NULL
);
CREATE INDEX idx_login_background_assets_enabled ON login_background_assets(enabled,sort_order,created_at);
