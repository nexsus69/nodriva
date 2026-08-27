BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS ltree;

CREATE OR REPLACE FUNCTION uuid_generate_v7() RETURNS uuid AS $$
DECLARE
  unix_ts_ms bytea;
  uuid_bytes bytea;
BEGIN
  unix_ts_ms = substring(int8send(floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint) from 3);
  uuid_bytes = gen_random_bytes(10);
  uuid_bytes = set_byte(uuid_bytes, 0, (get_byte(uuid_bytes, 0) & 15) | 112);
  uuid_bytes = set_byte(uuid_bytes, 2, (get_byte(uuid_bytes, 2) & 63) | 128);
  RETURN encode(unix_ts_ms || uuid_bytes, 'hex')::uuid;
END
$$ LANGUAGE plpgsql VOLATILE;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reference_kind_enum') THEN
    CREATE TYPE reference_kind_enum AS ENUM ('node', 'entity', 'user', 'static_list', 'dynamic_query');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'constraint_type_enum') THEN
    CREATE TYPE constraint_type_enum AS ENUM ('min', 'max', 'min_length', 'max_length', 'regex', 'enum', 'precision', 'scale');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'policy_mode_enum') THEN
    CREATE TYPE policy_mode_enum AS ENUM ('allow_all', 'deny_all', 'node_type_whitelist', 'node_subtree_whitelist', 'custom_rule');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'rule_type_enum') THEN
    CREATE TYPE rule_type_enum AS ENUM ('allow_node_type', 'deny_node_type', 'allow_node', 'deny_node', 'allow_subtree', 'deny_subtree');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'resource_kind_enum') THEN
    CREATE TYPE resource_kind_enum AS ENUM (
      'node',
      'entity',
      'node_type',
      'entity_type',
      'user',
      'role',
      'permission',
      'scope_assignment',
      'system_setting',
      'placement_policy',
      'ui_profile',
      'ui_view',
      'ui_component',
      'runtime_capability'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'revision_event_type_enum') THEN
    CREATE TYPE revision_event_type_enum AS ENUM ('created', 'updated', 'moved', 'soft_deleted', 'restored', 'schema_changed');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'setting_value_type_enum') THEN
    CREATE TYPE setting_value_type_enum AS ENUM ('string', 'integer', 'boolean', 'decimal', 'json');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'session_status_enum') THEN
    CREATE TYPE session_status_enum AS ENUM ('active', 'revoked', 'expired');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'assignment_effect_enum') THEN
    CREATE TYPE assignment_effect_enum AS ENUM ('allow', 'deny');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'scope_propagation_enum') THEN
    CREATE TYPE scope_propagation_enum AS ENUM ('self', 'subtree');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'capability_status_enum') THEN
    CREATE TYPE capability_status_enum AS ENUM ('enabled', 'disabled', 'optional');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ui_component_kind_enum') THEN
    CREATE TYPE ui_component_kind_enum AS ENUM (
      'tree',
      'list',
      'detail',
      'breadcrumb',
      'toolbar',
      'header',
      'sidebar',
      'panel',
      'widget',
      'custom'
    );
  END IF;
END$$;

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  email VARCHAR(320) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_super_admin BOOLEAN NOT NULL DEFAULT FALSE,
  row_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ NULL,
  CHECK (row_version >= 1)
);

CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  role_key VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  row_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ NULL,
  CHECK (row_version >= 1)
);

CREATE TABLE permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  permission_key VARCHAR(150) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  resource_kind resource_kind_enum NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE role_permissions (
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE user_roles (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role_id)
);

CREATE TABLE user_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_token_hash TEXT NOT NULL UNIQUE,
  status session_status_enum NOT NULL DEFAULT 'active',
  ip_address INET NULL,
  user_agent TEXT NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ NULL,
  revoked_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (expires_at > issued_at)
);

CREATE TABLE placement_policies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  policy_key VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  policy_mode policy_mode_enum NOT NULL,
  row_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ NULL,
  CHECK (row_version >= 1)
);

CREATE TABLE node_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  type_key VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  current_schema_version INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  row_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ NULL,
  CHECK (current_schema_version >= 1),
  CHECK (row_version >= 1)
);

CREATE TABLE entity_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  type_key VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  storage_table VARCHAR(150) NOT NULL UNIQUE,
  placement_policy_id UUID NULL REFERENCES placement_policies(id) ON DELETE SET NULL,
  current_schema_version INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  row_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ NULL,
  CHECK (current_schema_version >= 1),
  CHECK (row_version >= 1)
);

CREATE TABLE node_type_fields (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  node_type_id UUID NOT NULL REFERENCES node_types(id) ON DELETE CASCADE,
  field_key VARCHAR(100) NOT NULL,
  label VARCHAR(150) NOT NULL,
  column_name VARCHAR(100) NOT NULL,
  data_type VARCHAR(50) NOT NULL,
  is_required BOOLEAN NOT NULL DEFAULT FALSE,
  is_unique BOOLEAN NOT NULL DEFAULT FALSE,
  is_indexed BOOLEAN NOT NULL DEFAULT FALSE,
  default_value_text TEXT NULL,
  position INTEGER NOT NULL,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (node_type_id, field_key),
  UNIQUE (node_type_id, column_name),
  CHECK (position >= 0)
);

CREATE TABLE entity_type_fields (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  entity_type_id UUID NOT NULL REFERENCES entity_types(id) ON DELETE CASCADE,
  field_key VARCHAR(100) NOT NULL,
  label VARCHAR(150) NOT NULL,
  column_name VARCHAR(100) NOT NULL,
  data_type VARCHAR(50) NOT NULL,
  is_required BOOLEAN NOT NULL DEFAULT FALSE,
  is_unique BOOLEAN NOT NULL DEFAULT FALSE,
  is_indexed BOOLEAN NOT NULL DEFAULT FALSE,
  default_value_text TEXT NULL,
  position INTEGER NOT NULL,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (entity_type_id, field_key),
  UNIQUE (entity_type_id, column_name),
  CHECK (position >= 0)
);

CREATE TABLE node_type_field_constraints (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  field_id UUID NOT NULL REFERENCES node_type_fields(id) ON DELETE CASCADE,
  constraint_type constraint_type_enum NOT NULL,
  constraint_value_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE entity_type_field_constraints (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  field_id UUID NOT NULL REFERENCES entity_type_fields(id) ON DELETE CASCADE,
  constraint_type constraint_type_enum NOT NULL,
  constraint_value_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE node_type_field_references (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  field_id UUID NOT NULL REFERENCES node_type_fields(id) ON DELETE CASCADE,
  reference_kind reference_kind_enum NOT NULL,
  target_node_type_id UUID NULL REFERENCES node_types(id) ON DELETE SET NULL,
  target_entity_type_id UUID NULL REFERENCES entity_types(id) ON DELETE SET NULL,
  target_table_name VARCHAR(150) NULL,
  target_column_name VARCHAR(100) NULL,
  is_multiple BOOLEAN NOT NULL DEFAULT FALSE,
  on_delete_action VARCHAR(30) NOT NULL DEFAULT 'restrict',
  on_update_action VARCHAR(30) NOT NULL DEFAULT 'cascade',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (reference_kind = 'node' AND target_node_type_id IS NOT NULL AND target_entity_type_id IS NULL)
    OR
    (reference_kind = 'entity' AND target_entity_type_id IS NOT NULL AND target_node_type_id IS NULL)
    OR
    (reference_kind IN ('user', 'static_list', 'dynamic_query') AND target_node_type_id IS NULL AND target_entity_type_id IS NULL)
  )
);

CREATE TABLE entity_type_field_references (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  field_id UUID NOT NULL REFERENCES entity_type_fields(id) ON DELETE CASCADE,
  reference_kind reference_kind_enum NOT NULL,
  target_node_type_id UUID NULL REFERENCES node_types(id) ON DELETE SET NULL,
  target_entity_type_id UUID NULL REFERENCES entity_types(id) ON DELETE SET NULL,
  target_table_name VARCHAR(150) NULL,
  target_column_name VARCHAR(100) NULL,
  is_multiple BOOLEAN NOT NULL DEFAULT FALSE,
  on_delete_action VARCHAR(30) NOT NULL DEFAULT 'restrict',
  on_update_action VARCHAR(30) NOT NULL DEFAULT 'cascade',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (reference_kind = 'node' AND target_node_type_id IS NOT NULL AND target_entity_type_id IS NULL)
    OR
    (reference_kind = 'entity' AND target_entity_type_id IS NOT NULL AND target_node_type_id IS NULL)
    OR
    (reference_kind IN ('user', 'static_list', 'dynamic_query') AND target_node_type_id IS NULL AND target_entity_type_id IS NULL)
  )
);

CREATE TABLE nodes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  parent_id UUID NULL REFERENCES nodes(id) ON DELETE RESTRICT,
  path LTREE NOT NULL,
  path_label VARCHAR(120) NOT NULL,
  depth INTEGER NOT NULL,
  node_type_id UUID NOT NULL REFERENCES node_types(id) ON DELETE RESTRICT,
  name VARCHAR(255) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  row_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ NULL,
  created_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  CHECK (depth >= 0),
  CHECK (row_version >= 1),
  CHECK (path_label ~ '^[A-Za-z0-9_]+$')
);

CREATE TABLE entities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  entity_type_id UUID NOT NULL REFERENCES entity_types(id) ON DELETE RESTRICT,
  parent_node_id UUID NOT NULL REFERENCES nodes(id) ON DELETE RESTRICT,
  name VARCHAR(255) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  row_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ NULL,
  created_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  CHECK (row_version >= 1)
);

CREATE UNIQUE INDEX uq_nodes_parent_id_path_label_active
  ON nodes(parent_id, path_label)
  NULLS NOT DISTINCT
  WHERE deleted_at IS NULL;

CREATE TABLE node_scope_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  node_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  assignment_effect assignment_effect_enum NOT NULL DEFAULT 'allow',
  propagation scope_propagation_enum NOT NULL DEFAULT 'subtree',
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  assigned_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE (user_id, node_id, role_id, assignment_effect, propagation)
);

CREATE TABLE placement_policy_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  placement_policy_id UUID NOT NULL REFERENCES placement_policies(id) ON DELETE CASCADE,
  rule_type rule_type_enum NOT NULL,
  target_node_id UUID NULL REFERENCES nodes(id) ON DELETE CASCADE,
  target_node_type_id UUID NULL REFERENCES node_types(id) ON DELETE CASCADE,
  comparator VARCHAR(30) NULL,
  value_text TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE runtime_capabilities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  capability_key VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  default_status capability_status_enum NOT NULL DEFAULT 'optional',
  is_system BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE runtime_capability_overrides (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  capability_id UUID NOT NULL REFERENCES runtime_capabilities(id) ON DELETE CASCADE,
  scope_key VARCHAR(100) NOT NULL DEFAULT 'global',
  status capability_status_enum NOT NULL,
  updated_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (capability_id, scope_key)
);

CREATE TABLE ui_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  profile_key VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  row_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ NULL,
  CHECK (row_version >= 1)
);

CREATE UNIQUE INDEX uq_ui_profiles_default_active
  ON ui_profiles(is_default)
  WHERE is_default = TRUE AND deleted_at IS NULL;

CREATE TABLE ui_views (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  ui_profile_id UUID NOT NULL REFERENCES ui_profiles(id) ON DELETE CASCADE,
  view_key VARCHAR(100) NOT NULL,
  name VARCHAR(150) NOT NULL,
  route_pattern VARCHAR(255) NULL,
  entity_type_id UUID NULL REFERENCES entity_types(id) ON DELETE CASCADE,
  node_type_id UUID NULL REFERENCES node_types(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (ui_profile_id, view_key),
  CHECK (position >= 0)
);

CREATE TABLE ui_view_regions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  ui_view_id UUID NOT NULL REFERENCES ui_views(id) ON DELETE CASCADE,
  region_key VARCHAR(100) NOT NULL,
  name VARCHAR(150) NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (ui_view_id, region_key),
  CHECK (position >= 0)
);

CREATE TABLE ui_components (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  ui_view_region_id UUID NOT NULL REFERENCES ui_view_regions(id) ON DELETE CASCADE,
  component_key VARCHAR(100) NOT NULL,
  component_kind ui_component_kind_enum NOT NULL,
  title VARCHAR(150) NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (ui_view_region_id, component_key),
  CHECK (position >= 0)
);

CREATE TABLE ui_component_bindings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  ui_component_id UUID NOT NULL REFERENCES ui_components(id) ON DELETE CASCADE,
  binding_key VARCHAR(100) NOT NULL,
  binding_value_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (ui_component_id, binding_key)
);

CREATE TABLE locks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES user_sessions(id) ON DELETE CASCADE,
  acquired_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  UNIQUE (resource_type, resource_id)
);

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  actor_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  action_key VARCHAR(150) NOT NULL,
  resource_kind TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  node_id UUID NULL REFERENCES nodes(id) ON DELETE SET NULL,
  before_payload JSONB NULL,
  after_payload JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE entity_revisions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  revision_number INTEGER NOT NULL,
  event_type revision_event_type_enum NOT NULL,
  entity_row_version INTEGER NOT NULL,
  schema_version INTEGER NOT NULL,
  snapshot_payload JSONB NOT NULL,
  created_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (entity_id, revision_number),
  CHECK (revision_number >= 1),
  CHECK (entity_row_version >= 1),
  CHECK (schema_version >= 1)
);

CREATE TABLE node_revisions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  node_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  revision_number INTEGER NOT NULL,
  event_type revision_event_type_enum NOT NULL,
  node_row_version INTEGER NOT NULL,
  schema_version INTEGER NOT NULL,
  snapshot_payload JSONB NOT NULL,
  created_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (node_id, revision_number),
  CHECK (revision_number >= 1),
  CHECK (node_row_version >= 1),
  CHECK (schema_version >= 1)
);

CREATE TABLE entity_type_revisions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  entity_type_id UUID NOT NULL REFERENCES entity_types(id) ON DELETE CASCADE,
  revision_number INTEGER NOT NULL,
  event_type revision_event_type_enum NOT NULL,
  schema_version INTEGER NOT NULL,
  snapshot_payload JSONB NOT NULL,
  created_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (entity_type_id, revision_number),
  CHECK (revision_number >= 1),
  CHECK (schema_version >= 1)
);

CREATE TABLE system_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  category VARCHAR(100) NOT NULL,
  setting_key VARCHAR(150) NOT NULL UNIQUE,
  display_name VARCHAR(150) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  value_type setting_value_type_enum NOT NULL,
  value_text TEXT NULL,
  value_json JSONB NULL,
  is_secret BOOLEAN NOT NULL DEFAULT FALSE,
  is_runtime_overridable BOOLEAN NOT NULL DEFAULT FALSE,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  row_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  deleted_at TIMESTAMPTZ NULL,
  CHECK (row_version >= 1),
  CHECK (
    (value_type = 'json' AND value_json IS NOT NULL)
    OR
    (value_type <> 'json')
  )
);

CREATE TABLE system_setting_revisions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  system_setting_id UUID NOT NULL REFERENCES system_settings(id) ON DELETE CASCADE,
  revision_number INTEGER NOT NULL,
  event_type revision_event_type_enum NOT NULL,
  snapshot_payload JSONB NOT NULL,
  created_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (system_setting_id, revision_number),
  CHECK (revision_number >= 1)
);

CREATE INDEX idx_nodes_parent_id ON nodes(parent_id);
CREATE INDEX idx_nodes_node_type_id ON nodes(node_type_id);
CREATE INDEX idx_nodes_deleted_at ON nodes(deleted_at);
CREATE INDEX idx_nodes_path_gist ON nodes USING GIST (path);
CREATE INDEX idx_nodes_path_btree ON nodes(path);

CREATE INDEX idx_entities_parent_node_id ON entities(parent_node_id);
CREATE INDEX idx_entities_entity_type_id ON entities(entity_type_id);
CREATE INDEX idx_entities_deleted_at ON entities(deleted_at);

CREATE INDEX idx_node_scope_assignments_user_id ON node_scope_assignments(user_id);
CREATE INDEX idx_node_scope_assignments_node_id ON node_scope_assignments(node_id);
CREATE INDEX idx_node_scope_assignments_role_id ON node_scope_assignments(role_id);

CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_status ON user_sessions(status);
CREATE INDEX idx_user_sessions_expires_at ON user_sessions(expires_at);

CREATE INDEX idx_entity_revisions_entity_id ON entity_revisions(entity_id);
CREATE INDEX idx_node_revisions_node_id ON node_revisions(node_id);
CREATE INDEX idx_entity_type_revisions_entity_type_id ON entity_type_revisions(entity_type_id);
CREATE INDEX idx_system_setting_revisions_setting_id ON system_setting_revisions(system_setting_id);

CREATE INDEX idx_locks_owner ON locks(user_id);
CREATE INDEX idx_locks_expires_at ON locks(expires_at);

CREATE INDEX idx_audit_logs_actor_user_id ON audit_logs(actor_user_id);
CREATE INDEX idx_audit_logs_resource_kind_resource_id ON audit_logs(resource_kind, resource_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

CREATE INDEX idx_system_settings_category ON system_settings(category);
CREATE INDEX idx_system_settings_deleted_at ON system_settings(deleted_at);

CREATE INDEX idx_runtime_capability_overrides_scope_key ON runtime_capability_overrides(scope_key);
CREATE INDEX idx_ui_views_profile_id ON ui_views(ui_profile_id);
CREATE INDEX idx_ui_views_entity_type_id ON ui_views(entity_type_id);
CREATE INDEX idx_ui_views_node_type_id ON ui_views(node_type_id);
CREATE INDEX idx_ui_view_regions_view_id ON ui_view_regions(ui_view_id);
CREATE INDEX idx_ui_components_region_id ON ui_components(ui_view_region_id);

CREATE OR REPLACE FUNCTION trg_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_users_set_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION trg_set_updated_at();

CREATE TRIGGER trg_roles_set_updated_at
BEFORE UPDATE ON roles
FOR EACH ROW
EXECUTE FUNCTION trg_set_updated_at();

CREATE TRIGGER trg_user_sessions_set_updated_at
BEFORE UPDATE ON user_sessions
FOR EACH ROW
EXECUTE FUNCTION trg_set_updated_at();

CREATE TRIGGER trg_placement_policies_set_updated_at
BEFORE UPDATE ON placement_policies
FOR EACH ROW
EXECUTE FUNCTION trg_set_updated_at();

CREATE TRIGGER trg_node_types_set_updated_at
BEFORE UPDATE ON node_types
FOR EACH ROW
EXECUTE FUNCTION trg_set_updated_at();

CREATE TRIGGER trg_entity_types_set_updated_at
BEFORE UPDATE ON entity_types
FOR EACH ROW
EXECUTE FUNCTION trg_set_updated_at();

CREATE TRIGGER trg_node_type_fields_set_updated_at
BEFORE UPDATE ON node_type_fields
FOR EACH ROW
EXECUTE FUNCTION trg_set_updated_at();

CREATE TRIGGER trg_entity_type_fields_set_updated_at
BEFORE UPDATE ON entity_type_fields
FOR EACH ROW
EXECUTE FUNCTION trg_set_updated_at();

CREATE TRIGGER trg_nodes_set_updated_at
BEFORE UPDATE ON nodes
FOR EACH ROW
EXECUTE FUNCTION trg_set_updated_at();

CREATE TRIGGER trg_entities_set_updated_at
BEFORE UPDATE ON entities
FOR EACH ROW
EXECUTE FUNCTION trg_set_updated_at();

CREATE TRIGGER trg_system_settings_set_updated_at
BEFORE UPDATE ON system_settings
FOR EACH ROW
EXECUTE FUNCTION trg_set_updated_at();

CREATE TRIGGER trg_runtime_capabilities_set_updated_at
BEFORE UPDATE ON runtime_capabilities
FOR EACH ROW
EXECUTE FUNCTION trg_set_updated_at();

CREATE TRIGGER trg_runtime_capability_overrides_set_updated_at
BEFORE UPDATE ON runtime_capability_overrides
FOR EACH ROW
EXECUTE FUNCTION trg_set_updated_at();

CREATE TRIGGER trg_ui_profiles_set_updated_at
BEFORE UPDATE ON ui_profiles
FOR EACH ROW
EXECUTE FUNCTION trg_set_updated_at();

CREATE TRIGGER trg_ui_views_set_updated_at
BEFORE UPDATE ON ui_views
FOR EACH ROW
EXECUTE FUNCTION trg_set_updated_at();

CREATE TRIGGER trg_ui_components_set_updated_at
BEFORE UPDATE ON ui_components
FOR EACH ROW
EXECUTE FUNCTION trg_set_updated_at();

CREATE OR REPLACE FUNCTION assert_node_is_not_descendant(
  p_node_id UUID,
  p_new_parent_id UUID
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_node_path LTREE;
  v_parent_path LTREE;
BEGIN
  IF p_new_parent_id IS NULL THEN
    RETURN;
  END IF;

  IF p_node_id = p_new_parent_id THEN
    RAISE EXCEPTION 'Node cannot be parent of itself';
  END IF;

  SELECT path INTO v_node_path
  FROM nodes
  WHERE id = p_node_id
    AND deleted_at IS NULL;

  IF v_node_path IS NULL THEN
    RAISE EXCEPTION 'Node % not found', p_node_id;
  END IF;

  SELECT path INTO v_parent_path
  FROM nodes
  WHERE id = p_new_parent_id
    AND deleted_at IS NULL;

  IF v_parent_path IS NULL THEN
    RAISE EXCEPTION 'Parent node % not found', p_new_parent_id;
  END IF;

  IF v_parent_path <@ v_node_path THEN
    RAISE EXCEPTION 'Cannot move a node under its own descendant';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION move_node_subtree(
  p_node_id UUID,
  p_new_parent_id UUID,
  p_actor_user_id UUID DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_old_path LTREE;
  v_new_parent_path LTREE;
  v_new_path LTREE;
  v_new_depth INTEGER;
  v_old_nlevel INTEGER;
  v_label TEXT;
BEGIN
  PERFORM assert_node_is_not_descendant(p_node_id, p_new_parent_id);

  SELECT path, path_label INTO v_old_path, v_label
  FROM nodes
  WHERE id = p_node_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF v_old_path IS NULL THEN
    RAISE EXCEPTION 'Node % not found', p_node_id;
  END IF;

  IF p_new_parent_id IS NULL THEN
    v_new_path := text2ltree(v_label);
    v_new_depth := 0;
  ELSE
    SELECT path INTO v_new_parent_path
    FROM nodes
    WHERE id = p_new_parent_id
      AND deleted_at IS NULL
    FOR UPDATE;

    IF v_new_parent_path IS NULL THEN
      RAISE EXCEPTION 'Parent node % not found', p_new_parent_id;
    END IF;

    v_new_path := v_new_parent_path || text2ltree(v_label);
    v_new_depth := nlevel(v_new_path) - 1;
  END IF;

  v_old_nlevel := nlevel(v_old_path);

  UPDATE nodes
  SET
    parent_id = p_new_parent_id,
    path = v_new_path,
    depth = v_new_depth,
    row_version = row_version + 1,
    updated_by = COALESCE(p_actor_user_id, updated_by)
  WHERE id = p_node_id;

  UPDATE nodes
  SET
    path = v_new_path || subpath(path, v_old_nlevel),
    depth = nlevel(v_new_path || subpath(path, v_old_nlevel)) - 1,
    row_version = row_version + 1,
    updated_by = COALESCE(p_actor_user_id, updated_by)
  WHERE id <> p_node_id
    AND path <@ v_old_path;
END;
$$;

CREATE OR REPLACE FUNCTION cleanup_expired_locks()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  DELETE FROM locks
  WHERE expires_at <= now();

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN v_deleted_count;
END;
$$;

CREATE OR REPLACE FUNCTION touch_lock(
  p_resource_type TEXT,
  p_resource_id TEXT,
  p_user_id UUID,
  p_extend_until TIMESTAMPTZ
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_updated_count INTEGER;
BEGIN
  UPDATE locks
  SET expires_at = p_extend_until
  WHERE resource_type = p_resource_type
    AND resource_id = p_resource_id
    AND user_id = p_user_id;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RETURN v_updated_count = 1;
END;
$$;

COMMIT;
