BEGIN;

-- Preserve a human-readable resource snapshot without changing the generic
-- resource reference contract. Historical rows remain NULL and use the UI
-- fallback to resource kind plus technical identifier.
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS resource_label TEXT;

COMMIT;
