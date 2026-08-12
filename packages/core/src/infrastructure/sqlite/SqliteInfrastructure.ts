import { SqliteDatabase } from './SqliteDatabase.js';
import { ensureSqliteSchema } from './SqliteSchema.js';
import { NodeRepositorySqlite } from './NodeRepositorySqlite.js';
import { EntityRepositorySqlite } from './EntityRepositorySqlite.js';
import { NodeTypeRepositorySqlite } from './NodeTypeRepositorySqlite.js';
import { EntityTypeRepositorySqlite } from './EntityTypeRepositorySqlite.js';
import { LockRepositorySqlite } from './LockRepositorySqlite.js';
import { AccessControlPortSqlite } from './AccessControlPortSqlite.js';
import { AuditPortSqlite } from './AuditPortSqlite.js';
import { RevisionPortSqlite } from './RevisionPortSqlite.js';
import { RealtimeOutboxSqlite } from './RealtimeOutboxSqlite.js';
import { ConfigurationRepositorySqlite } from './ConfigurationRepositorySqlite.js';
import { RuntimeConfigurationPortSqlite } from './RuntimeConfigurationPortSqlite.js';
import { SessionRepositorySqlite } from './SessionRepositorySqlite.js';
import { LoginRateLimitPortSqlite } from './LoginRateLimitPortSqlite.js';
import { AccountActionTokenPortSqlite } from './AccountActionTokenPortSqlite.js';
import { UserRepositorySqlite } from './UserRepositorySqlite.js';
import { TransactionPortSqlite } from './TransactionPortSqlite.js';
import { StorageTableManagementSqlite } from './StorageTableManagementSqlite.js';

/** Single composition root for the SQLite persistence profile. */
export class SqliteInfrastructure {
  readonly database: SqliteDatabase;
  readonly transactionPort: TransactionPortSqlite;
  readonly nodeRepository: NodeRepositorySqlite;
  readonly entityRepository: EntityRepositorySqlite;
  readonly nodeTypeRepository: NodeTypeRepositorySqlite;
  readonly entityTypeRepository: EntityTypeRepositorySqlite;
  readonly lockRepository: LockRepositorySqlite;
  readonly accessControlPort: AccessControlPortSqlite;
  readonly auditPort: AuditPortSqlite;
  readonly revisionPort: RevisionPortSqlite;
  readonly realtimeOutbox: RealtimeOutboxSqlite;
  readonly configurationRepository: ConfigurationRepositorySqlite;
  readonly runtimeConfigurationPort: RuntimeConfigurationPortSqlite;
  readonly sessionRepository: SessionRepositorySqlite;
  readonly loginRateLimitPort: LoginRateLimitPortSqlite;
  readonly accountActionTokenPort: AccountActionTokenPortSqlite;
  readonly userRepository: UserRepositorySqlite;
  readonly storageTableManagement: StorageTableManagementSqlite;

  constructor(location = ':memory:') {
    this.database = new SqliteDatabase(location);
    ensureSqliteSchema(this.database);
    this.transactionPort = new TransactionPortSqlite(this.database);
    this.nodeRepository = new NodeRepositorySqlite(this.database);
    this.entityRepository = new EntityRepositorySqlite(this.database);
    this.nodeTypeRepository = new NodeTypeRepositorySqlite(this.database);
    this.entityTypeRepository = new EntityTypeRepositorySqlite(this.database);
    this.lockRepository = new LockRepositorySqlite(this.database);
    this.accessControlPort = new AccessControlPortSqlite(this.database);
    this.auditPort = new AuditPortSqlite(this.database);
    this.revisionPort = new RevisionPortSqlite(this.database);
    this.realtimeOutbox = new RealtimeOutboxSqlite(this.database);
    this.configurationRepository = new ConfigurationRepositorySqlite(this.database);
    this.runtimeConfigurationPort = new RuntimeConfigurationPortSqlite(this.database);
    this.sessionRepository = new SessionRepositorySqlite(this.database);
    this.loginRateLimitPort = new LoginRateLimitPortSqlite(this.database);
    this.accountActionTokenPort = new AccountActionTokenPortSqlite(this.database);
    this.userRepository = new UserRepositorySqlite(this.database);
    this.storageTableManagement = new StorageTableManagementSqlite(this.database);
  }

  close(): void { this.database.close(); }
}
