BEGIN;

-- Preserve legacy sessions by converting the historical raw token to the
-- canonical SHA-256 representation before removing the legacy table.
DO $$
BEGIN
  IF to_regclass('public.sessions') IS NOT NULL THEN
    INSERT INTO user_sessions (
      id, user_id, session_token_hash, status, issued_at, last_seen_at,
      expires_at, created_at, updated_at
    )
    SELECT
      id,
      user_id,
      encode(digest(token, 'sha256'), 'hex'),
      CASE WHEN expires_at > now() THEN 'active'::session_status_enum ELSE 'expired'::session_status_enum END,
      created_at,
      COALESCE(last_used_at, created_at),
      expires_at,
      created_at,
      COALESCE(last_used_at, created_at)
    FROM sessions
    ON CONFLICT (session_token_hash) DO NOTHING;

    DROP TABLE sessions;
  END IF;
END
$$;

-- Keep the canonical system-role definition in the deployment migration path.
INSERT INTO permissions (permission_key, name, description, resource_kind)
VALUES
  ('entity.read', 'Read Entities', 'Allows reading entities within assigned node scopes.', 'entity'),
  ('node.read', 'Read Nodes', 'Allows reading nodes within assigned node scopes.', 'node'),
  ('node_type.read', 'Read Node Types', 'Allows reading node type definitions.', 'node_type'),
  ('entity_type.read', 'Read Entity Types', 'Allows reading entity type definitions.', 'entity_type')
ON CONFLICT (permission_key) DO NOTHING;

INSERT INTO roles (id, role_key, name, description, is_system, row_version)
VALUES (
  gen_random_uuid(), 'scoped_reader', 'Scoped Reader',
  'Read nodes and entities only within assigned scopes.', true, 1
)
ON CONFLICT (role_key) DO UPDATE
SET name = EXCLUDED.name, description = EXCLUDED.description, is_system = true;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.permission_key IN ('node.read', 'entity.read')
WHERE r.role_key = 'scoped_reader'
ON CONFLICT DO NOTHING;

DELETE FROM role_permissions rp
USING roles r, permissions p
WHERE rp.role_id = r.id AND rp.permission_id = p.id
  AND r.role_key = 'default_reader'
  AND p.permission_key IN ('node.read', 'entity.read');

UPDATE node_scope_assignments nsa
SET role_id = scoped.id
FROM roles previous
JOIN roles scoped ON scoped.role_key = 'scoped_reader'
WHERE previous.role_key = 'default_reader' AND nsa.role_id = previous.id;

UPDATE node_scope_assignments nsa
SET role_id = r.id
FROM roles r
WHERE r.role_key = 'scoped_reader' AND nsa.role_id IS NULL;

ALTER TABLE node_scope_assignments ALTER COLUMN role_id SET NOT NULL;

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u
JOIN roles r ON r.role_key = 'default_reader'
WHERE u.is_active AND u.deleted_at IS NULL
ON CONFLICT DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_nsa_user_effect_propagation_role_node
  ON node_scope_assignments (user_id, assignment_effect, propagation, role_id, node_id);

-- The old constraint included assignment_effect and therefore allowed a
-- contradictory allow/deny pair. Stop with evidence if such rows already
-- exist instead of silently choosing one.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM node_scope_assignments
    GROUP BY user_id, node_id, role_id, propagation
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Contradictory scope assignments exist; resolve them before applying migration 009';
  END IF;
END
$$;

ALTER TABLE node_scope_assignments
  DROP CONSTRAINT IF EXISTS node_scope_assignments_user_id_node_id_role_id_assignment_e_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_nsa_user_node_role_propagation
  ON node_scope_assignments (user_id, node_id, role_id, propagation);

-- Group role for the Web login. The deployment creates a LOGIN role and grants
-- it dashboard_app; no password is stored in the repository.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dashboard_app') THEN
    CREATE ROLE dashboard_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
  END IF;
END
$$;

GRANT USAGE, CREATE ON SCHEMA public TO dashboard_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO dashboard_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO dashboard_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO dashboard_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO dashboard_app;

REVOKE UPDATE, DELETE, TRUNCATE ON audit_logs FROM dashboard_app;
GRANT SELECT, INSERT ON audit_logs TO dashboard_app;

COMMIT;
