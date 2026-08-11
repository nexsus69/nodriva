BEGIN;

ALTER TABLE nodes ADD COLUMN IF NOT EXISTS deletion_batch_id UUID NULL;
ALTER TABLE entities ADD COLUMN IF NOT EXISTS deletion_batch_id UUID NULL;

CREATE INDEX IF NOT EXISTS idx_nodes_deletion_batch_id ON nodes (deletion_batch_id) WHERE deletion_batch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_entities_deletion_batch_id ON entities (deletion_batch_id) WHERE deletion_batch_id IS NOT NULL;

INSERT INTO permissions (id, permission_key, name, description, resource_kind)
VALUES
  (gen_random_uuid(), 'node.delete', 'Delete Node Subtree', 'Allows soft-deleting a node and its scoped subtree.', 'node'::resource_kind_enum),
  (gen_random_uuid(), 'node.restore', 'Restore Node Subtree', 'Allows restoring a deleted node subtree within assigned scopes.', 'node'::resource_kind_enum),
  (gen_random_uuid(), 'node.purge', 'Permanently Delete Node Subtree', 'Allows permanently deleting a deleted node subtree.', 'node'::resource_kind_enum)
ON CONFLICT (permission_key) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.role_key = 'admin'
  AND p.permission_key IN ('node.delete', 'node.restore', 'node.purge')
ON CONFLICT DO NOTHING;

COMMIT;
