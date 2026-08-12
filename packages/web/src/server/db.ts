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
  ServiceHealthCheckService,
  DefaultServiceHealthCheckRegistry,
  defaultServiceConfigurationRegistry,
  defaultConfigurationRegistry,
} from '@dashboard/core';
import type { RealtimeChannelPolicy } from '@dashboard/core';
import { RealtimeMetrics } from './RealtimeMetrics';
import { WebhookAccountActionDelivery } from './WebhookAccountActionDelivery';
import { runtimeTiming } from '../config/runtimeTiming';
import crypto from 'crypto';
import { LocalAttachmentStorage } from './LocalAttachmentStorage';
import { DeletedResourcePurgeService } from './DeletedResourcePurgeService';
import type { AttachmentScannerPort } from '@dashboard/core';
import { AttachmentRateLimiter } from './AttachmentRateLimiter';
import { ClamAvAttachmentScanner } from './ClamAvAttachmentScanner';
import { PostgresResourceSecurityPolicyResolver } from './PostgresResourceSecurityPolicyResolver';
import {
  EnvironmentSecretReferenceResolver,
  EnvironmentServiceDeploymentConfigurationSource,
} from './EnvironmentServiceConfiguration';
import { ClamAvHealthCheck, PostgresHealthCheck, RealtimeHttpHealthCheck } from './ServiceHealthCheckAdapters';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is missing. Please define it in your .env or .env.local file.');
}

const databaseUser = new URL(process.env.DATABASE_URL).username;
if (
  databaseUser === 'postgres'
  && (process.env.NODE_ENV === 'production' || process.env.REQUIRE_RESTRICTED_DB_ROLE === 'true')
) {
  throw new Error('Refusing to start the Web application with the PostgreSQL superuser. Configure a restricted login role.');
}

// Inizializza il pool di connessione a PostgreSQL
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

export const pgExecutor = new PgExecutor(pool);
const deploymentConfigurationSource = new EnvironmentServiceDeploymentConfigurationSource();
const deploymentSecretResolver = new EnvironmentSecretReferenceResolver();
const realtimeDeploymentValues: Readonly<Record<string, unknown>> = deploymentConfigurationSource.getSync('realtime')?.providerKey === 'soketi'
  ? deploymentConfigurationSource.getSync('realtime')!.values
  : {};

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
export const transactionPort = new TransactionPortPostgres(pool);
export const auditPort = new AuditPortPostgres(pgExecutor);
export const lockRepository = new LockRepositoryPostgres(pgExecutor);
export const pusherEventBus = new PusherEventBus({
  appId: String(realtimeDeploymentValues.appId ?? ''),
  key: String(realtimeDeploymentValues.appKey ?? ''),
  secret: deploymentSecretResolver.resolveSync(String(realtimeDeploymentValues.appSecret ?? '')) ?? '',
  cluster: String(realtimeDeploymentValues.cluster ?? ''),
  // Il backend gira nella rete Docker: l'endpoint pubblico usato dal browser
  // non coincide necessariamente con quello raggiungibile dal server.
  useTLS: realtimeDeploymentValues.internalScheme === 'https',
  host: typeof realtimeDeploymentValues.internalHost === 'string' ? String(realtimeDeploymentValues.internalHost) : undefined,
  port: typeof realtimeDeploymentValues.internalPort === 'number' ? String(realtimeDeploymentValues.internalPort) : undefined,
  enabled: process.env.REALTIME_ENABLED !== 'false',
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
export const realtimeOutbox = new RealtimeOutboxPostgres(pgExecutor);
export const runtimeConfigPort = new RuntimeConfigurationPortPostgres(pgExecutor);

export async function isRealtimeCapabilityEnabled(): Promise<boolean> {
  if (process.env.REALTIME_ENABLED === 'false') return false;
  return runtimeConfigPort.isCapabilityEnabled('realtime');
}
export const configurationRepository = new ConfigurationRepositoryPostgres(pgExecutor);
export const serviceConfigurationRepository = new ServiceConfigurationRepositoryPostgres(pgExecutor);
export const serviceConfigurationService = new ServiceConfigurationService(
  defaultServiceConfigurationRegistry,
  serviceConfigurationRepository,
  deploymentConfigurationSource,
  deploymentSecretResolver,
);
export const serviceHealthCheckRegistry = new DefaultServiceHealthCheckRegistry();
serviceHealthCheckRegistry.register('database', 'postgres', new PostgresHealthCheck(pgExecutor));
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
export const accessControlPort = new AccessControlPortPostgres(pgExecutor);
export const fieldEncryptionService = new FieldEncryptionService(pgExecutor, configService);
export const revisionPort = new RevisionPortPostgres(pgExecutor, fieldEncryptionService);

// Repository PostgreSQL
export const nodeRepository = new NodeRepositoryPostgres(pgExecutor, fieldEncryptionService);
export const realtimeScopeResolver = new RealtimeScopeResolverPostgres(nodeRepository);
export const nodeTypeRepository = new NodeTypeRepositoryPostgres(pgExecutor);
export const entityRepository = new EntityRepositoryPostgres(pgExecutor, fieldEncryptionService);
export const entityTypeRepository = new EntityTypeRepositoryPostgres(pgExecutor);
export const typeAdminRepository = new TypeDefinitionAdminRepositoryPostgres(pgExecutor);
export const userRepository = new UserRepositoryPostgres(pgExecutor, scheduleRealtimePolicyChange);
export const securityRepository = new SecurityRepositoryPostgres(pgExecutor, scheduleRealtimePolicyChange);
export const systemConfigRepository = new SystemConfigRepositoryPostgres(pgExecutor);
export const sessionRepository = new SessionRepositoryPostgres(pgExecutor);
export const attachmentStorage = new LocalAttachmentStorage();
export const deletedResourcePurgeService = new DeletedResourcePurgeService(
  pgExecutor,
  transactionPort,
  accessControlPort,
  auditPort,
  attachmentStorage,
);
export const attachmentRateLimiter = new AttachmentRateLimiter();
export const resourceSecurityPolicyResolver = new PostgresResourceSecurityPolicyResolver(
  pgExecutor,
  configService,
  nodeRepository,
  entityRepository,
);
export const attachmentScanner: AttachmentScannerPort | undefined = process.env.CLAMAV_HOST
  ? new ClamAvAttachmentScanner()
  : undefined;
export const loginRateLimitPort = new LoginRateLimitPortPostgres(pgExecutor);
export const accountActionTokenPort = new AccountActionTokenPortPostgres(pgExecutor);
export const accountActionDelivery = process.env.ACCOUNT_ACTION_DELIVERY_WEBHOOK_URL
  && process.env.ACCOUNT_ACTION_PUBLIC_BASE_URL
  ? new WebhookAccountActionDelivery(
      process.env.ACCOUNT_ACTION_DELIVERY_WEBHOOK_URL,
      process.env.ACCOUNT_ACTION_PUBLIC_BASE_URL,
      process.env.ACCOUNT_ACTION_DELIVERY_WEBHOOK_SECRET,
    )
  : undefined;
export const mfaTotpPort = new MfaTotpPortPostgres(pgExecutor);
export const mfaTotpService = process.env.MFA_ENCRYPTION_KEY
  ? new MfaTotpApplicationService(mfaTotpPort, auditPort, process.env.MFA_ENCRYPTION_KEY)
  : undefined;

// Registry degli schemi ed invalidazione
export const typeReader = new TypeDefinitionReaderPostgres(pgExecutor);
export const schemaCompiler = new FieldSchemaCompiler();
export const schemaRegistry = new CachingSchemaRegistry(typeReader, schemaCompiler);
export const entitySchemaBridge = new EntitySchemaRegistryBridge(schemaRegistry);

export const schemaInvalidationPort = new SchemaInvalidationAdapter(schemaRegistry);
export const storageTableManager = new StorageTableManagementPostgres(pgExecutor);

// Generatore di UUIDv7 per ID Port
export const idGenerator = {
  generate(): string {
    return crypto.randomUUID();
  }
};

export const lockService = new LockService(
  lockRepository,
  pusherEventBus,
  idGenerator,
  configService,
  auditPort,
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
  schemaRegistry
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
  transactionPort
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

export const auditQueryPort = new AuditQueryPortPostgres(pgExecutor);
export const auditAdminService = new AuditAdminApplicationService(
  auditQueryPort,
  accessControlPort
);

export const entitySubtreeQueryPort = new EntitySubtreeQueryPortPostgres(pgExecutor, fieldEncryptionService);

export const systemSeedService = new SystemSeedPostgres(
  pgExecutor,
  transactionPort,
  process.env.SEED_ADMIN_PASSWORD
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
