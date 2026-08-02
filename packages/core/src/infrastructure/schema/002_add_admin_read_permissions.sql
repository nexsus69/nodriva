INSERT INTO permissions (permission_key, name, description, resource_kind) VALUES
  ('user.read', 'Read Users', 'Allows viewing users and their role assignments.', 'user'),
  ('role.read', 'Read Roles', 'Allows viewing roles and permissions.', 'role'),
  ('scope.read', 'Read Scope Assignments', 'Allows viewing hierarchical scope assignments.', 'permission'),
  ('node_type.read', 'Read Node Types', 'Allows viewing node type definitions.', 'node_type'),
  ('entity_type.read', 'Read Entity Types', 'Allows viewing entity type definitions.', 'entity_type'),
  ('system.config.read', 'Read System Configuration', 'Allows viewing runtime configuration and placement policies.', 'system_setting')
ON CONFLICT (permission_key) DO NOTHING;

-- Preserve the effective access of existing administrator roles: a role that can
-- mutate a resource must also be able to open the corresponding admin screens.
INSERT INTO role_permissions (role_id, permission_id)
SELECT DISTINCT rp.role_id, read_permission.id
FROM role_permissions rp
JOIN permissions current_permission ON current_permission.id = rp.permission_id
JOIN permissions read_permission ON read_permission.permission_key = CASE
  WHEN current_permission.permission_key LIKE 'user.%' THEN 'user.read'
  WHEN current_permission.permission_key LIKE 'role.%' THEN 'role.read'
  WHEN current_permission.permission_key LIKE 'scope.%' THEN 'scope.read'
  WHEN current_permission.permission_key LIKE 'node_type.%' THEN 'node_type.read'
  WHEN current_permission.permission_key LIKE 'entity_type.%' THEN 'entity_type.read'
  WHEN current_permission.permission_key = 'system.config' THEN 'system.config.read'
END
WHERE current_permission.permission_key LIKE 'user.%'
   OR current_permission.permission_key LIKE 'role.%'
   OR current_permission.permission_key LIKE 'scope.%'
   OR current_permission.permission_key LIKE 'node_type.%'
   OR current_permission.permission_key LIKE 'entity_type.%'
   OR current_permission.permission_key = 'system.config'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT DISTINCT rp.role_id, entity_read.id
FROM role_permissions rp
JOIN permissions current_permission ON current_permission.id = rp.permission_id
JOIN permissions entity_read ON entity_read.permission_key = 'entity_type.read'
WHERE current_permission.permission_key LIKE 'entity_type.%'
ON CONFLICT DO NOTHING;
