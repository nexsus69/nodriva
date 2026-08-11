BEGIN;

INSERT INTO permissions (id, permission_key, name, description, resource_kind)
VALUES
  (gen_random_uuid(), 'entity.restore', 'Restore Entity', 'Allows restoring soft-deleted entities within assigned node scopes.', 'entity'::resource_kind_enum),
  (gen_random_uuid(), 'entity.purge', 'Permanently Delete Entity', 'Allows permanently deleting soft-deleted entities within assigned node scopes.', 'entity'::resource_kind_enum)
ON CONFLICT (permission_key) DO NOTHING;

-- Keep the system administrator bundle complete for installations upgraded
-- after the original seed. Delegated roles receive these permissions only
-- when explicitly assigned by an authorized security administrator.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.role_key = 'admin'
  AND p.permission_key IN ('entity.restore', 'entity.purge')
ON CONFLICT DO NOTHING;

COMMIT;
