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
import { AttachmentRepositorySqlite } from './AttachmentRepositorySqlite.js';
import { AttachmentPolicyRepositorySqlite } from './AttachmentPolicyRepositorySqlite.js';
import { ResourcePurgeRepositorySqlite } from './ResourcePurgeRepositorySqlite.js';
import { TypeDefinitionReaderSqlite } from './TypeDefinitionReaderSqlite.js';
import { MfaTotpPortSqlite } from './MfaTotpPortSqlite.js';
import { AuditQueryPortSqlite } from './AuditQueryPortSqlite.js';
import { ServiceConfigurationRepositorySqlite } from './ServiceConfigurationRepositorySqlite.js';
import { TypeDefinitionAdminRepositorySqlite } from './TypeDefinitionAdminRepositorySqlite.js';
import { SystemConfigRepositorySqlite } from './SystemConfigRepositorySqlite.js';
import { SecurityRepositorySqlite } from './SecurityRepositorySqlite.js';
import { EntitySubtreeQueryPortSqlite } from './EntitySubtreeQueryPortSqlite.js';
import { RealtimeScopeResolverSqlite } from './RealtimeScopeResolverSqlite.js';
import { SystemSeedSqlite } from './SystemSeedSqlite.js';
import { AttachmentRateLimitPortSqlite } from './AttachmentRateLimitPortSqlite.js';
import { ResourceRelationshipRepositorySqlite } from './ResourceRelationshipRepositorySqlite.js';
import { ResourceRelationshipDefinitionReaderSqlite } from './ResourceRelationshipDefinitionReaderSqlite.js';
import { WorkflowRepositorySqlite } from './WorkflowRepositorySqlite.js';

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
  readonly attachmentRepository: AttachmentRepositorySqlite;
  readonly attachmentPolicyRepository: AttachmentPolicyRepositorySqlite;
  readonly resourcePurgeRepository: ResourcePurgeRepositorySqlite;
  readonly typeDefinitionReader: TypeDefinitionReaderSqlite;
  readonly mfaTotpPort: MfaTotpPortSqlite;
  readonly auditQueryPort: AuditQueryPortSqlite;
  readonly serviceConfigurationRepository: ServiceConfigurationRepositorySqlite;
  readonly typeAdminRepository: TypeDefinitionAdminRepositorySqlite;
  readonly systemConfigRepository: SystemConfigRepositorySqlite;
  readonly securityRepository: SecurityRepositorySqlite;
  readonly entitySubtreeQueryPort: EntitySubtreeQueryPortSqlite;
  readonly realtimeScopeResolver: RealtimeScopeResolverSqlite;
  readonly systemSeedService: SystemSeedSqlite;
  readonly attachmentRateLimitPort: AttachmentRateLimitPortSqlite;
  readonly resourceRelationshipRepository: ResourceRelationshipRepositorySqlite;
  readonly resourceRelationshipDefinitionReader: ResourceRelationshipDefinitionReaderSqlite;
  readonly workflowRepository: WorkflowRepositorySqlite;

  constructor(location = ':memory:') {
    this.database = new SqliteDatabase(location);
    ensureSqliteSchema(this.database);
    this.transactionPort = new TransactionPortSqlite(this.database);
    this.accessControlPort = new AccessControlPortSqlite(this.database);
    this.nodeRepository = new NodeRepositorySqlite(this.database, this.accessControlPort);
    this.entityRepository = new EntityRepositorySqlite(this.database, this.accessControlPort);
    this.nodeTypeRepository = new NodeTypeRepositorySqlite(this.database);
    this.entityTypeRepository = new EntityTypeRepositorySqlite(this.database);
    this.lockRepository = new LockRepositorySqlite(this.database);
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
    this.attachmentRepository = new AttachmentRepositorySqlite(this.database);
    this.attachmentRateLimitPort = new AttachmentRateLimitPortSqlite(this.database);
    this.resourceRelationshipRepository = new ResourceRelationshipRepositorySqlite(this.database);
    this.resourceRelationshipDefinitionReader = new ResourceRelationshipDefinitionReaderSqlite(this.database);
    this.workflowRepository = new WorkflowRepositorySqlite(this.database);
    this.attachmentPolicyRepository = new AttachmentPolicyRepositorySqlite(this.database);
    this.resourcePurgeRepository = new ResourcePurgeRepositorySqlite(this.database);
    this.typeDefinitionReader = new TypeDefinitionReaderSqlite(this.database);
    this.mfaTotpPort = new MfaTotpPortSqlite(this.database);
    this.auditQueryPort = new AuditQueryPortSqlite(this.database);
    this.serviceConfigurationRepository = new ServiceConfigurationRepositorySqlite(this.database);
    this.typeAdminRepository = new TypeDefinitionAdminRepositorySqlite(this.database);
    this.systemConfigRepository = new SystemConfigRepositorySqlite(this.database);
    this.securityRepository = new SecurityRepositorySqlite(this.database);
    this.entitySubtreeQueryPort = new EntitySubtreeQueryPortSqlite(this.database, this.accessControlPort);
    this.realtimeScopeResolver = new RealtimeScopeResolverSqlite(this.nodeRepository);
    this.systemSeedService = new SystemSeedSqlite(this.database, process.env.SEED_ADMIN_PASSWORD, process.env.SEED_ADMIN_EMAIL);
    if (process.env.SEED_ADMIN_PASSWORD && !this.database.get("SELECT 1 FROM permissions WHERE permission_key='node.create'")) {
      // SystemSeedSqlite performs synchronous SQLite work before returning its
      // resolved Promise, so the composition root is ready when construction ends.
      void this.systemSeedService.seedDatabase().catch((error: unknown) => {
        console.error('[SqliteInfrastructure] Automatic administrative bootstrap failed:', error);
      });
    }
  }

  close(): void { this.database.close(); }
}
