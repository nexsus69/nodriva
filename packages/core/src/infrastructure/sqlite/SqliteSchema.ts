import type { SqliteDatabase } from './SqliteDatabase.js';

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
      is_system INTEGER NOT NULL DEFAULT 0,
      row_version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
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
      payload TEXT NOT NULL DEFAULT '{}'
    );
    CREATE UNIQUE INDEX IF NOT EXISTS uq_sqlite_nodes_parent_label_active
      ON nodes(parent_id, path_label) WHERE parent_id IS NOT NULL AND deleted_at IS NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS uq_sqlite_nodes_root_label_active
      ON nodes(path_label) WHERE parent_id IS NULL AND deleted_at IS NULL;
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
      placement_policy_id TEXT,
      current_schema_version INTEGER NOT NULL DEFAULT 1,
      is_active INTEGER NOT NULL DEFAULT 1,
      is_system INTEGER NOT NULL DEFAULT 0,
      row_version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
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
    CREATE TABLE IF NOT EXISTS roles (
      id TEXT PRIMARY KEY, role_key TEXT NOT NULL UNIQUE, name TEXT NOT NULL DEFAULT '', description TEXT NOT NULL DEFAULT '',
      is_system INTEGER NOT NULL DEFAULT 0, row_version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), deleted_at TEXT
    );
    CREATE TABLE IF NOT EXISTS permissions (
      id TEXT PRIMARY KEY, permission_key TEXT NOT NULL UNIQUE, name TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '', resource_kind TEXT NOT NULL DEFAULT 'system'
    );
    CREATE TABLE IF NOT EXISTS user_roles (user_id TEXT NOT NULL REFERENCES users(id), role_id TEXT NOT NULL REFERENCES roles(id), PRIMARY KEY(user_id, role_id));
    CREATE TABLE IF NOT EXISTS role_permissions (role_id TEXT NOT NULL REFERENCES roles(id), permission_id TEXT NOT NULL REFERENCES permissions(id), PRIMARY KEY(role_id, permission_id));
    CREATE TABLE IF NOT EXISTS node_scope_assignments (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      role_id TEXT NOT NULL REFERENCES roles(id),
      node_id TEXT NOT NULL REFERENCES nodes(id),
      assignment_effect TEXT NOT NULL CHECK (assignment_effect IN ('allow','deny')),
      propagation TEXT NOT NULL CHECK (propagation IN ('self','subtree'))
      ,UNIQUE(user_id, node_id, role_id, propagation)
    );
    CREATE INDEX IF NOT EXISTS idx_sqlite_scope_assignments_user ON node_scope_assignments(user_id, node_id);
    CREATE TABLE IF NOT EXISTS scope_assignment_metadata (
      assignment_id TEXT PRIMARY KEY REFERENCES node_scope_assignments(id) ON DELETE CASCADE,
      assigned_by TEXT, assigned_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      actor_user_id TEXT,
      action_key TEXT NOT NULL,
      resource_kind TEXT NOT NULL,
      resource_id TEXT NOT NULL,
      resource_label TEXT,
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
      default_status TEXT NOT NULL CHECK (default_status IN ('enabled','disabled','optional'))
    );
    CREATE TABLE IF NOT EXISTS runtime_capability_metadata (
      capability_key TEXT PRIMARY KEY REFERENCES runtime_capabilities(capability_key) ON DELETE CASCADE,
      name TEXT NOT NULL DEFAULT '', description TEXT NOT NULL DEFAULT '', is_system INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE TABLE IF NOT EXISTS runtime_capability_overrides (
      capability_key TEXT NOT NULL REFERENCES runtime_capabilities(capability_key),
      scope_key TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('enabled','disabled','optional')),
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
    CREATE TABLE IF NOT EXISTS account_action_delivery_outbox (
      id TEXT PRIMARY KEY, email TEXT NOT NULL,
      purpose TEXT NOT NULL CHECK (purpose IN ('invitation','password_reset')),
      token_ciphertext TEXT NOT NULL, expires_at TEXT NOT NULL, delivered_at TEXT,
      attempts INTEGER NOT NULL DEFAULT 0, next_attempt_at TEXT, locked_at TEXT,
      locked_by TEXT, last_error TEXT, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE TABLE IF NOT EXISTS user_mfa_totp (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      secret_ciphertext TEXT NOT NULL,
      enabled_at TEXT,
      recovery_code_hashes TEXT NOT NULL DEFAULT '[]',
      pending_secret_ciphertext TEXT,
      pending_expires_at TEXT,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS attachment_cleanup_outbox (
      storage_key TEXT PRIMARY KEY, attempts INTEGER NOT NULL DEFAULT 0,
      next_attempt_at TEXT NOT NULL, locked_at TEXT, locked_by TEXT,
      last_error TEXT, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
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
    -- The workflow catalogue is deliberately independent from the node/entity
    -- schema: a workflow may react to any subject kind exposed by a module.
    CREATE TABLE IF NOT EXISTS workflow_event_types (
      event_type TEXT PRIMARY KEY,
      subject_kinds TEXT NOT NULL,
      payload_version INTEGER NOT NULL CHECK (payload_version > 0),
      is_active INTEGER NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE TABLE IF NOT EXISTS workflow_definitions (
      workflow_id TEXT NOT NULL,
      version INTEGER NOT NULL CHECK (version > 0),
      definition_payload TEXT NOT NULL,
      is_active INTEGER NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      PRIMARY KEY (workflow_id, version)
    );
    CREATE INDEX IF NOT EXISTS idx_sqlite_workflow_definitions_active
      ON workflow_definitions (is_active, workflow_id, version);
    CREATE TABLE IF NOT EXISTS workflow_events (
      event_id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      subject_kind TEXT NOT NULL,
      subject_id TEXT NOT NULL,
      scope_id TEXT,
      event_payload TEXT NOT NULL,
      occurred_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE INDEX IF NOT EXISTS idx_sqlite_workflow_events_type_created
      ON workflow_events (event_type, created_at);
    CREATE TABLE IF NOT EXISTS workflow_execution_plans (
      instance_key TEXT PRIMARY KEY,
      workflow_id TEXT NOT NULL,
      workflow_version INTEGER NOT NULL,
      event_id TEXT NOT NULL REFERENCES workflow_events(event_id) ON DELETE RESTRICT,
      plan_payload TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE INDEX IF NOT EXISTS idx_sqlite_workflow_execution_plans_event
      ON workflow_execution_plans (event_id, workflow_id, workflow_version);
    CREATE TABLE IF NOT EXISTS workflow_execution_steps (
      execution_key TEXT PRIMARY KEY,
      instance_key TEXT NOT NULL REFERENCES workflow_execution_plans(instance_key) ON DELETE CASCADE,
      step_id TEXT NOT NULL,
      action_type TEXT NOT NULL,
      input_payload TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'leased', 'completed')),
      attempts INTEGER NOT NULL DEFAULT 0,
      next_attempt_at TEXT,
      locked_at TEXT,
      locked_by TEXT,
      last_error TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      completed_at TEXT,
      UNIQUE(instance_key, step_id)
    );
    CREATE INDEX IF NOT EXISTS idx_sqlite_workflow_execution_steps_pending
      ON workflow_execution_steps (status, next_attempt_at, created_at);
    CREATE TABLE IF NOT EXISTS entity_type_fields (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      entity_type_id TEXT NOT NULL REFERENCES entity_types(id) ON DELETE CASCADE,
      field_key TEXT NOT NULL,
      column_name TEXT NOT NULL,
      data_type TEXT NOT NULL,
      label TEXT NOT NULL DEFAULT '',
      is_required INTEGER NOT NULL DEFAULT 0,
      is_unique INTEGER NOT NULL DEFAULT 0,
      is_indexed INTEGER NOT NULL DEFAULT 0,
      encryption_mode TEXT NOT NULL DEFAULT 'plaintext',
      enum_mode TEXT NOT NULL DEFAULT 'static' CHECK (enum_mode IN ('static', 'managed')),
      position INTEGER NOT NULL DEFAULT 0,
      is_system INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      relation_target_domain TEXT,
      relation_target_type_key TEXT,
      relation_source_cardinality TEXT NOT NULL DEFAULT 'one' CHECK (relation_source_cardinality IN ('one', 'many')),
      relation_target_is_unique INTEGER NOT NULL DEFAULT 0,
      relation_inverse_label TEXT,
      default_value_text TEXT,
      default_value TEXT,
      UNIQUE(entity_type_id, field_key),
      UNIQUE(entity_type_id, column_name)
    );
    CREATE TABLE IF NOT EXISTS node_type_fields (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))), node_type_id TEXT NOT NULL REFERENCES node_types(id) ON DELETE CASCADE,
      field_key TEXT NOT NULL, column_name TEXT NOT NULL, data_type TEXT NOT NULL, label TEXT NOT NULL DEFAULT '',
      is_required INTEGER NOT NULL DEFAULT 0, is_unique INTEGER NOT NULL DEFAULT 0, is_indexed INTEGER NOT NULL DEFAULT 0, encryption_mode TEXT NOT NULL DEFAULT 'plaintext', enum_mode TEXT NOT NULL DEFAULT 'static' CHECK (enum_mode IN ('static', 'managed')),
      position INTEGER NOT NULL DEFAULT 0, is_system INTEGER NOT NULL DEFAULT 0, default_value_text TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      relation_target_domain TEXT, relation_target_type_key TEXT,
      relation_source_cardinality TEXT NOT NULL DEFAULT 'one' CHECK (relation_source_cardinality IN ('one', 'many')),
      relation_target_is_unique INTEGER NOT NULL DEFAULT 0,
      relation_inverse_label TEXT,
      default_value TEXT,
      UNIQUE(node_type_id, field_key), UNIQUE(node_type_id, column_name)
    );
    CREATE TABLE IF NOT EXISTS node_type_field_constraints (
      id TEXT PRIMARY KEY, field_id TEXT NOT NULL REFERENCES node_type_fields(id) ON DELETE CASCADE,
      constraint_type TEXT NOT NULL, constraint_value_text TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS entity_type_field_constraints (
      id TEXT PRIMARY KEY, field_id TEXT NOT NULL REFERENCES entity_type_fields(id) ON DELETE CASCADE,
      constraint_type TEXT NOT NULL, constraint_value_text TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS node_type_field_enum_options (
      id TEXT PRIMARY KEY, field_id TEXT NOT NULL REFERENCES node_type_fields(id) ON DELETE CASCADE,
      value TEXT NOT NULL, label TEXT NOT NULL, position INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      UNIQUE(field_id, value)
    );
    CREATE TABLE IF NOT EXISTS entity_type_field_enum_options (
      id TEXT PRIMARY KEY, field_id TEXT NOT NULL REFERENCES entity_type_fields(id) ON DELETE CASCADE,
      value TEXT NOT NULL, label TEXT NOT NULL, position INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      UNIQUE(field_id, value)
    );
    CREATE TABLE IF NOT EXISTS resource_attachments (
      id TEXT PRIMARY KEY, resource_type TEXT NOT NULL, resource_id TEXT NOT NULL, field_key TEXT NOT NULL,
      kind TEXT NOT NULL, file_name TEXT NOT NULL, mime_type TEXT NOT NULL, size_bytes INTEGER NOT NULL,
      storage_key TEXT NOT NULL UNIQUE, checksum TEXT NOT NULL, created_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE INDEX IF NOT EXISTS idx_sqlite_attachments_resource ON resource_attachments(resource_type, resource_id, created_at DESC);
    CREATE TABLE IF NOT EXISTS resource_relationships (
      source_field_id TEXT NOT NULL,
      source_domain TEXT NOT NULL CHECK (source_domain IN ('node', 'entity')),
      source_resource_id TEXT NOT NULL,
      target_domain TEXT NOT NULL CHECK (target_domain IN ('node', 'entity')),
      target_resource_id TEXT NOT NULL,
      position INTEGER NOT NULL CHECK (position >= 0),
      source_cardinality TEXT NOT NULL CHECK (source_cardinality IN ('one', 'many')),
      target_is_unique INTEGER NOT NULL DEFAULT 0,
      suspended_at TEXT,
      suspension_deletion_batch_id TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      PRIMARY KEY (source_field_id, source_domain, source_resource_id, target_domain, target_resource_id)
    );
    CREATE UNIQUE INDEX IF NOT EXISTS uq_sqlite_resource_relationships_source_one
      ON resource_relationships (source_field_id, source_domain, source_resource_id)
      WHERE source_cardinality = 'one';
    CREATE UNIQUE INDEX IF NOT EXISTS uq_sqlite_resource_relationships_target_one
      ON resource_relationships (source_field_id, target_domain, target_resource_id)
      WHERE target_is_unique = 1;
    CREATE UNIQUE INDEX IF NOT EXISTS uq_sqlite_resource_relationships_source_position
      ON resource_relationships (source_field_id, source_domain, source_resource_id, position);
    CREATE INDEX IF NOT EXISTS idx_sqlite_resource_relationships_incoming
      ON resource_relationships (target_domain, target_resource_id, source_field_id, position);
    CREATE TABLE IF NOT EXISTS attachment_upload_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT, actor_id TEXT NOT NULL, occurred_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sqlite_attachment_upload_events_actor_time ON attachment_upload_events(actor_id, occurred_at);
    CREATE TABLE IF NOT EXISTS resource_field_ciphertexts (resource_type TEXT NOT NULL, resource_id TEXT NOT NULL, field_key TEXT NOT NULL, key_version TEXT NOT NULL, ciphertext TEXT NOT NULL, PRIMARY KEY(resource_type, resource_id, field_key));
    CREATE TABLE IF NOT EXISTS node_type_attachment_policies (
      node_type_id TEXT PRIMARY KEY REFERENCES node_types(id) ON DELETE CASCADE,
      encryption_mode TEXT NOT NULL CHECK (encryption_mode IN ('enabled','disabled')),
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS service_configurations (
      service_key TEXT PRIMARY KEY,
      provider_key TEXT NOT NULL,
      runtime_values TEXT NOT NULL DEFAULT '{}',
      row_version INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE TABLE IF NOT EXISTS placement_policies (
      id TEXT PRIMARY KEY, policy_key TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '', policy_mode TEXT NOT NULL,
      row_version INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), deleted_at TEXT
    );
    CREATE TABLE IF NOT EXISTS placement_policy_rules (
      id TEXT PRIMARY KEY, placement_policy_id TEXT NOT NULL REFERENCES placement_policies(id) ON DELETE CASCADE,
      rule_type TEXT NOT NULL, target_node_id TEXT, target_node_type_id TEXT, comparator TEXT, value_text TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
  `);

  // Keep the standalone profile ready to receive the canonical generic record
  // lifecycle events without requiring a PostgreSQL migration runner.
  for (const eventType of ['record.created', 'record.updated', 'record.deleted', 'record.restored'] as const) {
    database.run(
      'INSERT OR IGNORE INTO workflow_event_types(event_type,subject_kinds,payload_version,is_active) VALUES(?,?,?,?)',
      [eventType, JSON.stringify(['node', 'entity']), 1, 1],
    );
  }
  database.run(
    'INSERT OR IGNORE INTO workflow_event_types(event_type,subject_kinds,payload_version,is_active) VALUES(?,?,?,?)',
    ['hierarchy.moved', JSON.stringify(['node']), 1, 1],
  );
  // Legacy definitions may predate the one-active-version rule. Keep their
  // latest enabled revision and enforce the same invariant as PostgreSQL.
  database.exec(`
    UPDATE workflow_definitions AS older
    SET is_active=0, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
    WHERE is_active=1
      AND EXISTS (
        SELECT 1 FROM workflow_definitions AS newer
        WHERE newer.workflow_id=older.workflow_id
          AND newer.is_active=1
          AND newer.version>older.version
      );
    CREATE UNIQUE INDEX IF NOT EXISTS uq_sqlite_workflow_definitions_one_active
      ON workflow_definitions (workflow_id) WHERE is_active=1;
  `);

  for (const tableName of ['node_type_fields', 'entity_type_fields'] as const) {
    if (!database.hasColumn(tableName, 'enum_mode')) {
      database.exec(`ALTER TABLE ${tableName} ADD COLUMN enum_mode TEXT NOT NULL DEFAULT 'static' CHECK (enum_mode IN ('static', 'managed'))`);
    }
    if (!database.hasColumn(tableName, 'created_at')) {
      database.exec(`ALTER TABLE ${tableName} ADD COLUMN created_at TEXT NOT NULL DEFAULT ''`);
      database.exec(`UPDATE ${tableName} SET created_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE created_at=''`);
    }
    if (!database.hasColumn(tableName, 'updated_at')) {
      database.exec(`ALTER TABLE ${tableName} ADD COLUMN updated_at TEXT NOT NULL DEFAULT ''`);
      database.exec(`UPDATE ${tableName} SET updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE updated_at=''`);
    }
    if (!database.hasColumn(tableName, 'relation_source_cardinality')) {
      database.exec(`ALTER TABLE ${tableName} ADD COLUMN relation_source_cardinality TEXT NOT NULL DEFAULT 'one' CHECK (relation_source_cardinality IN ('one', 'many'))`);
    }
    if (!database.hasColumn(tableName, 'relation_target_is_unique')) {
      database.exec(`ALTER TABLE ${tableName} ADD COLUMN relation_target_is_unique INTEGER NOT NULL DEFAULT 0`);
    }
    if (!database.hasColumn(tableName, 'relation_inverse_label')) {
      database.exec(`ALTER TABLE ${tableName} ADD COLUMN relation_inverse_label TEXT`);
    }
  }

  for (const tableName of ['node_types', 'entity_types'] as const) {
    if (!database.hasColumn(tableName, 'is_system')) database.exec(`ALTER TABLE ${tableName} ADD COLUMN is_system INTEGER NOT NULL DEFAULT 0`);
    if (!database.hasColumn(tableName, 'row_version')) database.exec(`ALTER TABLE ${tableName} ADD COLUMN row_version INTEGER NOT NULL DEFAULT 1`);
    if (!database.hasColumn(tableName, 'created_at')) {
      database.exec(`ALTER TABLE ${tableName} ADD COLUMN created_at TEXT NOT NULL DEFAULT ''`);
      database.exec(`UPDATE ${tableName} SET created_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE created_at=''`);
    }
    if (!database.hasColumn(tableName, 'updated_at')) {
      database.exec(`ALTER TABLE ${tableName} ADD COLUMN updated_at TEXT NOT NULL DEFAULT ''`);
      database.exec(`UPDATE ${tableName} SET updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE updated_at=''`);
    }
  }
  if (!database.hasColumn('entity_types', 'placement_policy_id')) database.exec('ALTER TABLE entity_types ADD COLUMN placement_policy_id TEXT');
  if (!database.hasColumn('audit_logs', 'resource_label')) database.exec('ALTER TABLE audit_logs ADD COLUMN resource_label TEXT');
  if (!database.hasColumn('user_mfa_totp', 'pending_secret_ciphertext')) database.exec('ALTER TABLE user_mfa_totp ADD COLUMN pending_secret_ciphertext TEXT');
  if (!database.hasColumn('user_mfa_totp', 'pending_expires_at')) database.exec('ALTER TABLE user_mfa_totp ADD COLUMN pending_expires_at TEXT');
  if (!database.hasColumn('resource_relationships', 'suspended_at')) database.exec('ALTER TABLE resource_relationships ADD COLUMN suspended_at TEXT');
  if (!database.hasColumn('resource_relationships', 'suspension_deletion_batch_id')) database.exec('ALTER TABLE resource_relationships ADD COLUMN suspension_deletion_batch_id TEXT');
  database.exec('CREATE INDEX IF NOT EXISTS idx_sqlite_resource_relationships_suspension_batch ON resource_relationships (suspension_deletion_batch_id) WHERE suspended_at IS NOT NULL');
  database.exec('DROP INDEX IF EXISTS uq_sqlite_resource_relationships_source_one');
  database.exec("CREATE UNIQUE INDEX IF NOT EXISTS uq_sqlite_resource_relationships_source_one ON resource_relationships (source_field_id, source_domain, source_resource_id) WHERE source_cardinality='one' AND suspended_at IS NULL");
  database.exec('DROP INDEX IF EXISTS uq_sqlite_resource_relationships_target_one');
  database.exec('CREATE UNIQUE INDEX IF NOT EXISTS uq_sqlite_resource_relationships_target_one ON resource_relationships (source_field_id, target_domain, target_resource_id) WHERE target_is_unique=1 AND suspended_at IS NULL');
  database.exec('CREATE INDEX IF NOT EXISTS idx_sqlite_resource_relationships_active_outgoing ON resource_relationships (source_domain, source_resource_id, source_field_id, position) WHERE suspended_at IS NULL');
  database.exec('CREATE INDEX IF NOT EXISTS idx_sqlite_resource_relationships_active_incoming ON resource_relationships (target_domain, target_resource_id, source_field_id, position) WHERE suspended_at IS NULL');

  database.exec(`
    UPDATE node_type_fields
    SET relation_target_is_unique = is_unique
    WHERE lower(data_type) = 'relation' AND is_unique = 1;
    UPDATE entity_type_fields
    SET relation_target_is_unique = is_unique
    WHERE lower(data_type) = 'relation' AND is_unique = 1;
  `);

  // SQLite stores dynamic values as JSON. The idempotent backfill is kept here
  // because standalone deployments do not run PostgreSQL migration files.
  database.exec(`
    INSERT OR IGNORE INTO resource_relationships (
      source_field_id, source_domain, source_resource_id, target_domain,
      target_resource_id, position, source_cardinality, target_is_unique
    )
    SELECT field.id, 'node', node.id, field.relation_target_domain,
           json_extract(node.payload, '$.' || field.field_key), 0,
           field.relation_source_cardinality, field.relation_target_is_unique
    FROM nodes node
    JOIN node_type_fields field ON field.node_type_id = node.node_type_id
    WHERE lower(field.data_type) = 'relation'
      AND field.relation_target_domain IS NOT NULL
      AND field.relation_target_type_key IS NOT NULL
      AND json_valid(node.payload)
      AND typeof(json_extract(node.payload, '$.' || field.field_key)) = 'text'
      AND length(json_extract(node.payload, '$.' || field.field_key)) = 36;

    INSERT OR IGNORE INTO resource_relationships (
      source_field_id, source_domain, source_resource_id, target_domain,
      target_resource_id, position, source_cardinality, target_is_unique
    )
    SELECT field.id, 'entity', entity.id, field.relation_target_domain,
           json_extract(entity.payload, '$.' || field.field_key), 0,
           field.relation_source_cardinality, field.relation_target_is_unique
    FROM entities entity
    JOIN entity_type_fields field ON field.entity_type_id = entity.entity_type_id
    WHERE lower(field.data_type) = 'relation'
      AND field.relation_target_domain IS NOT NULL
      AND field.relation_target_type_key IS NOT NULL
      AND json_valid(entity.payload)
      AND typeof(json_extract(entity.payload, '$.' || field.field_key)) = 'text'
      AND length(json_extract(entity.payload, '$.' || field.field_key)) = 36;
  `);
}
