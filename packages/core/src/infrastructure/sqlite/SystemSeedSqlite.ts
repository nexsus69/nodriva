import crypto from 'node:crypto';
import { PasswordHasher } from '../../domain/policies/PasswordHasher.js';
import type { SystemSeedPort } from '../../application/ports/SystemSeedPort.js';
import {
  BOOTSTRAP_ADMIN_ID,
  DEFAULT_BOOTSTRAP_ADMIN_EMAIL,
  DEFAULT_READER_PERMISSIONS,
  RUNTIME_CAPABILITIES,
  SCOPED_READER_PERMISSIONS,
  SYSTEM_PERMISSIONS,
  SYSTEM_ROLES,
  SYSTEM_SETTINGS,
} from '../SystemBootstrapCatalog.js';
import type { SqliteDatabase } from './SqliteDatabase.js';

export class SystemSeedSqlite implements SystemSeedPort {
  constructor(
    private readonly database: SqliteDatabase,
    private readonly seedAdminPassword?: string,
    private readonly seedAdminEmail = DEFAULT_BOOTSTRAP_ADMIN_EMAIL,
  ) {}

  async checkSeeded(): Promise<boolean> {
    return Boolean(
      this.database.get("SELECT 1 FROM roles WHERE role_key='admin'")
      && this.database.get("SELECT 1 FROM permissions WHERE permission_key='node.create'")
      && this.database.get("SELECT 1 FROM runtime_capabilities WHERE capability_key='hierarchical_structure'")
      && this.database.get("SELECT 1 FROM system_settings WHERE setting_key='session.idleTimeoutSeconds'"),
    );
  }

  async seedDatabase(): Promise<void> {
    if (!this.seedAdminPassword) throw new Error('SEED_ADMIN_PASSWORD must be configured before bootstrapping the database.');
    this.database.transaction(() => this.bootstrap());
  }

  private bootstrap(): void {
    const adminId = this.ensureAdministrator();
    for (const role of SYSTEM_ROLES) {
      this.database.run(
        'INSERT OR IGNORE INTO roles(id,role_key,name,description,is_system,row_version) VALUES(?,?,?,?,?,?)',
        [role.id, role.key, role.name, role.description, 1, 1],
      );
    }
    for (const item of SYSTEM_PERMISSIONS) {
      this.database.run(
        'INSERT OR IGNORE INTO permissions(id,permission_key,name,description,resource_kind) VALUES(?,?,?,?,?)',
        [item.id, item.key, item.name, item.description, item.resourceKind],
      );
    }

    this.assignPermissions('admin', SYSTEM_PERMISSIONS.map((item) => item.key));
    this.assignPermissions('default_reader', DEFAULT_READER_PERMISSIONS);
    this.assignPermissions('scoped_reader', SCOPED_READER_PERMISSIONS);
    const adminRole = this.database.get<{ id: string }>("SELECT id FROM roles WHERE role_key='admin'");
    if (!adminRole) throw new Error('Administrative role bootstrap failed.');
    this.database.run('INSERT OR IGNORE INTO user_roles(user_id,role_id) VALUES(?,?)', [adminId, adminRole.id]);

    for (const setting of SYSTEM_SETTINGS) {
      this.database.run(
        'INSERT OR IGNORE INTO system_settings(setting_key,value_type,value_text,row_version,updated_at) VALUES(?,?,?,?,?)',
        [setting.key, setting.valueType, setting.valueText, 1, new Date().toISOString()],
      );
    }
    for (const capability of RUNTIME_CAPABILITIES) {
      this.database.run('INSERT OR IGNORE INTO runtime_capabilities(capability_key,default_status) VALUES(?,?)', [capability.key, capability.status]);
      this.database.run(
        'INSERT OR IGNORE INTO runtime_capability_metadata(capability_key,name,description,is_system) VALUES(?,?,?,?)',
        [capability.key, capability.name, capability.description, 1],
      );
    }
  }

  private ensureAdministrator(): string {
    const byEmail = this.database.get<{ id: string }>('SELECT id FROM users WHERE lower(email)=lower(?) LIMIT 1', [this.seedAdminEmail]);
    if (byEmail) return byEmail.id;
    const occupiedId = this.database.get<{ id: string }>('SELECT id FROM users WHERE id=?', [BOOTSTRAP_ADMIN_ID]);
    const id = occupiedId ? crypto.randomUUID() : BOOTSTRAP_ADMIN_ID;
    this.database.run(
      'INSERT INTO users(id,email,password_hash,is_active,is_super_admin,updated_at) VALUES(?,?,?,?,?,?)',
      [id, this.seedAdminEmail, PasswordHasher.hash(this.seedAdminPassword!), 1, 1, new Date().toISOString()],
    );
    return id;
  }

  private assignPermissions(roleKey: string, permissionKeys: readonly string[]): void {
    const role = this.database.get<{ id: string }>('SELECT id FROM roles WHERE role_key=?', [roleKey]);
    if (!role) throw new Error(`System role '${roleKey}' bootstrap failed.`);
    for (const permissionKey of permissionKeys) {
      const item = this.database.get<{ id: string }>('SELECT id FROM permissions WHERE permission_key=?', [permissionKey]);
      if (!item) throw new Error(`System permission '${permissionKey}' bootstrap failed.`);
      this.database.run('INSERT OR IGNORE INTO role_permissions(role_id,permission_id) VALUES(?,?)', [role.id, item.id]);
    }
  }
}
