import pg from '../packages/core/node_modules/pg/lib/index.js';
import crypto from 'node:crypto';
import {
  Node,
  NodeRepositoryPostgres,
  PgExecutor,
  SqliteInfrastructure,
  StorageTableManagementPostgres,
  SystemSeedPostgres,
  ServiceConfigurationRepositoryPostgres,
  TransactionPortPostgres,
} from '../packages/core/dist/index.js';

const sqlitePath = process.env.PARITY_SQLITE_PATH;
const postgresUrl = process.env.PARITY_POSTGRES_ADMIN_URL;
const password = process.env.PARITY_ADMIN_PASSWORD;
const adminEmail = process.env.PARITY_ADMIN_EMAIL ?? 'admin-parity@dashboard.test';

if (!sqlitePath || !postgresUrl || !password) {
  throw new Error('PARITY_SQLITE_PATH, PARITY_POSTGRES_ADMIN_URL and PARITY_ADMIN_PASSWORD are required.');
}

const adminId = '00000000-0000-0000-0000-000000000001';
const nodeTypeId = '70000000-0000-0000-0000-000000000001';
const nodeId = '70000000-0000-0000-0000-000000000002';
const outsideNodeId = '70000000-0000-0000-0000-000000000003';
const entityTypeId = '70000000-0000-0000-0000-000000000004';
const entityStorageTable = 'entity_e2e_customer';
const sqliteRecoveryUserId = '70000000-0000-0000-0000-000000000007';
const postgresRecoveryUserId = '70000000-0000-0000-0000-000000000008';
const sqliteRecoveryToken = 'e2e-sqlite-recovery-token';
const postgresRecoveryToken = 'e2e-postgres-recovery-token';
const tokenHash = (token) => crypto.createHash('sha256').update(token).digest('hex');
const recoveryExpiry = () => new Date(Date.now() + 60 * 60 * 1000).toISOString();
const createdAt = new Date('2026-01-01T00:00:00.000Z');
const pageSeedEnabled = process.env.PARITY_ENTITY_PAGE_SEED === 'true';
const recyclePageSeedEnabled = process.env.PARITY_RECYCLE_PAGE_SEED === 'true';
const pageSeed = Array.from({ length: 26 }, (_, index) => ({ id: `81000000-0000-0000-0000-${String(index + 1).padStart(12, '0')}`, name: `Paged entity ${String(index + 1).padStart(2, '0')}` }));
const pageNodeSeed = Array.from({ length: 26 }, (_, index) => ({ id: `82000000-0000-0000-0000-${String(index + 1).padStart(12, '0')}`, name: `Paged node ${String(index + 1).padStart(2, '0')}`, pathLabel: `paged_node_${String(index + 1).padStart(2, '0')}` }));

function parityNode(id = nodeId, path = 'admin_parity_root', name = 'Admin parity root', parentId = null, depth = 0, pathLabel = path) {
  return new Node(
    id,
    parentId,
    path,
    pathLabel,
    depth,
    nodeTypeId,
    name,
    'Fixture condivisa dai test browser dei due adapter',
    1,
    createdAt,
    createdAt,
    null,
    adminId,
    adminId,
    {},
  );
}

// Configure the authoritative capability policy, not the legacy capability rows.
async function configureRealtime(repository, enabled) {
  const current = await repository.get('realtime');
  await repository.setRuntimeValues('realtime', 'soketi', { enabled }, current?.version ?? 1);
}

async function seedSqlite() {
  process.env.SEED_ADMIN_PASSWORD = password;
  process.env.SEED_ADMIN_EMAIL = adminEmail;
  const infrastructure = new SqliteInfrastructure(sqlitePath);
  try {
    await infrastructure.systemSeedService.seedDatabase();
    await configureRealtime(infrastructure.serviceConfigurationRepository, false);
    infrastructure.database.run(
      'INSERT INTO node_types(id,type_key,name,description) VALUES(?,?,?,?)',
      [nodeTypeId, 'admin_parity_root', 'Admin parity root', 'Fixture E2E'],
    );
    await infrastructure.nodeRepository.create(parityNode());
    await infrastructure.nodeRepository.create(parityNode(outsideNodeId, 'outside_parity_root', 'Outside parity root'));
    if (pageSeedEnabled) for (const node of pageNodeSeed) await infrastructure.nodeRepository.create(parityNode(node.id, `admin_parity_root.${node.pathLabel}`, node.name, nodeId, 1, node.pathLabel));
    infrastructure.database.run(
      'INSERT INTO entity_types(id,type_key,name,description,storage_table) VALUES(?,?,?,?,?)',
      [entityTypeId, 'integration-customer', 'Integration Customer', 'Fixture schema dinamico E2E', entityStorageTable],
    );
    for (const [id, key, label, position] of [
      ['70000000-0000-0000-0000-000000000005', 'email', 'Email Address', 1],
      ['70000000-0000-0000-0000-000000000006', 'phone', 'Phone Number', 2],
    ]) {
      infrastructure.database.run(
        'INSERT INTO entity_type_fields(id,entity_type_id,field_key,label,column_name,data_type,is_required,position) VALUES(?,?,?,?,?,?,?,?)',
        [id, entityTypeId, key, label, key, 'string', 1, position],
      );
    }
    infrastructure.database.run(
      'INSERT INTO entity_type_field_constraints(id,field_id,constraint_type,constraint_value_text,created_at) VALUES(?,?,?,?,?)',
      ['70000000-0000-0000-0000-000000000009', '70000000-0000-0000-0000-000000000005', 'regex', '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$', createdAt.toISOString()],
    );
    infrastructure.database.run('INSERT INTO users(id,email,password_hash) VALUES(?,?,?)', [sqliteRecoveryUserId, 'sqlite-recovery@e2e.test', 'old-hash']);
    infrastructure.database.run("INSERT INTO account_action_tokens(token_hash,user_id,purpose,expires_at,created_by) VALUES(?,?,?,?,?)", [tokenHash(sqliteRecoveryToken), sqliteRecoveryUserId, 'password_reset', recoveryExpiry(), adminId]);
    infrastructure.database.run('DELETE FROM audit_logs');
    if (pageSeedEnabled) for (const entity of pageSeed) infrastructure.database.run('INSERT INTO entities(id,entity_type_id,parent_node_id,name,description,row_version,created_at,updated_at,created_by,updated_by,payload) VALUES(?,?,?,?,?,?,?,?,?,?,?)', [entity.id, entityTypeId, nodeId, entity.name, 'Paged cache fixture', 1, createdAt.toISOString(), createdAt.toISOString(), adminId, adminId, '{}']);
    if (recyclePageSeedEnabled) for (const entity of pageSeed) infrastructure.database.run('INSERT INTO entities(id,entity_type_id,parent_node_id,name,description,row_version,created_at,updated_at,deleted_at,created_by,updated_by,payload) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)', [`91000000-0000-0000-0000-${entity.id.slice(-12)}`, entityTypeId, nodeId, `Deleted ${entity.name}`, 'Recycle fixture', 2, createdAt.toISOString(), createdAt.toISOString(), new Date(Date.UTC(2026, 0, 2, 0, 0, 0) - Number(entity.id.slice(-2)) * 1000).toISOString(), adminId, adminId, '{}']);
  } finally {
    infrastructure.close();
  }
}

async function seedPostgres() {
  const pool = new pg.Pool({ connectionString: postgresUrl, max: 2 });
  const executor = new PgExecutor(pool);
  try {
    const transaction = new TransactionPortPostgres(pool);
    // The parity database is disposable. Remove inherited template identities
    // so the configured fixture administrator receives the canonical id.
    await executor.query('DELETE FROM users');
    await new SystemSeedPostgres(executor, transaction, password, adminEmail).seedDatabase();
    await configureRealtime(new ServiceConfigurationRepositoryPostgres(executor), process.env.PARITY_REALTIME_ENABLED === 'true');
    await executor.query('DELETE FROM users WHERE id<>$1', [adminId]);
    // The PostgreSQL template may contain the integration schema from a prior
    // contract run. It is safe to replace only this disposable E2E fixture.
    await executor.query("DELETE FROM entities WHERE entity_type_id IN (SELECT id FROM entity_types WHERE type_key='integration-customer')");
    await executor.query("DELETE FROM entity_types WHERE type_key='integration-customer'");
    await executor.query(
      `INSERT INTO node_types(id,type_key,name,description)
       VALUES($1,'admin_parity_root','Admin parity root','Fixture E2E')`,
      [nodeTypeId],
    );
    const nodeRepository = new NodeRepositoryPostgres(executor);
    await nodeRepository.create(parityNode());
    await nodeRepository.create(parityNode(outsideNodeId, 'outside_parity_root', 'Outside parity root'));
    if (pageSeedEnabled) for (const node of pageNodeSeed) await nodeRepository.create(parityNode(node.id, `admin_parity_root.${node.pathLabel}`, node.name, nodeId, 1, node.pathLabel));
    await executor.query(
      `INSERT INTO entity_types(id,type_key,name,description,storage_table)
       VALUES($1,'integration-customer','Integration Customer','Fixture schema dinamico E2E',$2)`,
      [entityTypeId, entityStorageTable],
    );
    await executor.query(
      `INSERT INTO entity_type_fields(id,entity_type_id,field_key,label,column_name,data_type,is_required,position)
       VALUES ($1,$2,'email','Email Address','email','string',true,1),
              ($3,$2,'phone','Phone Number','phone','string',true,2)`,
      ['70000000-0000-0000-0000-000000000005', entityTypeId, '70000000-0000-0000-0000-000000000006'],
    );
    await executor.query(
      "INSERT INTO entity_type_field_constraints(id,field_id,constraint_type,constraint_value_text) VALUES($1,$2,'regex',$3)",
      ['70000000-0000-0000-0000-000000000009', '70000000-0000-0000-0000-000000000005', '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$'],
    );
    const storage = new StorageTableManagementPostgres(executor);
    await storage.createStorageTable(entityStorageTable);
    await storage.addColumn(entityStorageTable, 'email', 'string', true, false, null);
    await storage.addColumn(entityStorageTable, 'phone', 'string', true, false, null);
    await executor.query('INSERT INTO users(id,email,password_hash) VALUES($1,$2,$3)', [postgresRecoveryUserId, 'postgres-recovery@e2e.test', 'old-hash']);
    await executor.query("INSERT INTO account_action_tokens(token_hash,user_id,purpose,expires_at,created_by) VALUES($1,$2,'password_reset',$3,$4)", [tokenHash(postgresRecoveryToken), postgresRecoveryUserId, recoveryExpiry(), adminId]);
    await executor.query('DELETE FROM audit_logs');
    if (pageSeedEnabled) for (const entity of pageSeed) await executor.query('INSERT INTO entities(id,entity_type_id,parent_node_id,name,description,row_version,created_at,updated_at,created_by,updated_by) VALUES($1,$2,$3,$4,$5,1,$6,$6,$7,$7)', [entity.id, entityTypeId, nodeId, entity.name, 'Paged cache fixture', createdAt, adminId]);
    if (recyclePageSeedEnabled) for (const entity of pageSeed) await executor.query('INSERT INTO entities(id,entity_type_id,parent_node_id,name,description,row_version,created_at,updated_at,deleted_at,created_by,updated_by) VALUES($1,$2,$3,$4,$5,2,$6,$6,$7,$8,$8)', [`91000000-0000-0000-0000-${entity.id.slice(-12)}`, entityTypeId, nodeId, `Deleted ${entity.name}`, 'Recycle fixture', createdAt, new Date(Date.UTC(2026, 0, 2, 0, 0, 0) - Number(entity.id.slice(-2)) * 1000), adminId]);
  } finally {
    await pool.end();
  }
}

await Promise.all([seedSqlite(), seedPostgres()]);
