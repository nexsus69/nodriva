import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { PgExecutor } from './PgExecutor.js';
import { RuntimeConfigurationPortPostgres } from './RuntimeConfigurationPortPostgres.js';
import { AccessControlPortPostgres } from './AccessControlPortPostgres.js';
import { NodeRepositoryPostgres } from './NodeRepositoryPostgres.js';
import { EntityRepositoryPostgres } from './EntityRepositoryPostgres.js';
import { Node } from '../../domain/models/Node.js';
import { Entity } from '../../domain/models/Entity.js';

describe('PostgreSQL Integration Tests', () => {
  let pool: pg.Pool;
  let executor: PgExecutor;
  let runtimeConfig: RuntimeConfigurationPortPostgres;
  let accessControl: AccessControlPortPostgres;
  let nodeRepo: NodeRepositoryPostgres;
  let entityRepo: EntityRepositoryPostgres;

  const testUserId = '00000000-0000-0000-0000-000000000200';
  const testNodeFolderTypeId = '00000000-0000-0000-0000-000000000300';
  const testEntityTypeCustomerId = '00000000-0000-0000-0000-000000000301';
  const rootNodeId = '00000000-0000-0000-0000-000000000500';
  const childNodeId = '00000000-0000-0000-0000-000000000501';

  beforeAll(async () => {
    // Connetti al DB reale configurato in docker-compose
    pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL || 'postgresql://postgres:masterpass@localhost:5433/dashboard',
    });
    executor = new PgExecutor(pool);
    runtimeConfig = new RuntimeConfigurationPortPostgres(executor);
    accessControl = new AccessControlPortPostgres(executor);
    nodeRepo = new NodeRepositoryPostgres(executor);
    entityRepo = new EntityRepositoryPostgres(executor);

    // Esegui una query semplice per testare la connettività
    try {
      await executor.query('SELECT 1');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn('Connessione al database non disponibile. Saltando i test di integrazione.', message);
      throw err;
    }

    // Pulisci prima i nodi che potrebbero riferirsi al node type dalle corse precedenti
    await executor.query('DELETE FROM entities WHERE parent_node_id IN ($1, $2)', [rootNodeId, childNodeId]);
    await executor.query('DELETE FROM nodes WHERE id IN ($1, $2)', [rootNodeId, childNodeId]);

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
    await executor.query("DROP TABLE IF EXISTS entity_integration_customer_info CASCADE");

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

    await executor.query(`
      CREATE TABLE entity_integration_customer_info (
        entity_id UUID PRIMARY KEY REFERENCES entities(id) ON DELETE CASCADE,
        email VARCHAR(255) NOT NULL,
        phone VARCHAR(100) NOT NULL
      )
    `);
  });

  afterAll(async () => {
    // Ripulisci i record di supporto
    try {
      await executor.query('DELETE FROM user_roles WHERE user_id = $1', [testUserId]);
      await executor.query('DELETE FROM users WHERE id = $1', [testUserId]);
      await executor.query('DELETE FROM node_types WHERE id = $1', [testNodeFolderTypeId]);
      await executor.query("DELETE FROM entity_type_fields WHERE entity_type_id = $1", [testEntityTypeCustomerId]);
      await executor.query("DELETE FROM entity_types WHERE id = $1", [testEntityTypeCustomerId]);
      await executor.query("DROP TABLE IF EXISTS entity_integration_customer_info CASCADE");
    } catch {}
    if (pool) {
      await pool.end();
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

  describe('NodeRepositoryPostgres (Node CRUD)', () => {
    beforeAll(async () => {
      await executor.query('DELETE FROM entities WHERE parent_node_id IN ($1, $2)', [rootNodeId, childNodeId]);
      await executor.query('DELETE FROM nodes WHERE id IN ($1, $2)', [rootNodeId, childNodeId]);
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
      await entityRepo.softDelete(entityId, testUserId);
      const deletedEntity = await entityRepo.findById(entityId);
      expect(deletedEntity).toBeNull();
    });
  });
});
