const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgres://postgres:postgres@localhost:5432/dashboard_ultimate' });

async function run() {
  console.log('Testing DB...');
  const res = await pool.query('SELECT email FROM users LIMIT 1');
  console.log('Users in DB:', res.rows);
  pool.end();
}
run();
