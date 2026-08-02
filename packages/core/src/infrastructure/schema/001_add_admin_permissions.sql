-- Migration: Add Admin Permissions for HRBAC
-- Assumes resource_kind_enum has the required values

INSERT INTO permissions (permission_key, name, description, resource_kind) VALUES
  ('user.create', 'Create User', 'Allows creating new users in the system.', 'user'),
  ('user.update', 'Update User', 'Allows updating existing users.', 'user'),
  ('user.delete', 'Delete User', 'Allows deleting (or soft-deleting/disabling) users.', 'user'),
  ('user.assign_roles', 'Assign Roles to User', 'Allows assigning or removing roles from users.', 'user'),
  
  ('role.create', 'Create Role', 'Allows creating new roles.', 'role'),
  ('role.update', 'Update Role', 'Allows updating roles and their permissions.', 'role'),
  ('role.delete', 'Delete Role', 'Allows deleting roles.', 'role'),
  
  ('scope.assign', 'Assign Scope', 'Allows creating scope assignments to grant roles to users on specific nodes.', 'permission'),
  ('scope.delete', 'Delete Scope Assignment', 'Allows removing scope assignments.', 'permission'),
  
  ('node_type.create', 'Create Node Type', 'Allows defining new node types.', 'node_type'),
  ('node_type.update', 'Update Node Type', 'Allows modifying node types.', 'node_type'),
  ('node_type.delete', 'Delete Node Type', 'Allows disabling or deleting node types.', 'node_type'),
  ('entity_type.create', 'Create Entity Type', 'Allows defining new entity types.', 'entity_type'),
  ('entity_type.update', 'Update Entity Type', 'Allows modifying entity types.', 'entity_type'),
  ('entity_type.delete', 'Delete Entity Type', 'Allows disabling or deleting entity types.', 'entity_type'),
  
  ('system.config', 'System Configuration', 'Allows updating runtime capabilities and system settings.', 'system_setting'),
  
  ('audit.access', 'Access Audit Logs', 'Allows reading system audit logs.', 'system_setting'),

  ('entity.move', 'Move Entity', 'Allows moving an entity to a different node.', 'entity')
ON CONFLICT (permission_key) DO NOTHING;
