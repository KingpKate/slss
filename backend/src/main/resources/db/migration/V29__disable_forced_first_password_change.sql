-- 首次登录强制改密功能已下线，保留历史列以兼容旧数据。
ALTER TABLE users ALTER COLUMN must_change_password SET DEFAULT FALSE;
UPDATE users SET must_change_password = FALSE WHERE must_change_password = TRUE;
