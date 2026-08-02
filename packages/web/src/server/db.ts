import pg from 'pg';
import {
  PgExecutor,
  NodeApplicationService,
  EntityApplicationService,
  TypeAdminApplicationService,
  UserAdminApplicationService,
  UserRepositoryPostgres,
  SecurityAdminApplicationService,
  SecurityRepositoryPostgres,
  SystemAdminApplicationService,
  SystemConfigRepositoryPostgres,
  AuditAdminApplicationService,
  AuditQueryPortPostgres,
  EntitySubtreeQueryPortPostgres,
  NodeRepositoryPostgres,
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
  AuthApplicationService,
  RealtimeScopeResolverPostgres,
  RealtimeOutboxPostgres,
} from '@dashboard/core';
import crypto from 'crypto';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is missing. Please define it in your .env or .env.local file.');
}

// Inizializza il pool di connessione a PostgreSQL
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

export const pgExecutor = new PgExecutor(pool);

// Porte e Adapter concreti infrastrutturali
export const transactionPort = new TransactionPortPostgres(pool);
export const auditPort = new AuditPortPostgres(pgExecutor);
export const revisionPort = new RevisionPortPostgres(pgExecutor);
export const lockRepository = new LockRepositoryPostgres(pgExecutor);
export const pusherEventBus = new PusherEventBus({
  appId: process.env.PUSHER_APP_ID || '',
  key: process.env.NEXT_PUBLIC_PUSHER_KEY || '',
  secret: process.env.PUSHER_SECRET || '',
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || '',
  useTLS: process.env.NEXT_PUBLIC_PUSHER_SCHEME === 'https',
  host: process.env.NEXT_PUBLIC_PUSHER_HOST || undefined,
  port: process.env.NEXT_PUBLIC_PUSHER_PORT || undefined,
  enabled: process.env.REALTIME_ENABLED !== 'false',
});
export const realtimeOutbox = new RealtimeOutboxPostgres(pgExecutor);
export const runtimeConfigPort = new RuntimeConfigurationPortPostgres(pgExecutor);
export const accessControlPort = new AccessControlPortPostgres(pgExecutor);

// Repository PostgreSQL
export const nodeRepository = new NodeRepositoryPostgres(pgExecutor);
export const realtimeScopeResolver = new RealtimeScopeResolverPostgres(nodeRepository);
export const nodeTypeRepository = new NodeTypeRepositoryPostgres(pgExecutor);
export const entityRepository = new EntityRepositoryPostgres(pgExecutor);
export const entityTypeRepository = new EntityTypeRepositoryPostgres(pgExecutor);
export const typeAdminRepository = new TypeDefinitionAdminRepositoryPostgres(pgExecutor);
export const userRepository = new UserRepositoryPostgres(pgExecutor);
export const securityRepository = new SecurityRepositoryPostgres(pgExecutor);
export const systemConfigRepository = new SystemConfigRepositoryPostgres(pgExecutor);
export const sessionRepository = new SessionRepositoryPostgres(pgExecutor);

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

export const lockService = new LockService(lockRepository, pusherEventBus, idGenerator);

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
  accessControlPort
);

export const userAdminService = new UserAdminApplicationService(
  userRepository,
  auditPort,
  transactionPort,
  idGenerator,
  accessControlPort,
  sessionRepository
);

export const securityAdminService = new SecurityAdminApplicationService(
  securityRepository,
  auditPort,
  transactionPort,
  idGenerator,
  accessControlPort
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

export const entitySubtreeQueryPort = new EntitySubtreeQueryPortPostgres(pgExecutor);

export const systemSeedService = new SystemSeedPostgres(
  pgExecutor,
  transactionPort,
  process.env.SEED_ADMIN_PASSWORD
);

export const authApplicationService = new AuthApplicationService(sessionRepository, userRepository);
