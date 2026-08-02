CREATE TABLE IF NOT EXISTS login_captcha_challenges (
  id VARCHAR(64) PRIMARY KEY,
  username VARCHAR(120) NOT NULL,
  ip_address VARCHAR(64) NOT NULL,
  answer_hash VARCHAR(128) NOT NULL,
  expires_at TIMESTAMP(6) NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 5,
  consumed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP(6) NOT NULL
);
CREATE INDEX idx_login_captcha_lookup ON login_captcha_challenges(username, ip_address, expires_at);
INSERT INTO system_settings(setting_key, setting_value, updated_at, version) VALUES
 ('login.captcha.enabled','true',CURRENT_TIMESTAMP,0),
 ('login.captcha.triggerAfterFailures','3',CURRENT_TIMESTAMP,0),
 ('login.captcha.expireSeconds','120',CURRENT_TIMESTAMP,0),
 ('login.captcha.maxAttempts','5',CURRENT_TIMESTAMP,0),
 ('login.captcha.length','5',CURRENT_TIMESTAMP,0),
 ('login.captcha.caseSensitive','false',CURRENT_TIMESTAMP,0)
 ON DUPLICATE KEY UPDATE setting_key=setting_key;
