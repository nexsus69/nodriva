BEGIN;

-- Supports authorized distinct-value catalogues used by semantic audit filters.
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_key ON audit_logs(action_key);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_kind ON audit_logs(resource_kind);

COMMIT;
