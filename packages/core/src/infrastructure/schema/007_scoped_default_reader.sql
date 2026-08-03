-- Global metadata reader plus strict role-backed node scopes.
-- Metadata permissions are global; data permissions are applied through scopes.

INSERT INTO permissions (permission_key, name, description, resource_kind)
VALUES
  ('entity.read', 'Read Entities', 'Allows reading entities within assigned node scopes.', 'entity'),
  ('node.read', 'Read Nodes', 'Allows reading nodes within assigned node scopes.', 'node'),
  ('node_type.read', 'Read Node Types', 'Allows reading node type definitions.', 'node_type'),
  ('entity_type.read', 'Read Entity Types', 'Allows reading entity type definitions.', 'entity_type')
ON CONFLICT (permission_key) DO NOTHING;

INSERT INTO roles (id, role_key, name, description, is_system, row_version)
VALUES (gen_random_uuid(), 'default_reader', 'Default Reader', 'Global read permissions for node and entity type definitions.', true, 1)
ON CONFLICT (role_key) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.permission_key IN ('node_type.read', 'entity_type.read')
WHERE r.role_key = 'default_reader'
ON CONFLICT DO NOTHING;

-- If this migration was partially applied with the previous mixed role
-- definition, remove data-read permissions from the global metadata role.
DELETE FROM role_permissions rp
USING roles r, permissions p
WHERE rp.role_id = r.id
  AND rp.permission_id = p.id
  AND r.role_key = 'default_reader'
  AND p.permission_key IN ('node.read', 'entity.read');

INSERT INTO roles (id, role_key, name, description, is_system, row_version)
VALUES (gen_random_uuid(), 'scoped_reader', 'Scoped Reader', 'Read nodes and entities only within assigned scopes.', true, 1)
ON CONFLICT (role_key) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.permission_key IN ('node.read', 'entity.read')
WHERE r.role_key = 'scoped_reader'
ON CONFLICT DO NOTHING;

-- Scope rows created during the previous mixed-role definition keep their
-- data permissions after the role split.
UPDATE node_scope_assignments nsa
SET role_id = scoped.id
FROM roles previous
JOIN roles scoped ON scoped.role_key = 'scoped_reader'
WHERE previous.role_key = 'default_reader'
  AND nsa.role_id = previous.id;

-- Existing legacy scope rows without a role are converted to the default reader
-- because a scope without a permission bundle cannot be evaluated safely.
UPDATE node_scope_assignments nsa
SET role_id = r.id
FROM roles r
WHERE r.role_key = 'scoped_reader' AND nsa.role_id IS NULL;

ALTER TABLE node_scope_assignments
  ALTER COLUMN role_id SET NOT NULL;

-- Existing users receive the baseline role unless already assigned to it.
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u
JOIN roles r ON r.role_key = 'default_reader'
WHERE NOT EXISTS (
  SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id AND ur.role_id = r.id
);
