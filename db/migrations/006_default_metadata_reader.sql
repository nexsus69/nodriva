BEGIN;

INSERT INTO roles (id, role_key, name, description, is_system, row_version)
VALUES (
  gen_random_uuid(),
  'default_reader',
  'Default Reader',
  'Global read access to node and entity type metadata; data remains scope-bound.',
  true,
  1
)
ON CONFLICT (role_key) DO UPDATE
SET name = EXCLUDED.name, description = EXCLUDED.description;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.permission_key IN ('node_type.read', 'entity_type.read')
WHERE r.role_key = 'default_reader'
ON CONFLICT DO NOTHING;

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u
JOIN roles r ON r.role_key = 'default_reader'
WHERE u.is_active = true AND u.deleted_at IS NULL
ON CONFLICT DO NOTHING;

COMMIT;
