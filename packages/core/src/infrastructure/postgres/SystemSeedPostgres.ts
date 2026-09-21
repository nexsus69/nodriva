/** Bootstraps the shared PostgreSQL system catalogue and explicit administrator identity. */
import crypto from 'node:crypto';
import { PasswordHasher } from '../../domain/policies/PasswordHasher.js';
import type { SystemSeedPort } from '../../application/ports/SystemSeedPort.js';
import type { TransactionPort } from '../../application/ports/TransactionPort.js';
import {
  BOOTSTRAP_ADMIN_ID,
  DEFAULT_READER_PERMISSIONS,
  RUNTIME_CAPABILITIES,
  SCOPED_READER_PERMISSIONS,
  SYSTEM_PERMISSIONS,
  SYSTEM_ROLES,
  SYSTEM_SETTINGS,
} from '../SystemBootstrapCatalog.js';
import type { PgExecutor } from './PgExecutor.js';

export class SystemSeedPostgres implements SystemSeedPort {
  constructor(
    private readonly executor: PgExecutor,
    private readonly transactionPort: TransactionPort,
    private readonly seedAdminPassword?: string,
    private readonly seedAdminEmail?: string,
  ) {}

  async checkSeeded(): Promise<boolean> {
    try {
      const result = await this.executor.query<{ ready: boolean }>(`
        SELECT EXISTS (SELECT 1 FROM roles WHERE role_key='admin')
          AND EXISTS (SELECT 1 FROM permissions WHERE permission_key='node.create')
          AND EXISTS (SELECT 1 FROM runtime_capabilities WHERE capability_key='hierarchical_structure')
          AND EXISTS (SELECT 1 FROM system_settings WHERE setting_key='session.idleTimeoutSeconds') AS ready
      `);
      return result.rows[0]?.ready === true;
    } catch {
      return false;
    }
  }

  async seedDatabase(): Promise<void> {
    if (!this.seedAdminPassword) throw new Error('SEED_ADMIN_PASSWORD must be configured before bootstrapping the database.');
    if (!this.seedAdminEmail) throw new Error('SEED_ADMIN_EMAIL must be configured before bootstrapping the database.');
    await this.transactionPort.runInTransaction(() => this.bootstrap());
  }

  private async bootstrap(): Promise<void> {
    const adminId = await this.ensureAdministrator();

    for (const role of SYSTEM_ROLES) {
      await this.executor.query(
        `INSERT INTO roles(id,role_key,name,description,is_system,row_version) VALUES($1,$2,$3,$4,true,1)
         ON CONFLICT (role_key) DO NOTHING`,
        [role.id, role.key, role.name, role.description],
      );
    }
    for (const item of SYSTEM_PERMISSIONS) {
      await this.executor.query(
        `INSERT INTO permissions(id,permission_key,name,description,resource_kind) VALUES($1,$2,$3,$4,$5::resource_kind_enum)
         ON CONFLICT (permission_key) DO NOTHING`,
        [item.id, item.key, item.name, item.description, item.resourceKind],
      );
    }

    await this.assignPermissions('admin', SYSTEM_PERMISSIONS.map((item) => item.key));
    await this.assignPermissions('default_reader', DEFAULT_READER_PERMISSIONS);
    await this.assignPermissions('scoped_reader', SCOPED_READER_PERMISSIONS);
    await this.executor.query(
      `INSERT INTO user_roles(user_id,role_id) SELECT $1,id FROM roles WHERE role_key='admin' ON CONFLICT DO NOTHING`,
      [adminId],
    );

    for (const setting of SYSTEM_SETTINGS) {
      await this.executor.query(
        `INSERT INTO system_settings(category,setting_key,display_name,description,value_type,value_text,is_runtime_overridable,is_system)
         VALUES($1,$2,$3,$4,$5::setting_value_type_enum,$6,true,true) ON CONFLICT (setting_key) DO NOTHING`,
        [setting.category, setting.key, setting.displayName, setting.description, setting.valueType, setting.valueText],
      );
    }
    for (const capability of RUNTIME_CAPABILITIES) {
      await this.executor.query(
        `INSERT INTO runtime_capabilities(capability_key,name,description,default_status,is_system)
         VALUES($1,$2,$3,$4::capability_status_enum,true) ON CONFLICT (capability_key) DO NOTHING`,
        [capability.key, capability.name, capability.description, capability.status],
      );
    }
  }

  private async ensureAdministrator(): Promise<string> {
    const byEmail = await this.executor.query<{ id: string }>('SELECT id FROM users WHERE lower(email)=lower($1) LIMIT 1', [this.seedAdminEmail]);
    if (byEmail.rows[0]) return byEmail.rows[0].id;
    const occupiedId = await this.executor.query<{ id: string }>('SELECT id FROM users WHERE id=$1', [BOOTSTRAP_ADMIN_ID]);
    const id = occupiedId.rows.length === 0 ? BOOTSTRAP_ADMIN_ID : crypto.randomUUID();
    await this.executor.query(
      `INSERT INTO users(id,email,password_hash,is_active,is_super_admin) VALUES($1,$2,$3,true,true)`,
      [id, this.seedAdminEmail, PasswordHasher.hash(this.seedAdminPassword!)],
    );
    return id;
  }

  private async assignPermissions(roleKey: string, permissionKeys: readonly string[]): Promise<void> {
    await this.executor.query(
      `INSERT INTO role_permissions(role_id,permission_id)
       SELECT role.id,permission.id FROM roles role CROSS JOIN permissions permission
       WHERE role.role_key=$1 AND permission.permission_key=ANY($2::text[]) ON CONFLICT DO NOTHING`,
      [roleKey, permissionKeys],
    );
  }
}
