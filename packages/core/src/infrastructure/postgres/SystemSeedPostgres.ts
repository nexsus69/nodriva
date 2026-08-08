import crypto from 'crypto';
import { PasswordHasher } from '../../domain/policies/PasswordHasher.js';
import { SystemSeedPort } from '../../application/ports/SystemSeedPort.js';
import { TransactionPort } from '../../application/ports/TransactionPort.js';
import { PgExecutor } from './PgExecutor.js';

export class SystemSeedPostgres implements SystemSeedPort {
  constructor(
    private readonly executor: PgExecutor,
    private readonly transactionPort: TransactionPort,
    private readonly seedAdminPassword?: string
  ) {}

  async checkSeeded(): Promise<boolean> {
    try {
      const resPerm = await this.executor.query(
        "SELECT 1 FROM permissions WHERE name = 'node.create'"
      );
      const resCap = await this.executor.query(
        "SELECT 1 FROM runtime_capabilities WHERE capability_key = 'hierarchical_structure'"
      );
      return resPerm.rows.length > 0 && resCap.rows.length > 0;
    } catch (err) {
      console.error('Check seed error:', err);
      return false;
    }
  }

  async seedDatabase(): Promise<void> {
    if (!this.seedAdminPassword) {
      throw new Error('SEED_ADMIN_PASSWORD must be configured before seeding the database.');
    }
    await this.transactionPort.runInTransaction(() => this.seedDatabaseInTransaction());
  }

  private async seedDatabaseInTransaction(): Promise<void> {
    const actorId = '00000000-0000-0000-0000-000000000001';

    // Eseguiamo la pulizia delle tabelle per ripartire da uno stato noto ed allineato
    await this.executor.query("DELETE FROM node_scope_assignments");
    await this.executor.query("DELETE FROM user_roles");
    await this.executor.query("DELETE FROM role_permissions");
    await this.executor.query("DELETE FROM roles");
    await this.executor.query("DELETE FROM permissions");
    await this.executor.query("DELETE FROM users WHERE id = $1", [actorId]);

    // 1. Inserimento Utente Olivia Williams (Super Admin)
    const hash = PasswordHasher.hash(this.seedAdminPassword!);
    await this.executor.query(`
      INSERT INTO users (id, email, password_hash, is_active, is_super_admin)
      VALUES ($1, 'olivia.williams@mate.com', $2, true, true)
    `, [actorId, hash]);

    // 2. Inserimento Ruoli e Permessi
    const adminRoleId = '00000000-0000-0000-0000-000000000002';
    await this.executor.query(`
      INSERT INTO roles (id, role_key, name, description, is_system, row_version)
      VALUES ($1, 'admin', 'admin', 'Administrator Role', true, 1)
    `, [adminRoleId]);

    const permissionsList = [
      { key: 'audit.access', name: 'Access Audit Logs', kind: 'system_setting' },
      { key: 'node.create', name: 'Create Node', kind: 'node' },
      { key: 'node.move', name: 'Move Node', kind: 'node' },
      { key: 'node.edit', name: 'Edit Node', kind: 'node' },
      { key: 'node.read', name: 'Read Nodes', kind: 'node' },
      { key: 'node.test_integration', name: 'Test Node Integration', kind: 'node' },
      { key: 'entity.create', name: 'Create Entity', kind: 'entity' },
      { key: 'entity.read', name: 'Read Entities', kind: 'entity' },
      { key: 'entity.edit', name: 'Edit Entity', kind: 'entity' },
      { key: 'entity.delete', name: 'Delete Entity', kind: 'entity' },
      { key: 'entity.move', name: 'Move Entity', kind: 'entity' },
      { key: 'entity_type.read', name: 'Read Entity Types', kind: 'entity_type' },
      { key: 'node_type.create', name: 'Create Node Type', kind: 'node_type' },
      { key: 'node_type.update', name: 'Update Node Type', kind: 'node_type' },
      { key: 'node_type.delete', name: 'Delete Node Type', kind: 'node_type' },
      { key: 'node_type.read', name: 'Read Node Types', kind: 'node_type' },
      { key: 'entity_type.create', name: 'Create Entity Type', kind: 'entity_type' },
      { key: 'entity_type.update', name: 'Update Entity Type', kind: 'entity_type' },
      { key: 'entity_type.delete', name: 'Delete Entity Type', kind: 'entity_type' },
      { key: 'user.create', name: 'Create User', kind: 'user' },
      { key: 'user.update', name: 'Update User', kind: 'user' },
      { key: 'user.delete', name: 'Delete User', kind: 'user' },
      { key: 'user.assign_roles', name: 'Assign User Roles', kind: 'user' },
      { key: 'user.read', name: 'Read Users', kind: 'user' },
      { key: 'role.create', name: 'Create Role', kind: 'role' },
      { key: 'role.update', name: 'Update Role', kind: 'role' },
      { key: 'role.delete', name: 'Delete Role', kind: 'role' },
      { key: 'role.read', name: 'Read Roles', kind: 'role' },
      { key: 'scope.assign', name: 'Assign Scope', kind: 'permission' },
      { key: 'scope.delete', name: 'Delete Scope', kind: 'permission' },
      { key: 'scope.read', name: 'Read Scope Assignments', kind: 'permission' },
      { key: 'system.config', name: 'System Configuration', kind: 'system_setting' },
      { key: 'system.config.read', name: 'Read System Configuration', kind: 'system_setting' }
    ];

    for (const p of permissionsList) {
      await this.executor.query(`
        INSERT INTO permissions (id, permission_key, name, description, resource_kind)
        VALUES ($1, $2, $3, $4, $5::resource_kind_enum)
      `, [crypto.randomUUID(), p.key, p.key, `Allow ${p.name}`, p.kind]);
    }

    // Associa tutti i permessi al ruolo admin
    await this.executor.query(`
      INSERT INTO role_permissions (role_id, permission_id)
      SELECT $1, id FROM permissions
    `, [adminRoleId]);

    const defaultReaderRoleId = '00000000-0000-0000-0000-000000000003';
    await this.executor.query(`
      INSERT INTO roles (id, role_key, name, description, is_system, row_version)
      VALUES ($1, 'default_reader', 'Default Reader', 'Base read permissions; data access remains scope-bound.', true, 1)
    `, [defaultReaderRoleId]);
    await this.executor.query(`
      INSERT INTO role_permissions (role_id, permission_id)
      SELECT $1, id FROM permissions
      WHERE permission_key IN ('node_type.read', 'entity_type.read')
    `, [defaultReaderRoleId]);

    const scopedReaderRoleId = '00000000-0000-0000-0000-000000000004';
    await this.executor.query(`
      INSERT INTO roles (id, role_key, name, description, is_system, row_version)
      VALUES ($1, 'scoped_reader', 'Scoped Reader', 'Read nodes and entities only within assigned scopes.', true, 1)
    `, [scopedReaderRoleId]);
    await this.executor.query(`
      INSERT INTO role_permissions (role_id, permission_id)
      SELECT $1, id FROM permissions
      WHERE permission_key IN ('node.read', 'entity.read')
    `, [scopedReaderRoleId]);

    // Associa l'utente Olivia Williams al ruolo admin
    await this.executor.query(`
      INSERT INTO user_roles (user_id, role_id)
      VALUES ($1, $2)
    `, [actorId, adminRoleId]);

    // 3. Pulisci nodi ed entità per evitare conflitti
    await this.executor.query("DELETE FROM entities");
    await this.executor.query("DELETE FROM nodes");
    await this.executor.query("DELETE FROM entity_type_fields");
    await this.executor.query("DELETE FROM entity_types");
    await this.executor.query("DELETE FROM node_type_fields");
    await this.executor.query("DELETE FROM node_types");

    // 4. Inserimento Tipi di Nodo (NodeTypes) con UUID statici
    const nodeTypeFolderId = '00000000-0000-0000-0000-000000000011';
    const nodeTypeOrderId = '00000000-0000-0000-0000-000000000012';

    await this.executor.query(`
      INSERT INTO node_types (id, type_key, name, description, current_schema_version)
      VALUES ($1, 'order-folder', 'Orders Folder', 'Folder containing sales orders', 1)
    `, [nodeTypeFolderId]);

    await this.executor.query(`
      INSERT INTO node_types (id, type_key, name, description, current_schema_version)
      VALUES ($1, 'order-record', 'Order Record', 'Individual sales order node', 1)
    `, [nodeTypeOrderId]);

    // 5. Inserimento Tipi di Entità (EntityTypes) con UUID statici
    const entityTypeCustomerId = '00000000-0000-0000-0000-000000000013';
    const entityTypeOrderItemId = '00000000-0000-0000-0000-000000000014';

    await this.executor.query("DROP TABLE IF EXISTS entity_customer_info CASCADE");
    await this.executor.query("DROP TABLE IF EXISTS entity_order_item CASCADE");

    await this.executor.query(`
      INSERT INTO entity_types (id, type_key, name, description, storage_table, current_schema_version)
      VALUES ($1, 'customer-info', 'Customer Info', 'Detailed customer profile', 'entity_customer_info', 1)
    `, [entityTypeCustomerId]);

    await this.executor.query(`
      INSERT INTO entity_types (id, type_key, name, description, storage_table, current_schema_version)
      VALUES ($1, 'order-item', 'Order Item', 'Products inside the order', 'entity_order_item', 1)
    `, [entityTypeOrderItemId]);

    // Campi per Customer Info
    await this.executor.query(`
      INSERT INTO entity_type_fields (id, entity_type_id, field_key, label, column_name, data_type, is_required, position)
      VALUES 
        (gen_random_uuid(), $1, 'email', 'Email Address', 'email', 'string', true, 1),
        (gen_random_uuid(), $1, 'phone', 'Phone Number', 'phone', 'string', true, 2),
        (gen_random_uuid(), $1, 'address', 'Delivery Address', 'address', 'string', false, 3)
    `, [entityTypeCustomerId]);

    // Campi per Order Item
    await this.executor.query(`
      INSERT INTO entity_type_fields (id, entity_type_id, field_key, label, column_name, data_type, is_required, position)
      VALUES 
        (gen_random_uuid(), $1, 'product_name', 'Product Name', 'product_name', 'string', true, 1),
        (gen_random_uuid(), $1, 'quantity', 'Quantity', 'quantity', 'integer', true, 2),
        (gen_random_uuid(), $1, 'unit_price', 'Unit Price', 'unit_price', 'number', true, 3)
    `, [entityTypeOrderItemId]);

    // Crea le tabelle fisiche a database per supportare l'architettura
    await this.executor.query(`
      CREATE TABLE entity_customer_info (
        entity_id UUID PRIMARY KEY REFERENCES entities(id) ON DELETE CASCADE,
        email VARCHAR(255) NOT NULL,
        phone VARCHAR(100) NOT NULL,
        address TEXT
      )
    `);

    await this.executor.query(`
      CREATE TABLE entity_order_item (
        entity_id UUID PRIMARY KEY REFERENCES entities(id) ON DELETE CASCADE,
        product_name VARCHAR(255) NOT NULL,
        quantity INTEGER NOT NULL,
        unit_price NUMERIC(10, 2) NOT NULL
      )
    `);

    // 6. Inserimento Nodi Gerarchici con UUID statico
    const rootNodeId = '00000000-0000-0000-0000-000000000015';

    await this.executor.query(`
      INSERT INTO nodes (id, parent_id, path, path_label, depth, node_type_id, name, description, row_version, created_by, updated_by)
      VALUES ($1, null, 'orders', 'orders', 0, $2, 'Orders', 'All system orders', 1, $3, $3)
    `, [rootNodeId, nodeTypeFolderId, actorId]);

    const orderList = [
      { id: '00000000-0000-0000-0000-000000000021', code: '#192541', customer: 'Esther Howard', total: '$3,127.00', date: 'Jun 19', status: 'Paid', type: 'Shipping' },
      { id: '00000000-0000-0000-0000-000000000022', code: '#192540', customer: 'David Miller', total: '$158.00', date: 'Jun 19', status: 'Paid', type: 'Pickups' },
      { id: '00000000-0000-0000-0000-000000000023', code: '#192539', customer: 'James Moore', total: '$1,927.89', date: 'Jun 18', status: 'Paid', type: 'Shipping' },
      { id: '00000000-0000-0000-0000-000000000024', code: '#192538', customer: 'Robert Anderson', total: '$1,528.60', date: 'Jun 18', status: 'Paid', type: 'Shipping' },
      { id: '00000000-0000-0000-0000-000000000025', code: '#192537', customer: 'Jessica Martinez', total: '$158.00', date: 'Jun 18', status: 'Refunded', type: 'Shipping' }
    ];

    for (const ord of orderList) {
      const idx = orderList.indexOf(ord);
      const label = ord.code.replace('#', 'o');
      const path = `orders.${label}`;

      await this.executor.query(`
        INSERT INTO nodes (id, parent_id, path, path_label, depth, node_type_id, name, description, row_version, created_by, updated_by)
        VALUES ($1, $2, $3, $4, 1, $5, $6, $7, 1, $8, $8)
      `, [ord.id, rootNodeId, path, label, nodeTypeOrderId, ord.code, `Order by ${ord.customer}`, actorId]);

      const entityCustId = `00000000-0000-0000-0000-00000000003${idx + 1}`;
      await this.executor.query(`
        INSERT INTO entities (id, entity_type_id, parent_node_id, name, description, row_version, created_by, updated_by)
        VALUES ($1, $2, $3, $4, $5, 1, $6, $6)
      `, [entityCustId, entityTypeCustomerId, ord.id, ord.customer, `Profile details for order ${ord.code}`, actorId]);

      const email = `${ord.customer.toLowerCase().replace(/ /g, '.')}@gmail.com`;
      const phone = ord.code === '#192539' ? '+1 (415) 555-2671' : '+1 (415) 555-1234';
      await this.executor.query(`
        INSERT INTO entity_customer_info (entity_id, email, phone, address)
        VALUES ($1, $2, $3, $4)
      `, [entityCustId, email, phone, '123 Sales St, Seattle, WA']);

      if (ord.code === '#192539') {
        const item1Id = '00000000-0000-0000-0000-000000000041';
        await this.executor.query(`
          INSERT INTO entities (id, entity_type_id, parent_node_id, name, description, row_version, created_by, updated_by)
          VALUES ($1, $2, $3, $4, $5, 1, $6, $6)
        `, [item1Id, entityTypeOrderItemId, ord.id, 'Stihl TS 800 cut-off machine', 'Cut-off machine incl. 5x diamond cutting discs', actorId]);
        await this.executor.query(`
          INSERT INTO entity_order_item (entity_id, product_name, quantity, unit_price)
          VALUES ($1, $2, $3, $4)
        `, [item1Id, 'Stihl TS 800 cut-off machine', 1, 1590.00]);

        const item2Id = '00000000-0000-0000-0000-000000000042';
        await this.executor.query(`
          INSERT INTO entities (id, entity_type_id, parent_node_id, name, description, row_version, created_by, updated_by)
          VALUES ($1, $2, $3, $4, $5, 1, $6, $6)
        `, [item2Id, entityTypeOrderItemId, ord.id, 'Gasoline generator EYG 7500I', 'Gasoline generator EYG 7500I (inverter)', actorId]);
        await this.executor.query(`
          INSERT INTO entity_order_item (entity_id, product_name, quantity, unit_price)
          VALUES ($1, $2, $3, $4)
        `, [item2Id, 'Gasoline generator EYG 7500I (inverter)', 1, 337.89]);
      }
    }

    // 7. Scenario demo operativo multi-team/multi-progetto.
    // Manteniamo il dominio ordini precedente come fixture compatibile, ma
    // aggiungiamo una struttura che esercita gerarchie, relazioni e campi
    // dinamici senza introdurre logica specifica nel frontend.
    const projectNodeTypes = [
      ['00000000-0000-0000-0000-000000000051', 'organization', 'Organization', 'Top-level organization'],
      ['00000000-0000-0000-0000-000000000052', 'division', 'Division', 'Organizational division'],
      ['00000000-0000-0000-0000-000000000053', 'team', 'Team', 'Delivery team'],
      ['00000000-0000-0000-0000-000000000054', 'project', 'Project', 'Project workspace'],
      ['00000000-0000-0000-0000-000000000055', 'milestone', 'Milestone', 'Project milestone'],
    ] as const;
    for (const [id, typeKey, name, description] of projectNodeTypes) {
      await this.executor.query(`
        INSERT INTO node_types (id, type_key, name, description, current_schema_version)
        VALUES ($1, $2, $3, $4, 1)
      `, [id, typeKey, name, description]);
    }

    const projectEntityTypes = [
      ['00000000-0000-0000-0000-000000000061', 'project-brief', 'Project Brief', 'Project metadata and ownership', 'entity_project_brief'],
      ['00000000-0000-0000-0000-000000000062', 'task-record', 'Task', 'Work item assigned to a team member', 'entity_task_record'],
      ['00000000-0000-0000-0000-000000000063', 'project-document', 'Project Document', 'Versioned project document', 'entity_project_document'],
    ] as const;
    for (const [id, typeKey, name, description, storageTable] of projectEntityTypes) {
      await this.executor.query(`
        INSERT INTO entity_types (id, type_key, name, description, storage_table, current_schema_version)
        VALUES ($1, $2, $3, $4, $5, 1)
      `, [id, typeKey, name, description, storageTable]);
    }

    await this.executor.query(`
      INSERT INTO entity_type_fields (id, entity_type_id, field_key, label, column_name, data_type, is_required, position)
      VALUES
        (gen_random_uuid(), '00000000-0000-0000-0000-000000000061', 'status', 'Status', 'status', 'string', true, 1),
        (gen_random_uuid(), '00000000-0000-0000-0000-000000000061', 'owner', 'Owner', 'owner', 'string', true, 2),
        (gen_random_uuid(), '00000000-0000-0000-0000-000000000061', 'client_name', 'Client', 'client_name', 'string', false, 3),
        (gen_random_uuid(), '00000000-0000-0000-0000-000000000061', 'start_date', 'Start date', 'start_date', 'date', false, 4),
        (gen_random_uuid(), '00000000-0000-0000-0000-000000000061', 'end_date', 'End date', 'end_date', 'date', false, 5),
        (gen_random_uuid(), '00000000-0000-0000-0000-000000000062', 'status', 'Status', 'status', 'string', true, 1),
        (gen_random_uuid(), '00000000-0000-0000-0000-000000000062', 'priority', 'Priority', 'priority', 'string', true, 2),
        (gen_random_uuid(), '00000000-0000-0000-0000-000000000062', 'assignee', 'Assignee', 'assignee', 'string', true, 3),
        (gen_random_uuid(), '00000000-0000-0000-0000-000000000062', 'due_date', 'Due date', 'due_date', 'date', false, 4),
        (gen_random_uuid(), '00000000-0000-0000-0000-000000000062', 'depends_on', 'Depends on', 'depends_on', 'relation', false, 5),
        (gen_random_uuid(), '00000000-0000-0000-0000-000000000063', 'document_type', 'Document type', 'document_type', 'string', true, 1),
        (gen_random_uuid(), '00000000-0000-0000-0000-000000000063', 'version', 'Version', 'version', 'integer', true, 2),
        (gen_random_uuid(), '00000000-0000-0000-0000-000000000063', 'review_status', 'Review status', 'review_status', 'string', true, 3)
    `);
    await this.executor.query(`
      UPDATE entity_type_fields
      SET relation_target_domain = 'entity', relation_target_type_key = 'task-record'
      WHERE entity_type_id = '00000000-0000-0000-0000-000000000062' AND field_key = 'depends_on'
    `);

    await this.executor.query(`
      DROP TABLE IF EXISTS entity_project_brief CASCADE;
      DROP TABLE IF EXISTS entity_task_record CASCADE;
      DROP TABLE IF EXISTS entity_project_document CASCADE;
      CREATE TABLE entity_project_brief (
        entity_id UUID PRIMARY KEY REFERENCES entities(id) ON DELETE CASCADE,
        status VARCHAR(64) NOT NULL,
        owner VARCHAR(255) NOT NULL,
        client_name VARCHAR(255),
        start_date DATE,
        end_date DATE
      );
      CREATE TABLE entity_task_record (
        entity_id UUID PRIMARY KEY REFERENCES entities(id) ON DELETE CASCADE,
        status VARCHAR(64) NOT NULL,
        priority VARCHAR(64) NOT NULL,
        assignee VARCHAR(255) NOT NULL,
        due_date DATE,
        depends_on UUID
      );
      CREATE TABLE entity_project_document (
        entity_id UUID PRIMARY KEY REFERENCES entities(id) ON DELETE CASCADE,
        document_type VARCHAR(128) NOT NULL,
        version INTEGER NOT NULL,
        review_status VARCHAR(64) NOT NULL
      );
    `);

    const demoNodes = [
      ['00000000-0000-0000-0000-000000000071', null, 'workspace', 'workspace', 0, '00000000-0000-0000-0000-000000000051', 'Acme Delivery Organization', 'Demo organization'],
      ['00000000-0000-0000-0000-000000000072', '00000000-0000-0000-0000-000000000071', 'workspace.platform', 'platform', 1, '00000000-0000-0000-0000-000000000052', 'Platform Division', 'Product and platform delivery'],
      ['00000000-0000-0000-0000-000000000073', '00000000-0000-0000-0000-000000000072', 'workspace.platform.core', 'core', 2, '00000000-0000-0000-0000-000000000053', 'Core Team', 'Core product team'],
      ['00000000-0000-0000-0000-000000000074', '00000000-0000-0000-0000-000000000073', 'workspace.platform.core.control-center', 'control-center', 3, '00000000-0000-0000-0000-000000000054', 'Control Center Project', 'Project management demo'],
      ['00000000-0000-0000-0000-000000000075', '00000000-0000-0000-0000-000000000074', 'workspace.platform.core.control-center.foundation', 'foundation', 4, '00000000-0000-0000-0000-000000000055', 'Foundation Milestone', 'Architecture foundation'],
      ['00000000-0000-0000-0000-000000000076', '00000000-0000-0000-0000-000000000073', 'workspace.platform.core.experience', 'experience', 3, '00000000-0000-0000-0000-000000000054', 'Experience Project', 'Responsive experience demo'],
      ['00000000-0000-0000-0000-000000000077', '00000000-0000-0000-0000-000000000076', 'workspace.platform.core.experience.mobile', 'mobile', 4, '00000000-0000-0000-0000-000000000055', 'Mobile Milestone', 'Mobile delivery milestone'],
    ] as const;
    for (const [id, parentId, path, pathLabel, depth, typeId, name, description] of demoNodes) {
      await this.executor.query(`
        INSERT INTO nodes (id, parent_id, path, path_label, depth, node_type_id, name, description, row_version, created_by, updated_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1, $9, $9)
      `, [id, parentId, path, pathLabel, depth, typeId, name, description, actorId]);
    }

    const projectBriefId = '00000000-0000-0000-0000-000000000081';
    await this.executor.query(`
      INSERT INTO entities (id, entity_type_id, parent_node_id, name, description, row_version, created_by, updated_by)
      VALUES ($1, '00000000-0000-0000-0000-000000000061', '00000000-0000-0000-0000-000000000074', 'Control Center', 'Central operations workspace', 1, $2, $2)
    `, [projectBriefId, actorId]);
    await this.executor.query(`
      INSERT INTO entity_project_brief (entity_id, status, owner, client_name, start_date, end_date)
      VALUES ($1, 'in-progress', 'Olivia Williams', 'Acme Internal', '2026-08-01', '2026-12-31')
    `, [projectBriefId]);

    const taskOneId = '00000000-0000-0000-0000-000000000082';
    const taskTwoId = '00000000-0000-0000-0000-000000000083';
    for (const [id, name, description] of [
      [taskOneId, 'Define access model', 'Document delegated access boundaries'],
      [taskTwoId, 'Implement activity monitor', 'Coordinate session and lock activity'],
    ] as const) {
      await this.executor.query(`
        INSERT INTO entities (id, entity_type_id, parent_node_id, name, description, row_version, created_by, updated_by)
        VALUES ($1, '00000000-0000-0000-0000-000000000062', '00000000-0000-0000-0000-000000000075', $2, $3, 1, $4, $4)
      `, [id, name, description, actorId]);
    }
    await this.executor.query(`
      INSERT INTO entity_task_record (entity_id, status, priority, assignee, due_date, depends_on)
      VALUES
        ($1, 'done', 'high', 'Olivia Williams', '2026-08-15', NULL),
        ($2, 'in-progress', 'medium', 'Core Team', '2026-08-30', $1)
    `, [taskOneId, taskTwoId]);

    const documentId = '00000000-0000-0000-0000-000000000084';
    await this.executor.query(`
      INSERT INTO entities (id, entity_type_id, parent_node_id, name, description, row_version, created_by, updated_by)
      VALUES ($1, '00000000-0000-0000-0000-000000000063', '00000000-0000-0000-0000-000000000074', 'Architecture Decision Record', 'Reference architecture document', 1, $2, $2)
    `, [documentId, actorId]);
    await this.executor.query(`
      INSERT INTO entity_project_document (entity_id, document_type, version, review_status)
      VALUES ($1, 'architecture', 2, 'approved')
    `, [documentId]);

    await this.executor.query("DROP TABLE IF EXISTS resource_locks CASCADE");
    await this.executor.query("DROP TABLE IF EXISTS locks CASCADE");

    await this.executor.query(`
      CREATE TABLE locks (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        resource_type TEXT NOT NULL,
        resource_id   TEXT NOT NULL,
        user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        session_id    UUID NOT NULL REFERENCES user_sessions(id) ON DELETE CASCADE,
        acquired_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
        expires_at    TIMESTAMPTZ NOT NULL,
        UNIQUE (resource_type, resource_id)
      )
    `);

    await this.executor.query("DELETE FROM system_settings");
    await this.executor.query("DELETE FROM runtime_capabilities");

    await this.executor.query(`
      INSERT INTO system_settings (
        category, setting_key, display_name, description, value_type,
        value_text, is_runtime_overridable, is_system
      ) VALUES (
        'security', 'session.idleTimeoutSeconds', 'Session inactivity timeout',
        'Maximum inactivity duration in seconds. Heartbeat, polling and lock TTL are derived from this value.',
        'integer'::setting_value_type_enum, '300', TRUE, TRUE
      )
    `);

    await this.executor.query(`
      INSERT INTO runtime_capabilities (capability_key, name, default_status, description)
      VALUES 
        ('hierarchical_structure', 'Hierarchical Tree', 'enabled'::capability_status_enum, 'Node tree structure'),
        ('entities_structure', 'Entity Storage', 'enabled'::capability_status_enum, 'Dynamic entities structure'),
        ('locking', 'Concurrency Locking', 'enabled'::capability_status_enum, 'Locking controls')
    `);
  }
}
