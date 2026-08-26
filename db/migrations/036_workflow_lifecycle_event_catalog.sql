BEGIN;

-- These are generic lifecycle contracts, not workflow definitions. A module
-- may register additional subject kinds or entirely different event types
-- without changing the workflow engine or its storage schema.
INSERT INTO workflow_event_types (event_type, subject_kinds, payload_version, is_active)
VALUES
  ('record.created', '["node", "entity"]'::jsonb, 1, TRUE),
  ('record.updated', '["node", "entity"]'::jsonb, 1, TRUE),
  ('record.deleted', '["node", "entity"]'::jsonb, 1, TRUE),
  ('record.restored', '["node", "entity"]'::jsonb, 1, TRUE),
  ('hierarchy.moved', '["node"]'::jsonb, 1, TRUE)
ON CONFLICT (event_type) DO NOTHING;

COMMIT;
