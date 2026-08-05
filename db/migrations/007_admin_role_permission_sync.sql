BEGIN;

-- The system admin role is the complete administrative permission bundle.
-- Permissions introduced after the first seed must be included as well; node
-- and entity data access is still constrained by node_scope_assignments when
-- evaluated against a concrete resource.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.role_key = 'admin'
ON CONFLICT DO NOTHING;

COMMIT;
