import pg from '../packages/core/node_modules/pg/lib/index.js';
import {
  Node,
  NodeRepositoryPostgres,
  PgExecutor,
  SqliteInfrastructure,
  SystemSeedPostgres,
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
const createdAt = new Date('2026-01-01T00:00:00.000Z');

function parityNode() {
  return new Node(
    nodeId,
    null,
    'admin_parity_root',
    'admin_parity_root',
    0,
    nodeTypeId,
    'Admin parity root',
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

async function seedSqlite() {
  process.env.SEED_ADMIN_PASSWORD = password;
  process.env.SEED_ADMIN_EMAIL = adminEmail;
  const infrastructure = new SqliteInfrastructure(sqlitePath);
  try {
    await infrastructure.systemSeedService.seedDatabase();
    infrastructure.database.run(
      'INSERT INTO node_types(id,type_key,name,description) VALUES(?,?,?,?)',
      [nodeTypeId, 'admin_parity_root', 'Admin parity root', 'Fixture E2E'],
    );
    await infrastructure.nodeRepository.create(parityNode());
    infrastructure.database.run('DELETE FROM audit_logs');
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
    await executor.query('DELETE FROM users WHERE id<>$1', [adminId]);
    await executor.query(
      `INSERT INTO node_types(id,type_key,name,description)
       VALUES($1,'admin_parity_root','Admin parity root','Fixture E2E')`,
      [nodeTypeId],
    );
    await new NodeRepositoryPostgres(executor).create(parityNode());
    await executor.query('DELETE FROM audit_logs');
  } finally {
    await pool.end();
  }
}

await Promise.all([seedSqlite(), seedPostgres()]);
