-- Soft-deleted templates must not reserve a customer/model pair forever.
-- Active-template uniqueness is enforced by the application repository query.
ALTER TABLE scan_templates DROP INDEX uk_scan_template_customer_model;
