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
const seedEmail = process.env.SEED_ADMIN_EMAIL;

if (!host || !password || !seedEmail || !seedPassword) {
  throw new Error('POSTGRES_HOST, POSTGRES_PASSWORD, SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD are required');
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

  const executor = new PgExecutor(pool);
  const transaction = new TransactionPortPostgres(pool);
  const seed = new SystemSeedPostgres(executor, transaction, seedPassword, seedEmail);
  await seed.seedDatabase();
  console.log(`[dashboard-db-bootstrap] Idempotent bootstrap completed for ${seedEmail}.`);
} finally {
  await pool.end();
}
