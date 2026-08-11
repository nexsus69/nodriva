import pg from './packages/core/node_modules/pg/lib/index.js';
import {
  PgExecutor,
  TransactionPortPostgres,
  SystemSeedPostgres,
} from './packages/core/dist/index.js';

const {
  Pool,
} = pg;

const host = process.env.POSTGRES_HOST;
const password = process.env.POSTGRES_PASSWORD;
const seedPassword = process.env.SEED_ADMIN_PASSWORD;
const seedEmail = process.env.SEED_ADMIN_EMAIL ?? 'marco123@test.com';

if (!host || !password || !seedPassword) {
  throw new Error('POSTGRES_HOST, POSTGRES_PASSWORD and SEED_ADMIN_PASSWORD are required');
}

const pool = new Pool({
  host,
  port: Number(process.env.POSTGRES_PORT ?? 5432),
  database: process.env.POSTGRES_DB ?? 'dashboard',
  user: process.env.POSTGRES_USER ?? 'postgres',
  password,
});

try {
  for (;;) {
    try {
      await pool.query('SELECT 1');
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  const existing = await pool.query('SELECT 1 FROM users WHERE email = $1 LIMIT 1', [seedEmail]);
  if (existing.rowCount > 0) {
    console.log(`[dashboard-db-bootstrap] ${seedEmail} already exists; skipping seed.`);
    process.exitCode = 0;
  } else {
    const executor = new PgExecutor(pool);
    const transaction = new TransactionPortPostgres(pool);
    const seed = new SystemSeedPostgres(executor, transaction, seedPassword);
    await seed.seedDatabase();
    console.log(`[dashboard-db-bootstrap] Seed completed for ${seedEmail}.`);
  }
} finally {
  await pool.end();
}
