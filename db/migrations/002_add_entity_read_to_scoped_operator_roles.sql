-- Operator roles that can create/edit/delete entities must also be able to
-- read them. entity.read remains scope-bound by AccessControlPortPostgres.
-- The migration is idempotent and does not grant global entity visibility.

INSERT INTO permissions (id, permission_key, name, description, resource_kind)
VALUES (
  gen_random_uuid(),
  'entity.read',
  'Read Entities',
  'Allows reading entities within assigned node scopes.',
  'entity'::resource_kind_enum
)
ON CONFLICT (permission_key) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.permission_key = 'entity.read'
WHERE r.role_key = 'simple_user'
ON CONFLICT DO NOTHING;
