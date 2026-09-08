/** Compares observable SQLite and PostgreSQL persistence behavior. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import type { NodeRepository } from '../application/ports/NodeRepository.js';
import type { EntityRepository } from '../application/ports/EntityRepository.js';
import type { LockRepository } from '../application/ports/LockRepository.js';
import type { TransactionPort } from '../application/ports/TransactionPort.js';
import type { AttachmentRepository } from '../application/ports/AttachmentRepository.js';
import type { AttachmentRateLimitPort } from '../application/ports/AttachmentRateLimitPort.js';
import { Node } from '../domain/models/Node.js';
import { Entity } from '../domain/models/Entity.js';
import { Lock } from '../domain/models/Lock.js';
import { SqliteInfrastructure } from './sqlite/SqliteInfrastructure.js';
import { PgExecutor } from './postgres/PgExecutor.js';
import { NodeRepositoryPostgres } from './postgres/NodeRepositoryPostgres.js';
import { EntityRepositoryPostgres } from './postgres/EntityRepositoryPostgres.js';
import { LockRepositoryPostgres } from './postgres/LockRepositoryPostgres.js';
import { TransactionPortPostgres } from './postgres/TransactionPortPostgres.js';
import { AttachmentRepositoryPostgres } from './postgres/AttachmentRepositoryPostgres.js';
import { AttachmentRateLimitPortPostgres } from './postgres/AttachmentRateLimitPortPostgres.js';
import { StorageTableManagementPostgres } from './postgres/StorageTableManagementPostgres.js';
import { FieldEncryptionService } from './postgres/FieldEncryptionService.js';
import { FieldEncryptionServiceSqlite } from './sqlite/FieldEncryptionServiceSqlite.js';
import { ResourceRelationshipService } from '../application/services/ResourceRelationshipService.js';
import type { ResourceRelationshipRepository } from '../application/ports/ResourceRelationshipRepository.js';
import type { TypeDefinitionReader } from '../application/ports/TypeDefinitionReader.js';
import type { NodeTypeRepository } from '../application/ports/NodeTypeRepository.js';
import type { EntityTypeRepository } from '../application/ports/EntityTypeRepository.js';
import type { AccessControlPort } from '../application/ports/AccessControlPort.js';
import type { EntitySubtreeQueryPort } from '../application/ports/EntitySubtreeQueryPort.js';
import { ResourceRelationshipRepositoryPostgres } from './postgres/ResourceRelationshipRepositoryPostgres.js';
import { TypeDefinitionReaderPostgres } from './postgres/TypeDefinitionReaderPostgres.js';
import { NodeTypeRepositoryPostgres } from './postgres/NodeTypeRepositoryPostgres.js';
import { EntityTypeRepositoryPostgres } from './postgres/EntityTypeRepositoryPostgres.js';
import { AccessControlPortPostgres } from './postgres/AccessControlPortPostgres.js';
import { EntitySubtreeQueryPortPostgres } from './postgres/EntitySubtreeQueryPortPostgres.js';

const integrationDatabaseUrl = process.env.INTEGRATION_DATABASE_URL;
const integrationDatabaseName = integrationDatabaseUrl ? new URL(integrationDatabaseUrl).pathname.slice(1) : '';
const describeIntegration = integrationDatabaseUrl && /(?:^|_)test(?:_|$)/.test(integrationDatabaseName)
  ? describe
  : describe.skip;

const ids = {
  actor: '10000000-0000-0000-0000-000000009101',
  otherActor: '10000000-0000-0000-0000-000000009102',
  session: '10000000-0000-0000-0000-000000009103',
  otherSession: '10000000-0000-0000-0000-000000009104',
  nodeType: '10000000-0000-0000-0000-000000009110',
  entityType: '10000000-0000-0000-0000-000000009111',
  entityField: '10000000-0000-0000-0000-000000009112',
  entitySecretField: '10000000-0000-0000-0000-000000009113',
  entityRelationField: '10000000-0000-0000-0000-000000009114',
  root: '10000000-0000-0000-0000-000000009120',
  child: '10000000-0000-0000-0000-000000009121',
  grandchild: '10000000-0000-0000-0000-000000009122',
  duplicate: '10000000-0000-0000-0000-000000009123',
  reusable: '10000000-0000-0000-0000-000000009124',
  replacement: '10000000-0000-0000-0000-000000009125',
  transactionProbe: '10000000-0000-0000-0000-000000009126',
  subtreeRoot: '10000000-0000-0000-0000-000000009127',
  subtreeChild: '10000000-0000-0000-0000-000000009128',
  alphaEntity: '10000000-0000-0000-0000-000000009130',
  zetaEntity: '10000000-0000-0000-0000-000000009131',
  subtreeAlphaEntity: '10000000-0000-0000-0000-000000009132',
  subtreeBravoEntity: '10000000-0000-0000-0000-000000009133',
  subtreeCharlieEntity: '10000000-0000-0000-0000-000000009134',
  attachmentOne: '10000000-0000-0000-0000-000000009140',
  attachmentTwo: '10000000-0000-0000-0000-000000009141',
  lockOne: '10000000-0000-0000-0000-000000009150',
  lockTwo: '10000000-0000-0000-0000-000000009151',
  deleteBatch: '10000000-0000-0000-0000-000000009160',
  reuseBatch: '10000000-0000-0000-0000-000000009161',
} as const;

const allNodeIds: string[] = [ids.root, ids.child, ids.grandchild, ids.duplicate, ids.reusable, ids.replacement, ids.transactionProbe, ids.subtreeRoot, ids.subtreeChild];
const allEntityIds: string[] = [ids.alphaEntity, ids.zetaEntity, ids.subtreeAlphaEntity, ids.subtreeBravoEntity, ids.subtreeCharlieEntity];

interface AdapterHarness {
  nodeRepository: NodeRepository;
  entityRepository: EntityRepository;
  lockRepository: LockRepository;
  transactionPort: TransactionPort;
  attachmentRepository: AttachmentRepository;
  attachmentRateLimitPort: AttachmentRateLimitPort;
  relationshipRepository: ResourceRelationshipRepository;
  typeDefinitionReader: TypeDefinitionReader;
  nodeTypeRepository: NodeTypeRepository;
  entityTypeRepository: EntityTypeRepository;
  accessControlPort: AccessControlPort;
  entitySubtreeQueryPort: EntitySubtreeQueryPort;
  inspectEncryptedStorage(): Promise<{ rawContainsSecret: boolean; sidecarCount: number }>;
  setup(): Promise<void>;
  cleanup(): Promise<void>;
}

interface AdapterBehavior {
  nodeRoundTrip: { name: string; payload: Record<string, unknown>; children: string[]; ancestors: string[]; descendant: boolean };
  duplicateNodeError: string;
  staleNodeDeleteError: string;
  entityOrder: string[];
  entityRoundTrip: { name: string; payload: Record<string, unknown>; rowVersion: number };
  staleEntityUpdateError: string;
  staleEntityDeleteError: string;
  deletedEntityVersion: number;
  deletedEntityVisibility: { admin: string[]; inactive: string[] };
  staleEntityRestoreError: string;
  restoredEntityVersion: number;
  lock: { owner: string | null; conflictError: string; forbiddenReleaseError: string; released: boolean };
  deletedSubtree: { ids: string[]; entityWasDeleted: boolean; visibleNodes: string[]; hiddenNodes: string[] };
  staleNodeRestoreError: string;
  restoredSubtree: { ids: string[]; entityWasRestored: boolean };
  pathReuseAllowed: boolean;
  transactionRolledBack: boolean;
  attachmentQuota: { accepted: boolean[]; usedBytes: number };
  rateLimit: boolean[];
  encryption: { rawContainsSecret: boolean; sidecarCount: number };
  deleteResponse: { deleted: boolean; parentNodeId: string | null; persistedParentId: string | null; deletedNodeId: string };
}

function makeNode(id: string, parentId: string | null, path: string, pathLabel: string, depth: number, name: string): Node {
  const createdAt = new Date('2026-01-01T10:00:00.000Z');
  return new Node(id, parentId, path, pathLabel, depth, ids.nodeType, name, `${name} description`, 1,
    createdAt, createdAt, null, ids.actor, ids.actor, { marker: name.toLowerCase() });
}

function makeEntity(id: string, name: string, createdAt: Date): Entity {
  return new Entity(id, ids.entityType, ids.child, name, `${name} description`, 1, createdAt, createdAt,
    null, ids.actor, ids.actor, { value: `${name}-value`, secret: `${name}-secret` });
}

function enabledEncryptionConfig() {
  return { get: async () => true };
}

async function errorName(work: () => Promise<unknown>): Promise<string> {
  try {
    await work();
    return 'NO_ERROR';
  } catch (error: unknown) {
    return error instanceof Error ? error.constructor.name : typeof error;
  }
}

async function observe(harness: AdapterHarness): Promise<AdapterBehavior> {
  const root = makeNode(ids.root, null, 'parity_root', 'parity_root', 0, 'Parity Root');
  const child = makeNode(ids.child, ids.root, 'parity_root.child', 'child', 1, 'Child');
  const grandchild = makeNode(ids.grandchild, ids.child, 'parity_root.child.grandchild', 'grandchild', 2, 'Grandchild');
  await harness.nodeRepository.create(root);
  await harness.nodeRepository.create(child);
  await harness.nodeRepository.create(grandchild);

  const loadedRoot = await harness.nodeRepository.findById(ids.root);
  const nodeRoundTrip = {
    name: loadedRoot?.name ?? '',
    payload: loadedRoot?.payload ?? {},
    children: (await harness.nodeRepository.listChildren(ids.root)).map((node) => node.id),
    ancestors: await harness.nodeRepository.listAncestorIds(ids.grandchild),
    descendant: await harness.nodeRepository.isDescendantOf(ids.grandchild, ids.root),
  };
  const duplicateNodeError = await errorName(() => harness.nodeRepository.create(
    makeNode(ids.duplicate, null, 'parity_root', 'parity_root', 0, 'Duplicate'),
  ));
  const staleNodeDeleteError = await errorName(() => harness.nodeRepository.softDeleteSubtree(
    ids.child, ids.actor, 99, ids.deleteBatch,
  ));

  const zeta = makeEntity(ids.zetaEntity, 'Zeta', new Date('2026-01-01T09:00:00.000Z'));
  const alpha = makeEntity(ids.alphaEntity, 'Alpha', new Date('2026-01-01T11:00:00.000Z'));
  await harness.entityRepository.create(zeta);
  await harness.entityRepository.create(alpha);
  const entityOrder = (await harness.entityRepository.listByNode(ids.child)).map((entity) => entity.name);
  const updatedAlpha = alpha.update('Alpha updated', 'Updated description', { value: 'updated-value', secret: 'updated-secret' }, ids.actor);
  await harness.entityRepository.update(updatedAlpha);
  const loadedAlpha = await harness.entityRepository.findById(ids.alphaEntity);
  const entityRoundTrip = {
    name: loadedAlpha?.name ?? '',
    payload: loadedAlpha?.payload ?? {},
    rowVersion: loadedAlpha?.rowVersion ?? 0,
  };
  const staleEntityUpdateError = await errorName(() => harness.entityRepository.update(updatedAlpha));
  const staleEntityDeleteError = await errorName(() => harness.entityRepository.softDelete(ids.alphaEntity, ids.actor, 1, ids.deleteBatch));
  await harness.entityRepository.softDelete(ids.alphaEntity, ids.actor, 2, ids.deleteBatch);
  const deletedEntityVersion = (await harness.entityRepository.findDeletedById(ids.alphaEntity))?.rowVersion ?? 0;
  const deletedEntityVisibility = {
    admin: (await harness.entityRepository.listDeletedByScope(ids.actor)).map((entity) => entity.id).filter((id) => allEntityIds.includes(id)).sort(),
    inactive: (await harness.entityRepository.listDeletedByScope(ids.otherActor)).map((entity) => entity.id).filter((id) => allEntityIds.includes(id)).sort(),
  };
  const staleEntityRestoreError = await errorName(() => harness.entityRepository.restore(ids.alphaEntity, ids.actor, 2));
  await harness.entityRepository.restore(ids.alphaEntity, ids.actor, 3);
  const restoredEntityVersion = (await harness.entityRepository.findById(ids.alphaEntity))?.rowVersion ?? 0;

  const resource = { resourceType: 'node' as const, resourceId: ids.child };
  const acquiredAt = new Date(Date.now() - 1_000);
  const expiresAt = new Date(Date.now() + 60_000);
  await harness.lockRepository.acquire(new Lock(ids.lockOne, resource, ids.actor, ids.session, acquiredAt, expiresAt));
  const owner = (await harness.lockRepository.getLock(resource))?.userId ?? null;
  const conflictError = await errorName(() => harness.lockRepository.acquire(
    new Lock(ids.lockTwo, resource, ids.otherActor, ids.otherSession, acquiredAt, expiresAt),
  ));
  const forbiddenReleaseError = await errorName(() => harness.lockRepository.release(resource, ids.otherActor, ids.otherSession));
  await harness.lockRepository.release(resource, ids.actor, ids.session);
  const released = (await harness.lockRepository.getLock(resource)) === null;

  // This is the persistence projection used by the server action after a
  // successful delete: capture the parent before the mutation, then verify
  // that both adapters preserve it on the soft-deleted row.
  const deleteTarget = await harness.nodeRepository.findById(ids.child);
  const deletedIds = (await harness.nodeRepository.softDeleteSubtree(ids.child, ids.actor, 1, ids.deleteBatch)).sort();
  const deletedNode = await harness.nodeRepository.findDeletedById(ids.child);
  const deleteResponse = {
    deleted: deletedIds.includes(ids.child),
    parentNodeId: deleteTarget?.parentId ?? null,
    persistedParentId: deletedNode?.parentId ?? null,
    deletedNodeId: ids.child,
  };
  const deletedSubtree = {
    ids: deletedIds,
    entityWasDeleted: (await harness.entityRepository.findDeletedById(ids.alphaEntity)) !== null,
    visibleNodes: (await harness.nodeRepository.listDeletedByScope(ids.actor)).map((node) => node.id).filter((id) => allNodeIds.includes(id)).sort(),
    hiddenNodes: (await harness.nodeRepository.listDeletedByScope(ids.otherActor)).map((node) => node.id).filter((id) => allNodeIds.includes(id)).sort(),
  };
  const staleNodeRestoreError = await errorName(() => harness.nodeRepository.restoreSubtree(
    ids.child, ids.actor, 1, ids.deleteBatch,
  ));
  const restoredIds = (await harness.nodeRepository.restoreSubtree(ids.child, ids.actor, 2, ids.deleteBatch)).sort();
  const restoredSubtree = {
    ids: restoredIds,
    entityWasRestored: (await harness.entityRepository.findById(ids.alphaEntity)) !== null,
  };

  await harness.nodeRepository.create(makeNode(ids.reusable, null, 'reusable_root', 'reusable_root', 0, 'Reusable'));
  await harness.nodeRepository.softDeleteSubtree(ids.reusable, ids.actor, 1, ids.reuseBatch);
  await harness.nodeRepository.create(makeNode(ids.replacement, null, 'reusable_root', 'reusable_root', 0, 'Replacement'));
  const pathReuseAllowed = (await harness.nodeRepository.findById(ids.replacement)) !== null;

  await errorName(() => harness.transactionPort.runInTransaction(async () => {
    await harness.nodeRepository.create(makeNode(ids.transactionProbe, null, 'transaction_probe', 'transaction_probe', 0, 'Transaction probe'));
    throw new Error('ROLLBACK_PROBE');
  }));
  const transactionRolledBack = (await harness.nodeRepository.findById(ids.transactionProbe)) === null;

  const firstAttachment = {
    id: ids.attachmentOne, resourceType: 'node' as const, resourceId: ids.root, fieldKey: 'document', kind: 'file' as const,
    fileName: 'one.txt', mimeType: 'text/plain', sizeBytes: 60, storageKey: `parity/${ids.attachmentOne}`, checksum: 'one', createdBy: ids.actor,
  };
  const secondAttachment = {
    ...firstAttachment, id: ids.attachmentTwo, fileName: 'two.txt', sizeBytes: 50,
    storageKey: `parity/${ids.attachmentTwo}`, checksum: 'two',
  };
  const attachmentQuota = {
    accepted: [
      await harness.attachmentRepository.createWithinQuota(firstAttachment, 100),
      await harness.attachmentRepository.createWithinQuota(secondAttachment, 100),
    ],
    usedBytes: await harness.attachmentRepository.getResourceQuota('node', ids.root),
  };
  const now = new Date('2026-01-01T12:00:00.000Z');
  const rateLimit = [
    await harness.attachmentRateLimitPort.consume(ids.actor, 2, now),
    await harness.attachmentRateLimitPort.consume(ids.actor, 2, now),
    await harness.attachmentRateLimitPort.consume(ids.actor, 2, now),
  ];
  const encryption = await harness.inspectEncryptedStorage();

  return {
    nodeRoundTrip, duplicateNodeError, staleNodeDeleteError, entityOrder, entityRoundTrip,
    staleEntityUpdateError, staleEntityDeleteError, deletedEntityVersion, deletedEntityVisibility,
    staleEntityRestoreError, restoredEntityVersion,
    lock: { owner, conflictError, forbiddenReleaseError, released },
    deletedSubtree, staleNodeRestoreError, restoredSubtree, pathReuseAllowed, transactionRolledBack,
    attachmentQuota, rateLimit, encryption, deleteResponse,
  };
}

describeIntegration('SQLite/PostgreSQL persistence adapter E2E parity', () => {
  let pool: pg.Pool;
  let postgres: AdapterHarness;
  let sqlite: AdapterHarness;
  let adminPool: pg.Pool | undefined;
  let adminExecutor: PgExecutor | undefined;

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: integrationDatabaseUrl, max: 4 });
    const executor = new PgExecutor(pool);
    const storageTableManager = new StorageTableManagementPostgres(executor);
    const adminDatabaseUrl = process.env.INTEGRATION_DATABASE_ADMIN_URL;
    if (adminDatabaseUrl) {
      adminPool = new pg.Pool({ connectionString: adminDatabaseUrl, max: 2 });
      adminExecutor = new PgExecutor(adminPool);
    }
    const postgresCleanup = async () => {
      await executor.query('DELETE FROM attachment_upload_events WHERE actor_id = ANY($1::uuid[])', [[ids.actor, ids.otherActor]]);
      await executor.query('DELETE FROM resource_attachments WHERE id = ANY($1::uuid[])', [[ids.attachmentOne, ids.attachmentTwo]]);
      await executor.query('DELETE FROM resource_field_ciphertexts WHERE resource_id = ANY($1::uuid[])', [[...allNodeIds, ...allEntityIds]]);
      await executor.query('DELETE FROM resource_relationships WHERE source_field_id = $1', [ids.entityRelationField]);
      await executor.query('DELETE FROM locks WHERE id = ANY($1::uuid[]) OR session_id = ANY($2::uuid[])', [[ids.lockOne, ids.lockTwo], [ids.session, ids.otherSession]]);
      await executor.query('DELETE FROM user_sessions WHERE id = ANY($1::uuid[])', [[ids.session, ids.otherSession]]);
      await executor.query('DELETE FROM entities WHERE id = ANY($1::uuid[])', [allEntityIds]);
      await executor.query('DELETE FROM nodes WHERE id = ANY($1::uuid[])', [allNodeIds]);
      await adminExecutor?.query('DROP TABLE IF EXISTS entity_parity_probe');
      await executor.query('DELETE FROM entity_type_fields WHERE entity_type_id = $1', [ids.entityType]);
      await executor.query('DELETE FROM entity_types WHERE id = $1', [ids.entityType]);
      await executor.query('DELETE FROM node_types WHERE id = $1', [ids.nodeType]);
      await executor.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [[ids.actor, ids.otherActor]]);
    };
    postgres = {
      nodeRepository: new NodeRepositoryPostgres(executor, new FieldEncryptionService(executor, enabledEncryptionConfig() as never, '11'.repeat(32))),
      entityRepository: new EntityRepositoryPostgres(executor, new FieldEncryptionService(executor, enabledEncryptionConfig() as never, '11'.repeat(32))),
      lockRepository: new LockRepositoryPostgres(executor),
      transactionPort: new TransactionPortPostgres(pool),
      attachmentRepository: new AttachmentRepositoryPostgres(executor),
      attachmentRateLimitPort: new AttachmentRateLimitPortPostgres(executor),
      relationshipRepository: new ResourceRelationshipRepositoryPostgres(executor),
      typeDefinitionReader: new TypeDefinitionReaderPostgres(executor),
      nodeTypeRepository: new NodeTypeRepositoryPostgres(executor),
      entityTypeRepository: new EntityTypeRepositoryPostgres(executor),
      accessControlPort: new AccessControlPortPostgres(executor),
      entitySubtreeQueryPort: new EntitySubtreeQueryPortPostgres(executor, new FieldEncryptionService(executor, enabledEncryptionConfig() as never, '11'.repeat(32))),
      inspectEncryptedStorage: async () => {
        const raw = await executor.query<{ value_text: string | null; secret_text: string | null }>('SELECT value_text, secret_text FROM entity_parity_probe WHERE entity_id = $1', [ids.alphaEntity]);
        const sidecar = await executor.query<{ count: string }>("SELECT count(*) FROM resource_field_ciphertexts WHERE resource_type = 'entity' AND resource_id = $1", [ids.alphaEntity]);
        const row = raw.rows[0];
        return {
          rawContainsSecret: row?.value_text === 'updated-secret' || row?.secret_text === 'updated-secret',
          sidecarCount: Number(sidecar.rows[0]?.count ?? 0),
        };
      },
      cleanup: postgresCleanup,
      setup: async () => {
        await postgresCleanup();
        await executor.query(
          `INSERT INTO users(id,email,password_hash,is_active,is_super_admin) VALUES
           ($1,'parity-admin@example.test','unused',true,true),
           ($2,'parity-inactive@example.test','unused',false,false)`,
          [ids.actor, ids.otherActor],
        );
        await executor.query(
          `INSERT INTO user_sessions(id,user_id,session_token_hash,expires_at) VALUES
           ($1,$2,'parity-session-one',now() + interval '1 hour'),
           ($3,$4,'parity-session-two',now() + interval '1 hour')`,
          [ids.session, ids.actor, ids.otherSession, ids.otherActor],
        );
        await executor.query("INSERT INTO node_types(id,type_key,name,description) VALUES ($1,'parity-node','Parity node','')", [ids.nodeType]);
        await executor.query("INSERT INTO entity_types(id,type_key,name,description,storage_table) VALUES ($1,'parity-entity','Parity entity','','entity_parity_probe')", [ids.entityType]);
        await executor.query(
          `INSERT INTO entity_type_fields(id,entity_type_id,field_key,label,column_name,data_type,encryption_mode,position) VALUES
           ($1,$2,'value','Value','value_text','string','plaintext',1),
           ($3,$2,'secret','Secret','secret_text','string','encrypted',2),
           ($4,$2,'dependsOn','Depends on','depends_on','relation','plaintext',3)`,
          [ids.entityField, ids.entityType, ids.entitySecretField, ids.entityRelationField],
        );
        await executor.query("UPDATE entity_type_fields SET relation_target_domain='entity', relation_target_type_key='parity-entity', relation_source_cardinality='one' WHERE id=$1", [ids.entityRelationField]);
        const storageExists = await executor.query<{ exists: boolean }>(
          "SELECT to_regclass('public.entity_parity_probe') IS NOT NULL AS exists",
        );
        if (!storageExists.rows[0]?.exists) {
          await storageTableManager.createStorageTable('entity_parity_probe');
          await storageTableManager.addColumn('entity_parity_probe', 'value_text', 'string', false, false, null);
          await storageTableManager.addColumn('entity_parity_probe', 'secret_text', 'string', false, false, null);
        }
      },
    };

    const sqliteInfrastructure = new SqliteInfrastructure();
    const sqliteEncryption = new FieldEncryptionServiceSqlite(sqliteInfrastructure.database, enabledEncryptionConfig() as never, '11'.repeat(32));
    sqliteInfrastructure.configureFieldEncryption(sqliteEncryption);
    sqlite = {
      nodeRepository: sqliteInfrastructure.nodeRepository,
      entityRepository: sqliteInfrastructure.entityRepository,
      lockRepository: sqliteInfrastructure.lockRepository,
      transactionPort: sqliteInfrastructure.transactionPort,
      attachmentRepository: sqliteInfrastructure.attachmentRepository,
      attachmentRateLimitPort: sqliteInfrastructure.attachmentRateLimitPort,
      relationshipRepository: sqliteInfrastructure.resourceRelationshipRepository,
      typeDefinitionReader: sqliteInfrastructure.typeDefinitionReader,
      nodeTypeRepository: sqliteInfrastructure.nodeTypeRepository,
      entityTypeRepository: sqliteInfrastructure.entityTypeRepository,
      accessControlPort: sqliteInfrastructure.accessControlPort,
      entitySubtreeQueryPort: sqliteInfrastructure.entitySubtreeQueryPort,
      inspectEncryptedStorage: async () => {
        const raw = sqliteInfrastructure.database.get<{ payload: string }>('SELECT payload FROM entities WHERE id=?', [ids.alphaEntity]);
        return {
          rawContainsSecret: raw?.payload.includes('updated-secret') ?? false,
          sidecarCount: sqliteInfrastructure.database.all("SELECT 1 FROM resource_field_ciphertexts WHERE resource_type = 'entity' AND resource_id = ?", [ids.alphaEntity]).length,
        };
      },
      cleanup: async () => sqliteInfrastructure.close(),
      setup: async () => {
        sqliteInfrastructure.database.run('INSERT INTO users(id,email,password_hash,is_active,is_super_admin) VALUES (?,?,?,?,?)', [ids.actor, 'parity-admin@example.test', 'unused', 1, 1]);
        sqliteInfrastructure.database.run('INSERT INTO users(id,email,password_hash,is_active,is_super_admin) VALUES (?,?,?,?,?)', [ids.otherActor, 'parity-inactive@example.test', 'unused', 0, 0]);
        sqliteInfrastructure.database.run('INSERT INTO node_types(id,type_key,name,description) VALUES (?,?,?,?)', [ids.nodeType, 'parity-node', 'Parity node', '']);
        sqliteInfrastructure.database.run('INSERT INTO entity_types(id,type_key,name,description,storage_table) VALUES (?,?,?,?,?)', [ids.entityType, 'parity-entity', 'Parity entity', '', 'entity_parity_probe']);
        sqliteInfrastructure.database.run('INSERT INTO entity_type_fields(id,entity_type_id,field_key,label,column_name,data_type,encryption_mode,position) VALUES (?,?,?,?,?,?,?,?)', [ids.entityField, ids.entityType, 'value', 'Value', 'value_text', 'string', 'plaintext', 1]);
        sqliteInfrastructure.database.run('INSERT INTO entity_type_fields(id,entity_type_id,field_key,label,column_name,data_type,encryption_mode,position) VALUES (?,?,?,?,?,?,?,?)', [ids.entitySecretField, ids.entityType, 'secret', 'Secret', 'secret_text', 'string', 'encrypted', 2]);
        sqliteInfrastructure.database.run("INSERT INTO entity_type_fields(id,entity_type_id,field_key,label,column_name,data_type,encryption_mode,position,relation_target_domain,relation_target_type_key,relation_source_cardinality) VALUES (?,?,?,?,?,?,?,?,?,?,?)", [ids.entityRelationField, ids.entityType, 'dependsOn', 'Depends on', 'depends_on', 'relation', 'plaintext', 3, 'entity', 'parity-entity', 'one']);
      },
    };
    await Promise.all([postgres.setup(), sqlite.setup()]);
  }, 30_000);

  afterAll(async () => {
    if (postgres) await postgres.cleanup();
    if (sqlite) await sqlite.cleanup();
    if (pool) await pool.end();
    if (adminPool) await adminPool.end();
  }, 30_000);

  it('produces the same observable results and domain errors for both databases', async () => {
    const [postgresBehavior, sqliteBehavior] = await Promise.all([observe(postgres), observe(sqlite)]);
    expect(postgresBehavior).toEqual(sqliteBehavior);
    expect(postgresBehavior).toMatchObject({
      duplicateNodeError: 'NodePathCollisionError',
      staleNodeDeleteError: 'RowVersionMismatchError',
      entityOrder: ['Alpha', 'Zeta'],
      entityRoundTrip: { name: 'Alpha updated', payload: { value: 'updated-value', secret: 'updated-secret' }, rowVersion: 2 },
      staleEntityUpdateError: 'RowVersionMismatchError',
      staleEntityDeleteError: 'RowVersionMismatchError',
      deletedEntityVersion: 3,
      deletedEntityVisibility: { admin: [ids.alphaEntity], inactive: [] },
      staleEntityRestoreError: 'RowVersionMismatchError',
      restoredEntityVersion: 4,
      lock: { owner: ids.actor, conflictError: 'LockConflictError', forbiddenReleaseError: 'LockForbiddenError', released: true },
      deletedSubtree: { ids: [ids.child, ids.grandchild], entityWasDeleted: true, visibleNodes: [ids.child], hiddenNodes: [] },
      staleNodeRestoreError: 'RowVersionMismatchError',
      restoredSubtree: { ids: [ids.child, ids.grandchild], entityWasRestored: true },
      pathReuseAllowed: true,
      transactionRolledBack: true,
      attachmentQuota: { accepted: [true, false], usedBytes: 60 },
      rateLimit: [true, true, false],
      encryption: { rawContainsSecret: false, sidecarCount: 1 },
      deleteResponse: { deleted: true, parentNodeId: ids.root, persistedParentId: ids.root, deletedNodeId: ids.child },
    });
  }, 30_000);

  it('returns the same ACL-filtered paginated subtree pages for both adapters', async () => {
    const observePages = async (harness: AdapterHarness) => {
      await harness.nodeRepository.create(makeNode(ids.subtreeRoot, null, 'subtree_parity', 'subtree_parity', 0, 'Subtree parity'));
      await harness.nodeRepository.create(makeNode(ids.subtreeChild, ids.subtreeRoot, 'subtree_parity.child', 'child', 1, 'Subtree child'));
      await harness.entityRepository.create(new Entity(
        ids.subtreeCharlieEntity, ids.entityType, ids.subtreeChild, 'Charlie', 'Charlie description', 1,
        new Date('2026-01-01T08:00:00.000Z'), new Date('2026-01-01T08:00:00.000Z'), null, ids.actor, ids.actor,
        { value: 'charlie-value', secret: 'charlie-secret' },
      ));
      await harness.entityRepository.create(new Entity(
        ids.subtreeAlphaEntity, ids.entityType, ids.subtreeChild, 'Alpha', 'Alpha description', 1,
        new Date('2026-01-01T08:00:00.000Z'), new Date('2026-01-01T08:00:00.000Z'), null, ids.actor, ids.actor,
        { value: 'alpha-value', secret: 'alpha-secret' },
      ));
      await harness.entityRepository.create(new Entity(
        ids.subtreeBravoEntity, ids.entityType, ids.subtreeChild, 'Bravo', 'Bravo description', 1,
        new Date('2026-01-01T08:00:00.000Z'), new Date('2026-01-01T08:00:00.000Z'), null, ids.actor, ids.actor,
        { value: 'bravo-value', secret: 'bravo-secret' },
      ));

      const first = await harness.entitySubtreeQueryPort.findSubtreeEntitiesPaginated({
        baseNodeId: ids.subtreeRoot, actorUserId: ids.actor, limit: 2,
      });
      if (!first.nextCursor) throw new Error('Expected a forward page cursor.');
      const previous = await harness.entitySubtreeQueryPort.findSubtreeEntitiesPaginated({
        baseNodeId: ids.subtreeRoot, actorUserId: ids.actor, limit: 2, direction: 'backward', cursor: first.nextCursor,
      });
      return { first, previous };
    };

    const [postgresPages, sqlitePages] = await Promise.all([observePages(postgres), observePages(sqlite)]);
    expect(postgresPages).toEqual(sqlitePages);
    expect(postgresPages.first).toMatchObject({
      hasMore: true,
      items: [
        { id: ids.subtreeAlphaEntity, name: 'Alpha', payload: { value: 'alpha-value', secret: 'alpha-secret' } },
        { id: ids.subtreeBravoEntity, name: 'Bravo', payload: { value: 'bravo-value', secret: 'bravo-secret' } },
      ],
    });
    expect(postgresPages.previous.items.map((item) => item.name)).toEqual(['Alpha']);
  }, 30_000);

  it('hydrates the same relationship collection after ACL and soft-delete filtering', async () => {
    const hydrate = async (harness: AdapterHarness) => {
      await harness.relationshipRepository.replaceValues({
        sourceFieldId: ids.entityRelationField, sourceDomain: 'entity', sourceResourceId: ids.alphaEntity,
        targetDomain: 'entity', targetResourceIds: [ids.zetaEntity], sourceCardinality: 'one', targetIsUnique: false,
      });
      await harness.relationshipRepository.replaceValues({
        sourceFieldId: ids.entityRelationField, sourceDomain: 'entity', sourceResourceId: ids.zetaEntity,
        targetDomain: 'entity', targetResourceIds: [ids.alphaEntity], sourceCardinality: 'one', targetIsUnique: false,
      });
      const alpha = await harness.entityRepository.findById(ids.alphaEntity);
      if (!alpha) throw new Error('Parity fixture entity is unavailable.');
      await harness.entityRepository.softDelete(ids.alphaEntity, ids.actor, alpha.rowVersion, ids.deleteBatch);
      const service = new ResourceRelationshipService(
        harness.relationshipRepository, harness.typeDefinitionReader, harness.nodeRepository,
        harness.entityRepository, harness.nodeTypeRepository, harness.entityTypeRepository, harness.accessControlPort,
      );
      return Object.fromEntries(await service.hydratePayloads(ids.actor, [
        { sourceDomain: 'entity', sourceResourceId: ids.alphaEntity, sourceTypeId: ids.entityType, payload: { dependsOn: 'legacy-alpha' } },
        { sourceDomain: 'entity', sourceResourceId: ids.zetaEntity, sourceTypeId: ids.entityType, payload: { dependsOn: 'legacy-zeta' } },
      ]));
    };

    const postgresPayloads = await hydrate(postgres);
    const sqlitePayloads = await hydrate(sqlite);
    expect(postgresPayloads).toEqual(sqlitePayloads);
    expect(postgresPayloads).toEqual({
      [`entity:${ids.alphaEntity}`]: { dependsOn: ids.zetaEntity },
      [`entity:${ids.zetaEntity}`]: { dependsOn: null },
    });
  }, 30_000);
});
