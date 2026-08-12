import { SqliteDatabase } from './SqliteDatabase.js';

/** Core relational schema shared by the standalone SQLite adapter. */
export function ensureSqliteSchema(database: SqliteDatabase): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS node_types (
      id TEXT PRIMARY KEY,
      type_key TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      current_schema_version INTEGER NOT NULL DEFAULT 1,
      is_active INTEGER NOT NULL DEFAULT 1,
      deleted_at TEXT
    );
    CREATE TABLE IF NOT EXISTS nodes (
      id TEXT PRIMARY KEY,
      parent_id TEXT REFERENCES nodes(id),
      path TEXT NOT NULL,
      path_label TEXT NOT NULL,
      depth INTEGER NOT NULL,
      node_type_id TEXT NOT NULL REFERENCES node_types(id),
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      row_version INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      deletion_batch_id TEXT,
      created_by TEXT,
      updated_by TEXT,
      payload TEXT NOT NULL DEFAULT '{}',
      UNIQUE(parent_id, path_label)
    );
    CREATE INDEX IF NOT EXISTS idx_sqlite_nodes_parent_active
      ON nodes(parent_id, deleted_at, name);
    CREATE INDEX IF NOT EXISTS idx_sqlite_nodes_path_active
      ON nodes(path, deleted_at);
    CREATE TABLE IF NOT EXISTS node_hierarchy (
      ancestor_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
      descendant_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
      depth INTEGER NOT NULL,
      PRIMARY KEY (ancestor_id, descendant_id)
    );
    CREATE INDEX IF NOT EXISTS idx_sqlite_node_hierarchy_descendant
      ON node_hierarchy(descendant_id, depth);
    CREATE TABLE IF NOT EXISTS entities (
      id TEXT PRIMARY KEY,
      entity_type_id TEXT NOT NULL REFERENCES entity_types(id),
      parent_node_id TEXT NOT NULL REFERENCES nodes(id),
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      deleted_at TEXT,
      deletion_batch_id TEXT,
      row_version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      created_by TEXT,
      updated_by TEXT,
      payload TEXT NOT NULL DEFAULT '{}'
    );
    CREATE TABLE IF NOT EXISTS entity_types (
      id TEXT PRIMARY KEY,
      type_key TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      storage_table TEXT NOT NULL,
      current_schema_version INTEGER NOT NULL DEFAULT 1,
      is_active INTEGER NOT NULL DEFAULT 1,
      deleted_at TEXT
    );
    CREATE TABLE IF NOT EXISTS locks (
      id TEXT PRIMARY KEY,
      resource_type TEXT NOT NULL,
      resource_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      acquired_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      UNIQUE(resource_type, resource_id)
    );
    CREATE INDEX IF NOT EXISTS idx_sqlite_locks_expiry ON locks(expires_at);
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL DEFAULT '' UNIQUE,
      password_hash TEXT NOT NULL DEFAULT '',
      is_active INTEGER NOT NULL DEFAULT 1,
      is_super_admin INTEGER NOT NULL DEFAULT 0,
      row_version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      deleted_at TEXT
    );
    CREATE TABLE IF NOT EXISTS roles (id TEXT PRIMARY KEY, role_key TEXT NOT NULL UNIQUE, name TEXT NOT NULL DEFAULT '', deleted_at TEXT);
    CREATE TABLE IF NOT EXISTS permissions (id TEXT PRIMARY KEY, permission_key TEXT NOT NULL UNIQUE, name TEXT);
    CREATE TABLE IF NOT EXISTS user_roles (user_id TEXT NOT NULL REFERENCES users(id), role_id TEXT NOT NULL REFERENCES roles(id), PRIMARY KEY(user_id, role_id));
    CREATE TABLE IF NOT EXISTS role_permissions (role_id TEXT NOT NULL REFERENCES roles(id), permission_id TEXT NOT NULL REFERENCES permissions(id), PRIMARY KEY(role_id, permission_id));
    CREATE TABLE IF NOT EXISTS node_scope_assignments (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      role_id TEXT NOT NULL REFERENCES roles(id),
      node_id TEXT NOT NULL REFERENCES nodes(id),
      assignment_effect TEXT NOT NULL CHECK (assignment_effect IN ('allow','deny')),
      propagation TEXT NOT NULL CHECK (propagation IN ('self','subtree'))
    );
    CREATE INDEX IF NOT EXISTS idx_sqlite_scope_assignments_user ON node_scope_assignments(user_id, node_id);
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      actor_user_id TEXT,
      action_key TEXT NOT NULL,
      resource_kind TEXT NOT NULL,
      resource_id TEXT NOT NULL,
      node_id TEXT,
      before_payload TEXT,
      after_payload TEXT,
      occurred_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE INDEX IF NOT EXISTS idx_sqlite_audit_occurred_at ON audit_logs(occurred_at DESC);
    CREATE TABLE IF NOT EXISTS system_settings (
      setting_key TEXT PRIMARY KEY,
      value_type TEXT NOT NULL,
      value_text TEXT,
      value_json TEXT,
      row_version INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      deleted_at TEXT
    );
    CREATE TABLE IF NOT EXISTS runtime_capabilities (
      capability_key TEXT PRIMARY KEY,
      default_status TEXT NOT NULL CHECK (default_status IN ('enabled','disabled'))
    );
    CREATE TABLE IF NOT EXISTS runtime_capability_overrides (
      capability_key TEXT NOT NULL REFERENCES runtime_capabilities(capability_key),
      scope_key TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('enabled','disabled')),
      PRIMARY KEY(capability_key, scope_key)
    );
    CREATE TABLE IF NOT EXISTS user_sessions (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      session_token_hash TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'active',
      expires_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE INDEX IF NOT EXISTS idx_sqlite_sessions_user ON user_sessions(user_id);
    CREATE TABLE IF NOT EXISTS login_rate_limits (
      subject_hash TEXT PRIMARY KEY,
      attempts INTEGER NOT NULL,
      window_started_at TEXT NOT NULL,
      blocked_until TEXT,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS account_action_tokens (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      purpose TEXT NOT NULL CHECK (purpose IN ('invitation','password_reset')),
      expires_at TEXT NOT NULL,
      consumed_at TEXT,
      created_by TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS user_mfa_totp (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      secret_ciphertext TEXT NOT NULL,
      enabled_at TEXT,
      recovery_code_hashes TEXT NOT NULL DEFAULT '[]',
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS node_revisions (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))), node_id TEXT NOT NULL, revision_number INTEGER NOT NULL,
      event_type TEXT NOT NULL, node_row_version INTEGER NOT NULL, schema_version INTEGER NOT NULL,
      snapshot_payload TEXT NOT NULL, created_by TEXT, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      UNIQUE(node_id, revision_number)
    );
    CREATE TABLE IF NOT EXISTS entity_revisions (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))), entity_id TEXT NOT NULL, revision_number INTEGER NOT NULL,
      event_type TEXT NOT NULL, entity_row_version INTEGER NOT NULL, schema_version INTEGER NOT NULL,
      snapshot_payload TEXT NOT NULL, created_by TEXT, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      UNIQUE(entity_id, revision_number)
    );
    CREATE TABLE IF NOT EXISTS realtime_event_outbox (
      event_id TEXT PRIMARY KEY, event_payload TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      published_at TEXT, attempts INTEGER NOT NULL DEFAULT 0, next_attempt_at TEXT, locked_at TEXT, locked_by TEXT, last_error TEXT
    );
    CREATE TABLE IF NOT EXISTS entity_type_fields (
      id TEXT NOT NULL DEFAULT (lower(hex(randomblob(16)))),
      entity_type_id TEXT NOT NULL REFERENCES entity_types(id) ON DELETE CASCADE,
      field_key TEXT NOT NULL,
      column_name TEXT NOT NULL,
      data_type TEXT NOT NULL,
      label TEXT NOT NULL DEFAULT '',
      is_required INTEGER NOT NULL DEFAULT 0,
      is_unique INTEGER NOT NULL DEFAULT 0,
      encryption_mode TEXT NOT NULL DEFAULT 'plaintext',
      relation_target_domain TEXT,
      relation_target_type_key TEXT,
      default_value TEXT,
      PRIMARY KEY(entity_type_id, field_key),
      UNIQUE(entity_type_id, column_name)
    );
    CREATE TABLE IF NOT EXISTS node_type_fields (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))), node_type_id TEXT NOT NULL REFERENCES node_types(id) ON DELETE CASCADE,
      field_key TEXT NOT NULL, column_name TEXT NOT NULL, data_type TEXT NOT NULL, label TEXT NOT NULL DEFAULT '',
      is_required INTEGER NOT NULL DEFAULT 0, is_unique INTEGER NOT NULL DEFAULT 0, encryption_mode TEXT NOT NULL DEFAULT 'plaintext',
      relation_target_domain TEXT, relation_target_type_key TEXT, default_value TEXT,
      UNIQUE(node_type_id, field_key), UNIQUE(node_type_id, column_name)
    );
    CREATE TABLE IF NOT EXISTS resource_attachments (
      id TEXT PRIMARY KEY, resource_type TEXT NOT NULL, resource_id TEXT NOT NULL, field_key TEXT NOT NULL,
      kind TEXT NOT NULL, file_name TEXT NOT NULL, mime_type TEXT NOT NULL, size_bytes INTEGER NOT NULL,
      storage_key TEXT NOT NULL UNIQUE, checksum TEXT NOT NULL, created_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE INDEX IF NOT EXISTS idx_sqlite_attachments_resource ON resource_attachments(resource_type, resource_id, created_at DESC);
    CREATE TABLE IF NOT EXISTS resource_field_ciphertexts (resource_type TEXT NOT NULL, resource_id TEXT NOT NULL, field_key TEXT NOT NULL, key_version TEXT NOT NULL, ciphertext TEXT NOT NULL, PRIMARY KEY(resource_type, resource_id, field_key));
    CREATE TABLE IF NOT EXISTS node_type_attachment_policies (
      node_type_id TEXT PRIMARY KEY REFERENCES node_types(id) ON DELETE CASCADE,
      encryption_mode TEXT NOT NULL CHECK (encryption_mode IN ('enabled','disabled')),
      updated_at TEXT NOT NULL
    );
  `);
}
