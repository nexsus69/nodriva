/** Builds the server composition root for the configured PostgreSQL or SQLite profile. */

import pg from 'pg';
import {
  PgExecutor,
  NodeApplicationService,
  EntityApplicationService,
  TypeAdminApplicationService,
  UserAdminApplicationService,
  ScopedUserProvisioningService,
  UserRepositoryPostgres,
  SecurityAdminApplicationService,
  SecurityRepositoryPostgres,
  SystemAdminApplicationService,
  SystemConfigRepositoryPostgres,
  AuditAdminApplicationService,
  AuditQueryPortPostgres,
  EntitySubtreeQueryPortPostgres,
  NodeRepositoryPostgres,
  FieldEncryptionService,
  NodeTypeRepositoryPostgres,
  EntityRepositoryPostgres,
  EntityTypeRepositoryPostgres,
  TypeDefinitionAdminRepositoryPostgres,
  TypeDefinitionReaderPostgres,
  StorageTableManagementPostgres,
  SystemSeedPostgres,
  AuditPortPostgres,
  RevisionPortPostgres,
  LockRepositoryPostgres,
  PusherEventBus,
  LockService,
  RuntimeConfigurationPortPostgres,
  AccessControlPortPostgres,
  TransactionPortPostgres,
  CachingSchemaRegistry,
  FieldSchemaCompiler,
  EntitySchemaRegistryBridge,
  SchemaInvalidationAdapter,
  LtreeNodePathPolicy,
  SessionRepositoryPostgres,
  LoginRateLimitPortPostgres,
  AccountActionTokenPortPostgres,
  AccountRecoveryApplicationService,
  MfaTotpPortPostgres,
  MfaTotpApplicationService,
  AuthApplicationService,
  HumanActivityService,
  RealtimeScopeResolverPostgres,
  RealtimeOutboxPostgres,
  RealtimeChannelRouter,
  MemoryCache,
  ConfigService,
  ConfigurationRepositoryPostgres,
  ServiceConfigurationRepositoryPostgres,
  ServiceConfigurationService,
  AttachmentRepositoryPostgres,
  AttachmentPolicyRepositoryPostgres,
  ResourcePurgeRepositoryPostgres,
  ServiceHealthCheckService,
  DefaultServiceHealthCheckRegistry,
  defaultServiceConfigurationRegistry,
  defaultConfigurationRegistry,
  SqliteInfrastructure,
  FieldEncryptionServiceSqlite,
  AttachmentRateLimitPortPostgres,
  ResourceRelationshipRepositoryPostgres,
  ResourceRelationshipDefinitionReaderPostgres,
  ResourceRelationshipService,
  ResourceRelationshipMutationService,
  WorkflowRepositoryPostgres,
  WorkflowDefinitionService,
  WorkflowAdminApplicationService,
  WorkflowEventProcessor,
  RuntimeAuditRecordingPolicy,
  PolicyAuditRecorder,
  DescriptiveAuditPort,
  RealtimeAuditCollectionInvalidator,
} from '@dashboard/core';
import type { RealtimeChannelPolicy } from '@dashboard/core';
import { RealtimeMetrics } from './RealtimeMetrics';
import { WebhookAccountActionDelivery } from './WebhookAccountActionDelivery';
import { runtimeTiming } from '../config/runtimeTiming';
import crypto from 'crypto';
import { LocalAttachmentStorage } from './LocalAttachmentStorage';
import { DeletedResourcePurgeService } from './DeletedResourcePurgeService';
import type { AttachmentScannerPort } from '@dashboard/core';
import { ClamAvAttachmentScanner } from './ClamAvAttachmentScanner';
import { PostgresResourceSecurityPolicyResolver } from './PostgresResourceSecurityPolicyResolver';
import {
  EnvironmentSecretReferenceResolver,
  getRealtimePusherConfiguration,
  getPostgresConnectionConfiguration,
  EnvironmentServiceDeploymentConfigurationSource,
  getSecurityKeyConfiguration,
} from './EnvironmentServiceConfiguration';
import { ClamAvHealthCheck, PostgresHealthCheck, RealtimeHttpHealthCheck, SqliteHealthCheck } from './ServiceHealthCheckAdapters';

const deploymentConfigurationSource = new EnvironmentServiceDeploymentConfigurationSource();
const databaseDeployment = deploymentConfigurationSource.getSync('database');
const databaseAdapter = databaseDeployment?.providerKey === 'sqlite' ? 'sqlite' : 'postgres';
const sqliteMode = databaseAdapter === 'sqlite';
const databaseDeploymentValues: Readonly<Record<string, unknown>> = databaseDeployment?.values ?? {};
const sqliteInfrastructure = sqliteMode
  ? new SqliteInfrastructure(String(databaseDeploymentValues.path ?? './data/dashboard.sqlite'))
  : undefined;
const databaseConfiguration = sqliteMode ? null : getPostgresConnectionConfiguration(deploymentConfigurationSource);
const databaseUser = databaseConfiguration?.user;
if (
  databaseUser === 'postgres'
  && (deploymentConfigurationSource.isProduction() || deploymentConfigurationSource.requiresRestrictedDatabaseRole())
) {
  throw new Error('Refusing to start the Web application with the PostgreSQL superuser. Configure a restricted login role.');
}

// Inizializza il pool di connessione a PostgreSQL
const pool = databaseConfiguration ? new pg.Pool({
  host: databaseConfiguration.host,
  port: databaseConfiguration.port,
  database: databaseConfiguration.database,
  user: databaseConfiguration.user,
  password: databaseConfiguration.password,
  ssl: databaseConfiguration.ssl,
}) : undefined;

export const pgExecutor = pool ? new PgExecutor(pool) : undefined;
export const attachmentRepository = sqliteMode ? sqliteInfrastructure!.attachmentRepository : new AttachmentRepositoryPostgres(pgExecutor!);
export const attachmentPolicyRepository = sqliteMode ? sqliteInfrastructure!.attachmentPolicyRepository : new AttachmentPolicyRepositoryPostgres(pgExecutor!);
export const resourcePurgeRepository = sqliteMode ? sqliteInfrastructure!.resourcePurgeRepository : new ResourcePurgeRepositoryPostgres(pgExecutor!);
const deploymentSecretResolver = new EnvironmentSecretReferenceResolver();
const securityKeys = getSecurityKeyConfiguration(deploymentConfigurationSource);
const realtimePusherConfiguration = getRealtimePusherConfiguration(deploymentConfigurationSource, 'internal');

const realtimePolicyCache = new MemoryCache<string, RealtimeChannelPolicy[]>(runtimeTiming.cacheSweepIntervalMs);
export const realtimeMetrics = new RealtimeMetrics();

export function invalidateRealtimePolicyCache(): void {
  realtimePolicyCache.invalidate('all');
}

function scheduleRealtimePolicyChange(userId?: string): void {
  transactionPort.afterCommit(() => {
    invalidateRealtimePolicyCache();
    if (!userId) return;
    return pusherEventBus.revokeUserConnections(userId).catch((error) => {
      console.error('[Realtime] Failed to terminate revoked user connections', { userId, error });
    });
  });
}

async function getRealtimeChannelPolicies(): Promise<RealtimeChannelPolicy[]> {
  return realtimePolicyCache.getOrLoad('all', () => securityRepository.listRealtimeChannelPolicies());
}

// Porte e Adapter concreti infrastrutturali
export const transactionPort = sqliteMode ? sqliteInfrastructure!.transactionPort : new TransactionPortPostgres(pool!);
export const workflowRepository = sqliteMode
  ? sqliteInfrastructure!.workflowRepository
  : new WorkflowRepositoryPostgres(pgExecutor!);
export const workflowDefinitionService = new WorkflowDefinitionService(workflowRepository);
export const workflowEventProcessor = new WorkflowEventProcessor(transactionPort, workflowRepository);
const persistenceAuditPort = new DescriptiveAuditPort(
  sqliteMode ? sqliteInfrastructure!.auditPort : new AuditPortPostgres(pgExecutor!),
);
export const lockRepository = sqliteMode ? sqliteInfrastructure!.lockRepository : new LockRepositoryPostgres(pgExecutor!);
export const pusherEventBus = new PusherEventBus({
  ...realtimePusherConfiguration,
  // Il backend gira nella rete Docker: l'endpoint pubblico usato dal browser
  // non coincide necessariamente con quello raggiungibile dal server.
  isEnabled: isRealtimeCapabilityEnabled,
  resolveDataChannelNames: async (event) => {
    const startedAt = Date.now();
    const policies = await getRealtimeChannelPolicies();
    const channels = new RealtimeChannelRouter(policies).dataChannels(event);
    realtimeMetrics.recordRouting('data', Date.now() - startedAt, channels.length);
    return channels;
  },
  resolveLockChannelNames: async (resourceType, resourceId, scopeNodeId) => {
    const startedAt = Date.now();
    const isNodeScoped = resourceType === 'node' || resourceType === 'entity';
    const parentNodeId = isNodeScoped
      ? (scopeNodeId ?? (resourceType === 'node'
        ? resourceId
        : (await entityRepository.findById(resourceId))?.parentNodeId))
      : undefined;
    const scopeNodeIds = parentNodeId ? await realtimeScopeResolver.resolveScopes({
      eventId: `lock-scope-${resourceType}-${resourceId}`,
      occurredAt: new Date().toISOString(),
      resourceType: resourceType as 'node' | 'entity',
      resourceId,
      changeType: 'updated',
      actorUserId: '',
      parentNodeId: resourceType === 'entity' ? parentNodeId : null,
    }) : [];
    const policies = await getRealtimeChannelPolicies();
    const channels = new RealtimeChannelRouter(policies).lockChannels(
      resourceType as import('@dashboard/core').ResourceKind,
      {
        scopeNodeIds,
        directScopeNodeIds: parentNodeId ? [parentNodeId] : [],
      },
    );
    realtimeMetrics.recordRouting('lock', Date.now() - startedAt, channels.length);
    return channels;
  },
  onPublishMetric: (metric) => realtimeMetrics.recordPublish(
    metric.eventName,
    metric.durationMs,
    metric.channelCount,
    metric.success,
  ),
});
export const realtimeOutbox = sqliteMode ? sqliteInfrastructure!.realtimeOutbox : new RealtimeOutboxPostgres(pgExecutor!);
export const runtimeConfigPort = sqliteMode ? sqliteInfrastructure!.runtimeConfigurationPort : new RuntimeConfigurationPortPostgres(pgExecutor!);

// UUID generator shared by application services and durable outbox events.
export const idGenerator = {
  generate(): string {
    return crypto.randomUUID();
  }
};

export async function isRealtimeCapabilityEnabled(): Promise<boolean> {
  return runtimeConfigPort.isCapabilityEnabled('realtime');
}
export const configurationRepository = sqliteMode ? sqliteInfrastructure!.configurationRepository : new ConfigurationRepositoryPostgres(pgExecutor!);
export const serviceConfigurationRepository = sqliteMode ? sqliteInfrastructure!.serviceConfigurationRepository : new ServiceConfigurationRepositoryPostgres(pgExecutor!);
export const serviceConfigurationService = new ServiceConfigurationService(
  defaultServiceConfigurationRegistry,
  serviceConfigurationRepository,
  deploymentConfigurationSource,
  deploymentSecretResolver,
);
export const serviceHealthCheckRegistry = new DefaultServiceHealthCheckRegistry();
if (!sqliteMode) serviceHealthCheckRegistry.register('database', 'postgres', new PostgresHealthCheck(pgExecutor!));
if (sqliteMode) serviceHealthCheckRegistry.register('database', 'sqlite', new SqliteHealthCheck(sqliteInfrastructure!.database));
serviceHealthCheckRegistry.register('realtime', 'soketi', new RealtimeHttpHealthCheck());
serviceHealthCheckRegistry.register('antivirus', 'clamav', new ClamAvHealthCheck());
export const serviceHealthCheckService = new ServiceHealthCheckService(
  serviceConfigurationService,
  serviceHealthCheckRegistry,
);
export const configService = new ConfigService(
  configurationRepository,
  defaultConfigurationRegistry,
);
/** All audit producers pass through this policy-aware recorder before persistence. */
export const auditPort = new PolicyAuditRecorder(
  persistenceAuditPort,
  new RuntimeAuditRecordingPolicy(runtimeConfigPort),
  transactionPort,
  new RealtimeAuditCollectionInvalidator(realtimeOutbox, runtimeConfigPort, idGenerator),
);
export const accessControlPort = sqliteMode ? sqliteInfrastructure!.accessControlPort : new AccessControlPortPostgres(pgExecutor!);
export const workflowAdminService = new WorkflowAdminApplicationService(
  workflowRepository,
  auditPort,
  transactionPort,
  accessControlPort,
  new Set(['audit.record']),
);
export const fieldEncryptionService = sqliteMode
  ? new FieldEncryptionServiceSqlite(sqliteInfrastructure!.database, configService, securityKeys.fieldEncryptionKey, securityKeys.fieldEncryptionKeys, securityKeys.fieldEncryptionActiveVersion ?? 'v1')
  : new FieldEncryptionService(pgExecutor!, configService, securityKeys.fieldEncryptionKey, securityKeys.fieldEncryptionKeys, securityKeys.fieldEncryptionActiveVersion ?? 'v1');
export const revisionPort = sqliteMode ? sqliteInfrastructure!.revisionPort : new RevisionPortPostgres(pgExecutor!, fieldEncryptionService as FieldEncryptionService);

// Repository PostgreSQL
export const nodeRepository = sqliteMode ? sqliteInfrastructure!.nodeRepository : new NodeRepositoryPostgres(pgExecutor!, fieldEncryptionService as FieldEncryptionService);
export const realtimeScopeResolver = sqliteMode ? sqliteInfrastructure!.realtimeScopeResolver : new RealtimeScopeResolverPostgres(nodeRepository);
export const nodeTypeRepository = sqliteMode ? sqliteInfrastructure!.nodeTypeRepository : new NodeTypeRepositoryPostgres(pgExecutor!);
export const entityRepository = sqliteMode ? sqliteInfrastructure!.entityRepository : new EntityRepositoryPostgres(pgExecutor!, fieldEncryptionService as FieldEncryptionService);
export const resourceRelationshipRepository = sqliteMode
  ? sqliteInfrastructure!.resourceRelationshipRepository
  : new ResourceRelationshipRepositoryPostgres(pgExecutor!);
export const resourceRelationshipDefinitionReader = sqliteMode
  ? sqliteInfrastructure!.resourceRelationshipDefinitionReader
  : new ResourceRelationshipDefinitionReaderPostgres(pgExecutor!);
export const entityTypeRepository = sqliteMode ? sqliteInfrastructure!.entityTypeRepository : new EntityTypeRepositoryPostgres(pgExecutor!);
export const typeAdminRepository = sqliteMode ? sqliteInfrastructure!.typeAdminRepository : new TypeDefinitionAdminRepositoryPostgres(pgExecutor!);
export const userRepository = sqliteMode ? sqliteInfrastructure!.userRepository : new UserRepositoryPostgres(pgExecutor!, scheduleRealtimePolicyChange);
export const securityRepository = sqliteMode ? sqliteInfrastructure!.securityRepository : new SecurityRepositoryPostgres(pgExecutor!, scheduleRealtimePolicyChange);
export const systemConfigRepository = sqliteMode ? sqliteInfrastructure!.systemConfigRepository : new SystemConfigRepositoryPostgres(pgExecutor!);
export const sessionRepository = sqliteMode ? sqliteInfrastructure!.sessionRepository : new SessionRepositoryPostgres(pgExecutor!);
const attachmentStorageDeployment = deploymentConfigurationSource.getSync('attachment-storage');
const attachmentStorageValues: Readonly<Record<string, unknown>> = attachmentStorageDeployment?.providerKey === 'filesystem'
  ? attachmentStorageDeployment.values
  : {};
export const attachmentStorage = new LocalAttachmentStorage(
  typeof attachmentStorageValues.path === 'string' ? attachmentStorageValues.path : undefined,
  securityKeys.attachmentEncryptionKey,
  securityKeys.attachmentEncryptionKeys,
  securityKeys.attachmentEncryptionActiveVersion ?? 'v1',
  attachmentStorageValues.encryptionRequired === true,
);
const antivirusDeployment = deploymentConfigurationSource.getSync('antivirus');
const antivirusValues: Readonly<Record<string, unknown>> = antivirusDeployment?.providerKey === 'clamav'
  ? antivirusDeployment.values
  : {};
export const deletedResourcePurgeService = new DeletedResourcePurgeService(
  resourcePurgeRepository,
  transactionPort,
  accessControlPort,
  auditPort,
  attachmentStorage,
);
export const attachmentRateLimiter = sqliteMode
  ? sqliteInfrastructure!.attachmentRateLimitPort
  : new AttachmentRateLimitPortPostgres(pgExecutor!);
export const resourceSecurityPolicyResolver = new PostgresResourceSecurityPolicyResolver(
  attachmentPolicyRepository,
  configService,
  nodeRepository,
  entityRepository,
  antivirusValues.requireScan === true,
  attachmentStorageValues.encryptionRequired === true,
);
export const attachmentScanner: AttachmentScannerPort | undefined = typeof antivirusValues.host === 'string'
  && typeof antivirusValues.port === 'number'
  ? new ClamAvAttachmentScanner(
      String(antivirusValues.host),
      antivirusValues.port,
      typeof antivirusValues.timeoutMs === 'number' ? antivirusValues.timeoutMs : undefined,
    )
  : undefined;
export const loginRateLimitPort = sqliteMode ? sqliteInfrastructure!.loginRateLimitPort : new LoginRateLimitPortPostgres(pgExecutor!);
export const accountActionTokenPort = sqliteMode ? sqliteInfrastructure!.accountActionTokenPort : new AccountActionTokenPortPostgres(pgExecutor!);
const mailDeployment = deploymentConfigurationSource.getSync('mail');
const mailValues: Readonly<Record<string, unknown>> = mailDeployment?.providerKey === 'webhook' ? mailDeployment.values : {};
export const accountActionDelivery = typeof mailValues.endpoint === 'string'
  && typeof mailValues.publicBaseUrl === 'string'
  ? new WebhookAccountActionDelivery(
      mailValues.endpoint,
      mailValues.publicBaseUrl,
      typeof mailValues.token === 'string' ? deploymentSecretResolver.resolveSync(mailValues.token) ?? undefined : undefined,
    )
  : undefined;
export const mfaTotpPort = sqliteMode ? sqliteInfrastructure!.mfaTotpPort : new MfaTotpPortPostgres(pgExecutor!);
export const mfaTotpService = securityKeys.mfaEncryptionKey
  ? new MfaTotpApplicationService(mfaTotpPort, auditPort, securityKeys.mfaEncryptionKey)
  : undefined;

// Registry degli schemi ed invalidazione
export const typeReader = sqliteMode ? sqliteInfrastructure!.typeDefinitionReader : new TypeDefinitionReaderPostgres(pgExecutor!);
export const schemaCompiler = new FieldSchemaCompiler();
export const schemaRegistry = new CachingSchemaRegistry(typeReader, schemaCompiler);
export const entitySchemaBridge = new EntitySchemaRegistryBridge(schemaRegistry);

export const schemaInvalidationPort = new SchemaInvalidationAdapter(schemaRegistry);
export const storageTableManager = sqliteMode ? sqliteInfrastructure!.storageTableManagement : new StorageTableManagementPostgres(pgExecutor!);
export const resourceRelationshipService = new ResourceRelationshipService(
  resourceRelationshipRepository,
  typeReader,
  nodeRepository,
  entityRepository,
  nodeTypeRepository,
  entityTypeRepository,
  accessControlPort,
);

export const lockService = new LockService(
  lockRepository,
  pusherEventBus,
  idGenerator,
  configService,
  auditPort,
  transactionPort,
);

// Istanziamo i Service Layer concreti pronti per l'uso
export const nodeService = new NodeApplicationService(
  nodeRepository,
  nodeTypeRepository,
  accessControlPort,
  lockService,
  auditPort,
  revisionPort,
  runtimeConfigPort,
  idGenerator,
  new LtreeNodePathPolicy(),
  transactionPort,
  schemaRegistry,
  resourceRelationshipService,
  workflowEventProcessor,
);

export const entityService = new EntityApplicationService(
  entityRepository,
  entityTypeRepository,
  nodeRepository,
  entitySchemaBridge,
  accessControlPort,
  lockService,
  auditPort,
  revisionPort,
  runtimeConfigPort,
  idGenerator,
  transactionPort,
  resourceRelationshipService,
  workflowEventProcessor,
);

export const resourceRelationshipMutationService = new ResourceRelationshipMutationService(
  resourceRelationshipRepository,
  resourceRelationshipService,
  typeReader,
  nodeRepository,
  entityRepository,
  nodeTypeRepository,
  entityTypeRepository,
  accessControlPort,
  lockService,
  auditPort,
  revisionPort,
  runtimeConfigPort,
  transactionPort,
);

export const typeAdminService = new TypeAdminApplicationService(
  typeAdminRepository,
  schemaInvalidationPort,
  auditPort,
  transactionPort,
  idGenerator,
  storageTableManager,
  accessControlPort,
  configService,
);

export const userAdminService = new UserAdminApplicationService(
  userRepository,
  auditPort,
  transactionPort,
  idGenerator,
  accessControlPort,
  sessionRepository,
  securityRepository,
  mfaTotpPort,
);

export const scopedUserProvisioningService = new ScopedUserProvisioningService(
  userRepository,
  securityRepository,
  auditPort,
  transactionPort,
  idGenerator,
  accessControlPort,
);

export const securityAdminService = new SecurityAdminApplicationService(
  securityRepository,
  auditPort,
  transactionPort,
  idGenerator,
  accessControlPort,
  userRepository,
);

export const systemAdminService = new SystemAdminApplicationService(
  systemConfigRepository,
  auditPort,
  transactionPort,
  idGenerator,
  accessControlPort
);

export const auditQueryPort = sqliteMode ? sqliteInfrastructure!.auditQueryPort : new AuditQueryPortPostgres(pgExecutor!);
export const auditAdminService = new AuditAdminApplicationService(
  auditQueryPort,
  accessControlPort
);

export const entitySubtreeQueryPort = sqliteMode ? sqliteInfrastructure!.entitySubtreeQueryPort : new EntitySubtreeQueryPortPostgres(pgExecutor!, fieldEncryptionService as FieldEncryptionService);

export const systemSeedService = sqliteMode
  ? sqliteInfrastructure!.systemSeedService
  : new SystemSeedPostgres(
    pgExecutor!,
    transactionPort,
    deploymentConfigurationSource.resolveSecretSync('secret://env/SEED_ADMIN_PASSWORD') ?? undefined,
    process.env.SEED_ADMIN_EMAIL,
  );

export const authApplicationService = new AuthApplicationService(
  sessionRepository,
  userRepository,
  configService,
  loginRateLimitPort,
  mfaTotpService,
  auditPort,
);
export const humanActivityService = new HumanActivityService(
  sessionRepository,
  lockService,
  transactionPort,
  configService,
);
export const accountRecoveryService = new AccountRecoveryApplicationService(
  accountActionTokenPort, userRepository, sessionRepository, auditPort, transactionPort, accessControlPort,
  mfaTotpPort, accountActionDelivery,
);
