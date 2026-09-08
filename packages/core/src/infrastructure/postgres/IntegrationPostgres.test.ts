/** Exercises PostgreSQL adapters against the dedicated integration database. */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { PgExecutor } from './PgExecutor.js';
import { RuntimeConfigurationPortPostgres } from './RuntimeConfigurationPortPostgres.js';
import { AccessControlPortPostgres } from './AccessControlPortPostgres.js';
import { NodeRepositoryPostgres } from './NodeRepositoryPostgres.js';
import { EntityRepositoryPostgres } from './EntityRepositoryPostgres.js';
import { RealtimeOutboxPostgres } from './RealtimeOutboxPostgres.js';
import { AccountActionDeliveryOutboxPostgres } from './AccountActionDeliveryOutboxPostgres.js';
import { AttachmentCleanupPortPostgres } from './AttachmentCleanupPortPostgres.js';
import { StorageTableManagementPostgres } from './StorageTableManagementPostgres.js';
import { SessionRepositoryPostgres } from './SessionRepositoryPostgres.js';
import { Node } from '../../domain/models/Node.js';
import { Entity } from '../../domain/models/Entity.js';
import { LockConflictError } from '../../domain/errors/ApplicationErrors.js';
import { RowVersionMismatchError } from '../../domain/errors/DomainErrors.js';

const integrationDatabaseUrl = process.env.INTEGRATION_DATABASE_URL;
const integrationDatabaseName = integrationDatabaseUrl
  ? new URL(integrationDatabaseUrl).pathname.slice(1)
  : '';
const describeIntegration = integrationDatabaseUrl && /(?:^|_)test(?:_|$)/.test(integrationDatabaseName)
  ? describe
  : describe.skip;

describeIntegration('PostgreSQL Integration Tests', () => {
  let pool: pg.Pool;
  let executor: PgExecutor;
  let runtimeConfig: RuntimeConfigurationPortPostgres;
  let accessControl: AccessControlPortPostgres;
  let nodeRepo: NodeRepositoryPostgres;
  let entityRepo: EntityRepositoryPostgres;
  let realtimeOutbox: RealtimeOutboxPostgres;
  let accountActionOutbox: AccountActionDeliveryOutboxPostgres;
  let attachmentCleanupOutbox: AttachmentCleanupPortPostgres;
  let storageTableManager: StorageTableManagementPostgres;
  let sessionRepo: SessionRepositoryPostgres;
  let adminPool: pg.Pool | undefined;
  let adminExecutor: PgExecutor | undefined;

  const testUserId = '00000000-0000-0000-0000-000000000200';
  const testNodeFolderTypeId = '00000000-0000-0000-0000-000000000300';
  const testEntityTypeCustomerId = '00000000-0000-0000-0000-000000000301';
  const rootNodeId = '00000000-0000-0000-0000-000000000500';
  const childNodeId = '00000000-0000-0000-0000-000000000501';
  const moveRootNodeId = '00000000-0000-0000-0000-000000000502';
  const moveChildNodeId = '00000000-0000-0000-0000-000000000503';
  const moveTargetNodeId = '00000000-0000-0000-0000-000000000504';
  const lockRootNodeId = '00000000-0000-0000-0000-000000000505';
  const lockChildNodeId = '00000000-0000-0000-0000-000000000506';
  const managedNodeIds = [rootNodeId, childNodeId, moveRootNodeId, moveChildNodeId, moveTargetNodeId, lockRootNodeId, lockChildNodeId];

  beforeAll(async () => {
    pool = new pg.Pool({
      connectionString: integrationDatabaseUrl,
    });
    executor = new PgExecutor(pool);
    runtimeConfig = new RuntimeConfigurationPortPostgres(executor);
    accessControl = new AccessControlPortPostgres(executor);
    nodeRepo = new NodeRepositoryPostgres(executor);
    entityRepo = new EntityRepositoryPostgres(executor);
    realtimeOutbox = new RealtimeOutboxPostgres(executor);
    accountActionOutbox = new AccountActionDeliveryOutboxPostgres(executor);
    attachmentCleanupOutbox = new AttachmentCleanupPortPostgres(executor);
    storageTableManager = new StorageTableManagementPostgres(executor);
    sessionRepo = new SessionRepositoryPostgres(executor);
    const adminDatabaseUrl = process.env.INTEGRATION_DATABASE_ADMIN_URL;
    if (adminDatabaseUrl) {
      adminPool = new pg.Pool({ connectionString: adminDatabaseUrl });
      adminExecutor = new PgExecutor(adminPool);
    }

    // Esegui una query semplice per testare la connettività
    try {
      await executor.query('SELECT 1');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn('Connessione al database non disponibile. Saltando i test di integrazione.', message);
      throw err;
    }

    // Pulisci prima i nodi che potrebbero riferirsi al node type dalle corse precedenti
    await executor.query('DELETE FROM locks WHERE resource_id = ANY($1::text[])', [managedNodeIds]);
    await executor.query('DELETE FROM entities WHERE parent_node_id = ANY($1::uuid[])', [managedNodeIds]);
    await executor.query('DELETE FROM nodes WHERE id = ANY($1::uuid[])', [managedNodeIds]);

    // Inizializza i record di supporto comuni (User, Tipi)
    await executor.query('DELETE FROM user_roles WHERE user_id = $1', [testUserId]);
    await executor.query('DELETE FROM users WHERE id = $1', [testUserId]);
    await executor.query('DELETE FROM node_types WHERE id = $1', [testNodeFolderTypeId]);
    
    await executor.query(`
      INSERT INTO users (id, email, password_hash, is_active)
      VALUES ($1, 'integration.runner@mate.com', 'scrypt', true)
    `, [testUserId]);

    await executor.query(`
      INSERT INTO node_types (id, type_key, name, description)
      VALUES ($1, 'integration-folder', 'Integration Folder', 'Folder')
    `, [testNodeFolderTypeId]);

    // Controlla o crea il tipo entità 'customer-info' con la tabella fisica associata
    await executor.query("DELETE FROM entity_type_fields WHERE entity_type_id = $1", [testEntityTypeCustomerId]);
    await executor.query("DELETE FROM entity_types WHERE id = $1", [testEntityTypeCustomerId]);
    await adminExecutor?.query("DROP TABLE IF EXISTS entity_integration_customer_info CASCADE");

    await executor.query(`
      INSERT INTO entity_types (id, type_key, name, description, storage_table)
      VALUES ($1, 'integration-customer', 'Integration Customer', 'Customer Profile', 'entity_integration_customer_info')
    `, [testEntityTypeCustomerId]);

    await executor.query(`
      INSERT INTO entity_type_fields (id, entity_type_id, field_key, label, column_name, data_type, is_required, position)
      VALUES 
        (gen_random_uuid(), $1, 'email', 'Email Address', 'email', 'string', true, 1),
        (gen_random_uuid(), $1, 'phone', 'Phone Number', 'phone', 'string', true, 2)
    `, [testEntityTypeCustomerId]);

    const storageExists = await executor.query<{ exists: boolean }>(
      "SELECT to_regclass('public.entity_integration_customer_info') IS NOT NULL AS exists",
    );
    if (!storageExists.rows[0]?.exists) {
      await storageTableManager.createStorageTable('entity_integration_customer_info');
      await storageTableManager.addColumn('entity_integration_customer_info', 'email', 'string', true, false, null);
      await storageTableManager.addColumn('entity_integration_customer_info', 'phone', 'string', true, false, null);
    }
  });

  afterAll(async () => {
    // Ripulisci i record di supporto
    try {
      await executor.query('DELETE FROM user_roles WHERE user_id = $1', [testUserId]);
      await executor.query('DELETE FROM locks WHERE resource_id = ANY($1::text[])', [managedNodeIds]);
      await executor.query('DELETE FROM entities WHERE parent_node_id = ANY($1::uuid[])', [managedNodeIds]);
      await executor.query('DELETE FROM nodes WHERE id = ANY($1::uuid[])', [managedNodeIds]);
      await executor.query('DELETE FROM users WHERE id = $1', [testUserId]);
      await executor.query('DELETE FROM node_types WHERE id = $1', [testNodeFolderTypeId]);
      await executor.query("DELETE FROM entity_type_fields WHERE entity_type_id = $1", [testEntityTypeCustomerId]);
      await executor.query("DELETE FROM entity_types WHERE id = $1", [testEntityTypeCustomerId]);
      await adminExecutor?.query("DROP TABLE IF EXISTS entity_integration_customer_info CASCADE");
    } catch {
      // Cleanup is best-effort when the integration database is unavailable.
    }
    if (pool) {
      await pool.end();
    }
    if (adminPool) {
      await adminPool.end();
    }
  });

  describe('RuntimeConfigurationPortPostgres (Capability Check)', () => {
    const capId = '00000000-0000-0000-0000-000000000100';
    const capKey = 'test_integration_capability';

    beforeAll(async () => {
      await executor.query('DELETE FROM runtime_capability_overrides WHERE capability_id = $1', [capId]);
      await executor.query('DELETE FROM runtime_capabilities WHERE id = $1', [capId]);
    });

    afterAll(async () => {
      await executor.query('DELETE FROM runtime_capability_overrides WHERE capability_id = $1', [capId]);
      await executor.query('DELETE FROM runtime_capabilities WHERE id = $1', [capId]);
    });

    it('should correctly query active capabilities from the database schema', async () => {
      await executor.query(`
        INSERT INTO runtime_capabilities (id, capability_key, name, default_status, description, is_system)
        VALUES ($1, $2, 'Test Cap', 'enabled'::capability_status_enum, 'Description', true)
      `, [capId, capKey]);

      const isEnabled = await runtimeConfig.isCapabilityEnabled(capKey);
      expect(isEnabled).toBe(true);

      await executor.query(`
        INSERT INTO runtime_capability_overrides (id, capability_id, scope_key, status)
        VALUES (gen_random_uuid(), $1, 'single-user', 'disabled'::capability_status_enum)
      `, [capId]);

      const isEnabledAfterOverride = await runtimeConfig.isCapabilityEnabled(capKey);
      expect(isEnabledAfterOverride).toBe(false);
    });
  });

  describe('AccessControlPortPostgres (ACL / Permissions)', () => {
    const testRoleId = '00000000-0000-0000-0000-000000000201';
    const testPermissionId = '00000000-0000-0000-0000-000000000202';
    const testPermissionName = 'node.test_integration';

    beforeAll(async () => {
      await executor.query('DELETE FROM role_permissions WHERE role_id = $1', [testRoleId]);
      await executor.query('DELETE FROM roles WHERE id = $1', [testRoleId]);
      await executor.query('DELETE FROM permissions WHERE id = $1', [testPermissionId]);

      await executor.query(`
        INSERT INTO permissions (id, permission_key, name, description, resource_kind)
        VALUES ($1, $2, $2, 'Test Desc', 'node'::resource_kind_enum)
      `, [testPermissionId, testPermissionName]);

      await executor.query(`
        INSERT INTO roles (id, role_key, name, description)
        VALUES ($1, 'test_role', 'Test Role', 'Desc')
      `, [testRoleId]);
    });

    it('should assert permissions correctly mapping user, roles and permissions in real database', async () => {
      await expect(
        accessControl.assertCanCreateNode(testUserId, null, 'order-record')
      ).rejects.toThrow();

      let nodeCreatePermId = '';
      const existingPermRes = await executor.query<{ id: string }>(
        "SELECT id FROM permissions WHERE permission_key = 'node.create' OR name = 'node.create'"
      );
      if (existingPermRes.rows.length > 0) {
        nodeCreatePermId = existingPermRes.rows[0]!.id;
        await executor.query(
          "UPDATE permissions SET name = 'node.create' WHERE id = $1",
          [nodeCreatePermId]
        );
      } else {
        nodeCreatePermId = '00000000-0000-0000-0000-000000000203';
        await executor.query(`
          INSERT INTO permissions (id, permission_key, name, description, resource_kind)
          VALUES ($1, 'node.create', 'node.create', 'Create Node', 'node'::resource_kind_enum)
        `, [nodeCreatePermId]);
      }

      await executor.query(`
        INSERT INTO role_permissions (role_id, permission_id)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
      `, [testRoleId, nodeCreatePermId]);

      await executor.query(`
        INSERT INTO user_roles (user_id, role_id)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
      `, [testUserId, testRoleId]);

      await expect(
        accessControl.assertCanCreateNode(testUserId, null, 'order-record')
      ).resolves.not.toThrow();

      await executor.query('DELETE FROM role_permissions WHERE role_id = $1 AND permission_id = $2', [testRoleId, nodeCreatePermId]);
      if (existingPermRes.rows.length === 0) {
        await executor.query('DELETE FROM permissions WHERE id = $1', [nodeCreatePermId]);
      }
    });
  });

  describe('Realtime outbox replay', () => {
    const eventId = '00000000-0000-0000-0000-000000000777';
    const workerId = 'integration-replay-worker';

    beforeAll(async () => {
      await executor.query('DELETE FROM realtime_event_outbox WHERE event_id = $1', [eventId]);
    });

    afterAll(async () => {
      await executor.query('DELETE FROM realtime_event_outbox WHERE event_id = $1', [eventId]);
    });

    it('releases a failed delivery for a later worker replay and marks it published', async () => {
      await realtimeOutbox.enqueue({
        eventId, occurredAt: new Date().toISOString(), resourceType: 'node', resourceId: rootNodeId,
        changeType: 'updated', actorUserId: testUserId, scopeNodeIds: [rootNodeId], directScopeNodeIds: [rootNodeId],
      });
      await executor.query("UPDATE realtime_event_outbox SET created_at = '-infinity'::timestamptz WHERE event_id = $1", [eventId]);
      const claimed = await realtimeOutbox.claimPending(workerId, 1);
      expect(claimed.map((event) => event.eventId)).toContain(eventId);

      await realtimeOutbox.markFailed(eventId, workerId, 'simulated Pusher outage');
      const failed = await executor.query<{ attempts: number; locked_at: Date | null; published_at: Date | null }>(
        'SELECT attempts, locked_at, published_at FROM realtime_event_outbox WHERE event_id = $1', [eventId]
      );
      expect(failed.rows[0]).toMatchObject({ attempts: 1, locked_at: null, published_at: null });

      await executor.query('UPDATE realtime_event_outbox SET next_attempt_at = now() WHERE event_id = $1', [eventId]);
      const replayed = await realtimeOutbox.claimPending('integration-replay-worker-2', 1);
      expect(replayed.map((event) => event.eventId)).toContain(eventId);
      await realtimeOutbox.markPublished(eventId, 'integration-replay-worker-2');

      const published = await executor.query<{ published_at: Date | null; last_error: string | null }>(
        'SELECT published_at, last_error FROM realtime_event_outbox WHERE event_id = $1', [eventId]
      );
      expect(published.rows[0]?.published_at).not.toBeNull();
      expect(published.rows[0]?.last_error).toBeNull();
    });
  });

  describe('Account action delivery outbox parity', () => {
    const deliveryId = '00000000-0000-0000-0000-000000000778';

    beforeAll(async () => {
      await executor.query('DELETE FROM account_action_delivery_outbox WHERE id = $1', [deliveryId]);
    });

    afterAll(async () => {
      await executor.query('DELETE FROM account_action_delivery_outbox WHERE id = $1', [deliveryId]);
    });

    it('deduplicates, retries a leased ciphertext and clears it only after delivery like SQLite', async () => {
      const item = { id: deliveryId, email: 'person@example.test', purpose: 'password_reset' as const, tokenCiphertext: 'opaque-ciphertext', expiresAt: new Date(Date.now() + 60_000) };
      await accountActionOutbox.enqueue(item);
      await accountActionOutbox.enqueue(item);
      const inserted = await executor.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM account_action_delivery_outbox WHERE id = $1', [deliveryId]);
      expect(inserted.rows[0]?.count).toBe('1');

      await expect(accountActionOutbox.claimPending('account-worker-1', 1)).resolves.toEqual([expect.objectContaining(item)]);
      await accountActionOutbox.markFailed(deliveryId, 'account-worker-1', 'mail down');
      const failed = await executor.query<{ attempts: number; token_ciphertext: string; locked_by: string | null }>('SELECT attempts, token_ciphertext, locked_by FROM account_action_delivery_outbox WHERE id = $1', [deliveryId]);
      expect(failed.rows[0]).toEqual({ attempts: 1, token_ciphertext: 'opaque-ciphertext', locked_by: null });

      await executor.query('UPDATE account_action_delivery_outbox SET next_attempt_at = now() WHERE id = $1', [deliveryId]);
      await expect(accountActionOutbox.claimPending('account-worker-2', 1)).resolves.toEqual([expect.objectContaining(item)]);
      await accountActionOutbox.markDelivered(deliveryId, 'account-worker-2');
      const delivered = await executor.query<{ token_ciphertext: string; delivered_at: Date | null }>('SELECT token_ciphertext, delivered_at FROM account_action_delivery_outbox WHERE id = $1', [deliveryId]);
      expect(delivered.rows[0]).toEqual({ token_ciphertext: '', delivered_at: expect.any(Date) });
    });
  });

  describe('Attachment cleanup outbox parity', () => {
    const storageKey = 'integration/entity/orphan.bin';

    beforeAll(async () => {
      await executor.query('DELETE FROM attachment_cleanup_outbox WHERE storage_key = $1', [storageKey]);
    });

    afterAll(async () => {
      await executor.query('DELETE FROM attachment_cleanup_outbox WHERE storage_key = $1', [storageKey]);
    });

    it('deduplicates, leases, retries and completes cleanup like SQLite', async () => {
      await attachmentCleanupOutbox.schedule(storageKey, new Date());
      await attachmentCleanupOutbox.schedule(storageKey, new Date());
      await expect(attachmentCleanupOutbox.claimPending('attachment-worker-1', 1)).resolves.toEqual([{ storageKey }]);
      await expect(attachmentCleanupOutbox.claimPending('attachment-worker-2', 1)).resolves.toEqual([]);

      await attachmentCleanupOutbox.markFailed(storageKey, 'attachment-worker-1', 'disk busy');
      const failed = await executor.query<{ attempts: number; locked_by: string | null }>(
        'SELECT attempts,locked_by FROM attachment_cleanup_outbox WHERE storage_key=$1',
        [storageKey],
      );
      expect(failed.rows[0]).toEqual({ attempts: 1, locked_by: null });

      await executor.query('UPDATE attachment_cleanup_outbox SET next_attempt_at=now() WHERE storage_key=$1', [storageKey]);
      await expect(attachmentCleanupOutbox.claimPending('attachment-worker-2', 1)).resolves.toEqual([{ storageKey }]);
      await attachmentCleanupOutbox.markCompleted(storageKey, 'attachment-worker-2');
      await expect(executor.query('SELECT 1 FROM attachment_cleanup_outbox WHERE storage_key=$1', [storageKey]))
        .resolves.toMatchObject({ rowCount: 0 });
    });
  });

  describe('NodeRepositoryPostgres (Node CRUD)', () => {
    beforeAll(async () => {
      await executor.query('DELETE FROM locks WHERE resource_id = ANY($1::text[])', [managedNodeIds]);
      await executor.query('DELETE FROM entities WHERE parent_node_id = ANY($1::uuid[])', [managedNodeIds]);
      await executor.query('DELETE FROM nodes WHERE id = ANY($1::uuid[])', [managedNodeIds]);
    });

    it('should support full Node lifecycle (Create, Find, Update, Move, Descendant check)', async () => {
      // 1. Create Root Node
      const rootNode = new Node(
        rootNodeId,
        null,
        'root_integration',
        'root_integration',
        0,
        testNodeFolderTypeId,
        'Root Integration',
        'Root test folder',
        1,
        new Date(),
        new Date(),
        null,
        testUserId,
        testUserId
      );
      await nodeRepo.create(rootNode);

      // Verify Find By ID
      const foundRoot = await nodeRepo.findById(rootNodeId);
      expect(foundRoot).not.toBeNull();
      expect(foundRoot!.name).toBe('Root Integration');
      expect(foundRoot!.path).toBe('root_integration');

      // 2. Create Child Node
      const childNode = new Node(
        childNodeId,
        rootNodeId,
        'root_integration.child_integration',
        'child_integration',
        1,
        testNodeFolderTypeId,
        'Child Integration',
        'Child test node',
        1,
        new Date(),
        new Date(),
        null,
        testUserId,
        testUserId
      );
      await nodeRepo.create(childNode);

      // Verify List Children
      const children = await nodeRepo.listChildren(rootNodeId);
      expect(children.length).toBe(1);
      expect(children[0]!.id).toBe(childNodeId);

      const ancestorIds = await nodeRepo.listAncestorIds(childNodeId);
      expect(ancestorIds).toEqual([childNodeId, rootNodeId]);

      // Verify Descendant check
      const isDesc = await nodeRepo.isDescendantOf(childNodeId, rootNodeId);
      expect(isDesc).toBe(true);

      // 3. Update Node (with optimistic locking check)
      const updatedChild = new Node(
        childNodeId,
        rootNodeId,
        'root_integration.child_integration',
        'child_integration',
        1,
        testNodeFolderTypeId,
        'Child Integration Modified',
        'Child test node updated',
        2, // incremented version
        childNode.createdAt,
        new Date(),
        null,
        testUserId,
        testUserId
      );
      await nodeRepo.update(updatedChild);

      const foundUpdated = await nodeRepo.findById(childNodeId);
      expect(foundUpdated!.name).toBe('Child Integration Modified');
      expect(foundUpdated!.rowVersion).toBe(2);

      // Check duplicate path label detection
      const exists = await nodeRepo.existsByParentAndPathLabel(rootNodeId, 'child_integration');
      expect(exists).toBe(true);
    });

    it('moves a subtree only when the root rowVersion still matches', async () => {
      await nodeRepo.create(new Node(moveRootNodeId, null, 'f04_move_root', 'f04_move_root', 0, testNodeFolderTypeId, 'F04 Move Root', '', 1, new Date(), new Date(), null, testUserId, testUserId));
      await nodeRepo.create(new Node(moveChildNodeId, moveRootNodeId, 'f04_move_root.child', 'child', 1, testNodeFolderTypeId, 'F04 Move Child', '', 1, new Date(), new Date(), null, testUserId, testUserId));
      await nodeRepo.create(new Node(moveTargetNodeId, null, 'f04_move_target', 'f04_move_target', 0, testNodeFolderTypeId, 'F04 Move Target', '', 1, new Date(), new Date(), null, testUserId, testUserId));

      await expect(nodeRepo.moveSubtree(moveChildNodeId, moveTargetNodeId, testUserId, 99)).rejects.toBeInstanceOf(RowVersionMismatchError);
      expect((await nodeRepo.findById(moveChildNodeId))?.path).toBe('f04_move_root.child');

      await expect(nodeRepo.moveSubtree(moveChildNodeId, moveTargetNodeId, testUserId, 1)).resolves.toBeUndefined();
      expect((await nodeRepo.findById(moveChildNodeId))?.path).toBe('f04_move_target.child');
    });

    it('treats a different session of the same user as a subtree lock conflict', async () => {
      await nodeRepo.create(new Node(lockRootNodeId, null, 'f05_lock_root', 'f05_lock_root', 0, testNodeFolderTypeId, 'F05 Lock Root', '', 1, new Date(), new Date(), null, testUserId, testUserId));
      await nodeRepo.create(new Node(lockChildNodeId, lockRootNodeId, 'f05_lock_root.child', 'child', 1, testNodeFolderTypeId, 'F05 Lock Child', '', 1, new Date(), new Date(), null, testUserId, testUserId));
      await executor.query('DELETE FROM locks WHERE resource_id = $1', [lockChildNodeId]);
      const expiresAt = new Date(Date.now() + 5 * 60_000);
      const lockOwnerSessionId = await sessionRepo.createSession(testUserId, 'f05-owner-session-token', expiresAt);
      const lockOtherSessionId = await sessionRepo.createSession(testUserId, 'f05-other-session-token', expiresAt);
      await executor.query(
        `INSERT INTO locks (id, resource_type, resource_id, user_id, session_id, acquired_at, expires_at)
         VALUES (gen_random_uuid(), 'node', $1, $2, $3, now(), now() + interval '5 minutes')`,
        [lockChildNodeId, testUserId, lockOwnerSessionId],
      );

      await expect(nodeRepo.assertSubtreeUnlocked(lockRootNodeId, testUserId, lockOwnerSessionId)).resolves.toBeUndefined();
      await expect(nodeRepo.assertSubtreeUnlocked(lockRootNodeId, testUserId, lockOtherSessionId)).rejects.toBeInstanceOf(LockConflictError);
    });
  });

  describe('EntityRepositoryPostgres (Entity CRUD)', () => {
    const parentNodeId = '00000000-0000-0000-0000-000000000500';
    const entityId = '00000000-0000-0000-0000-000000000600';

    beforeAll(async () => {
      await executor.query('DELETE FROM entities WHERE id = $1', [entityId]);
    });

    it('should support full Entity lifecycle (Create, Find, Update, List, Soft Delete)', async () => {
      // 1. Create Entity with dynamic payload fields
      const entity = new Entity(
        entityId,
        testEntityTypeCustomerId,
        parentNodeId,
        'Jane Doe',
        'Integration Customer profile',
        1,
        new Date(),
        new Date(),
        null,
        testUserId,
        testUserId,
        {
          email: 'jane.doe@integration.com',
          phone: '+1 (555) 987-6543'
        }
      );
      await entityRepo.create(entity);

      // 2. Find Entity and verify join with physical table
      const foundEntity = await entityRepo.findById(entityId);
      expect(foundEntity).not.toBeNull();
      expect(foundEntity!.name).toBe('Jane Doe');
      expect(foundEntity!.payload.email).toBe('jane.doe@integration.com');
      expect(foundEntity!.payload.phone).toBe('+1 (555) 987-6543');

      // 3. Update Entity
      const updatedEntity = new Entity(
        entityId,
        testEntityTypeCustomerId,
        parentNodeId,
        'Jane Doe Updated',
        'Integration Customer profile description',
        2,
        entity.createdAt,
        new Date(),
        null,
        testUserId,
        testUserId,
        {
          email: 'jane.doe.updated@integration.com',
          phone: '+1 (555) 000-0000'
        }
      );
      await entityRepo.update(updatedEntity);

      const foundUpdated = await entityRepo.findById(entityId);
      expect(foundUpdated!.name).toBe('Jane Doe Updated');
      expect(foundUpdated!.payload.email).toBe('jane.doe.updated@integration.com');
      expect(foundUpdated!.payload.phone).toBe('+1 (555) 000-0000');

      // 4. List by parent node
      const list = await entityRepo.listByNode(parentNodeId);
      expect(list.length).toBeGreaterThanOrEqual(1);
      const listMatch = list.find(e => e.id === entityId);
      expect(listMatch).toBeDefined();
      expect(listMatch!.payload.email).toBe('jane.doe.updated@integration.com');

      // 5. Soft Delete
      await entityRepo.softDelete(entityId, testUserId, 2, '00000000-0000-0000-0000-000000000001');
      const deletedEntity = await entityRepo.findById(entityId);
      expect(deletedEntity).toBeNull();
    });
  });
});
