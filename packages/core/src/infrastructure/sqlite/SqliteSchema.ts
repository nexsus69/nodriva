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
  `);
}
