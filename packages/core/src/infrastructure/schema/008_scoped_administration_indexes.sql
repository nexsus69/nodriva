-- Set-based delegated-administration reads: actor -> role permission -> scope
-- and scope -> hierarchy containment are the hot paths.
CREATE INDEX IF NOT EXISTS idx_nsa_user_effect_propagation_role_node
  ON node_scope_assignments (user_id, assignment_effect, propagation, role_id, node_id);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role_permission
  ON role_permissions (role_id, permission_id);

CREATE INDEX IF NOT EXISTS idx_user_roles_user_role
  ON user_roles (user_id, role_id);
