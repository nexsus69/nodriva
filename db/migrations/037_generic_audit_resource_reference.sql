BEGIN;

-- Audit entries must be able to trace generic workflow subjects. Permissions
-- keep their typed resource enum; only the audit reference is widened so an
-- immutable history can identify future modules without a schema migration.
ALTER TABLE audit_logs
  ALTER COLUMN resource_kind TYPE TEXT USING resource_kind::text,
  ALTER COLUMN resource_id TYPE TEXT USING resource_id::text;

COMMIT;
