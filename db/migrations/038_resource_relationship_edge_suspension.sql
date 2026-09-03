BEGIN;

-- An edge is active exactly when suspended_at IS NULL. Soft deletion preserves
-- outbound edges for a later restore instead of destroying relationship history.
ALTER TABLE resource_relationships
  ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;

DROP INDEX IF EXISTS uq_resource_relationships_source_one;
CREATE UNIQUE INDEX uq_resource_relationships_source_one
  ON resource_relationships (source_field_id, source_domain, source_resource_id)
  WHERE source_cardinality = 'one' AND suspended_at IS NULL;

DROP INDEX IF EXISTS uq_resource_relationships_target_one;
CREATE UNIQUE INDEX uq_resource_relationships_target_one
  ON resource_relationships (source_field_id, target_domain, target_resource_id)
  WHERE target_is_unique AND suspended_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_resource_relationships_active_incoming
  ON resource_relationships (target_domain, target_resource_id, source_field_id, position)
  WHERE suspended_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_resource_relationships_active_outgoing
  ON resource_relationships (source_domain, source_resource_id, source_field_id, position)
  WHERE suspended_at IS NULL;

COMMIT;
