BEGIN;
ALTER TABLE resource_relationships
  ADD COLUMN IF NOT EXISTS suspension_deletion_batch_id UUID;
CREATE INDEX IF NOT EXISTS idx_resource_relationships_suspension_batch
  ON resource_relationships (suspension_deletion_batch_id)
  WHERE suspended_at IS NOT NULL;
COMMIT;
