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
      is_active INTEGER NOT NULL DEFAULT 1,
      is_super_admin INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS roles (id TEXT PRIMARY KEY, role_key TEXT NOT NULL UNIQUE);
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
  `);
}
