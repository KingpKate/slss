ALTER TABLE refresh_tokens ADD COLUMN user_agent VARCHAR(500), ADD COLUMN ip_address VARCHAR(64);
ALTER TABLE production_import_jobs ADD COLUMN input_data LONGBLOB, ADD COLUMN retry_of BIGINT NULL, ADD CONSTRAINT fk_import_retry_of FOREIGN KEY(retry_of) REFERENCES production_import_jobs(id);
