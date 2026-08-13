import crypto from 'node:crypto';
import { PasswordHasher } from '../../domain/policies/PasswordHasher.js';
import type { SystemSeedPort } from '../../application/ports/SystemSeedPort.js';
import type { SqliteDatabase } from './SqliteDatabase.js';

const ADMIN_ID = '00000000-0000-0000-0000-000000000001';
const ADMIN_ROLE_ID = '00000000-0000-0000-0000-000000000002';
const DEFAULT_ADMIN_EMAIL = 'admin@localhost';
const PERMISSIONS = [
  'audit.access', 'node.create', 'node.move', 'node.edit', 'node.read',
  'entity.create', 'entity.read', 'entity.edit', 'entity.delete', 'entity.restore', 'entity.purge', 'entity.move',
  'node_type.read', 'node_type.create', 'node_type.update', 'node_type.delete',
  'entity_type.read', 'entity_type.create', 'entity_type.update', 'entity_type.delete',
  'user.read', 'user.create', 'user.update', 'user.delete', 'role.read', 'role.create', 'role.update', 'role.delete',
  'scope.read', 'scope.assign', 'scope.delete', 'system.config.read', 'system.config',
] as const;

export class SystemSeedSqlite implements SystemSeedPort {
  constructor(
    private readonly database: SqliteDatabase,
    private readonly seedAdminPassword?: string,
    private readonly seedAdminEmail = DEFAULT_ADMIN_EMAIL,
  ) {}

  async checkSeeded(): Promise<boolean> {
    return Boolean(this.database.get('SELECT 1 FROM permissions WHERE permission_key=?', ['node.create'])
      && this.database.get('SELECT 1 FROM runtime_capabilities WHERE capability_key=?', ['hierarchical_structure']));
  }

  async seedDatabase(): Promise<void> {
    if (!this.seedAdminPassword) throw new Error('SEED_ADMIN_PASSWORD must be configured before seeding the database.');
    const existing = this.database.get<{ id: string }>('SELECT id FROM users WHERE id=?', [ADMIN_ID]);
    if (existing) throw new Error('SQLite bootstrap administrator already exists; refusing to overwrite it.');
    const now = new Date().toISOString();
    this.database.run(
      'INSERT INTO users(id,email,password_hash,is_active,is_super_admin,updated_at) VALUES(?,?,?,?,?,?)',
      [ADMIN_ID, this.seedAdminEmail, PasswordHasher.hash(this.seedAdminPassword), 1, 1, now],
    );
    this.database.run(
      'INSERT INTO roles(id,role_key,name,description,is_system,row_version) VALUES(?,?,?,?,?,?)',
      [ADMIN_ROLE_ID, 'admin', 'admin', 'Administrator Role', 1, 1],
    );
    for (const permissionKey of PERMISSIONS) {
      const permissionId = crypto.randomUUID();
      this.database.run(
        'INSERT INTO permissions(id,permission_key,name,description,resource_kind) VALUES(?,?,?,?,?)',
        [permissionId, permissionKey, permissionKey, `Allow ${permissionKey}`, 'system'],
      );
      this.database.run('INSERT INTO role_permissions(role_id,permission_id) VALUES(?,?)', [ADMIN_ROLE_ID, permissionId]);
    }
    this.database.run('INSERT INTO user_roles(user_id,role_id) VALUES(?,?)', [ADMIN_ID, ADMIN_ROLE_ID]);
    for (const [key, name, description] of [
      ['hierarchical_structure', 'Hierarchical Tree', 'Node tree structure'],
      ['entities_structure', 'Entity Storage', 'Dynamic entities structure'],
      ['locking', 'Concurrency Locking', 'Locking controls'],
      ['realtime', 'Realtime Synchronization', 'Realtime synchronization'],
    ] as const) {
      this.database.run('INSERT INTO runtime_capabilities(capability_key,default_status) VALUES(?,?)', [key, 'enabled']);
      this.database.run('INSERT INTO runtime_capability_metadata(capability_key,name,description,is_system) VALUES(?,?,?,?)', [key, name, description, 1]);
    }
  }
}
