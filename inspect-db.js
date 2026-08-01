const { Pool } = require('pg');
const fs = require('fs');

const env = fs.readFileSync('packages/web/.env', 'utf8');
const dbUrl = env.split('\n').find(l => l.startsWith('DATABASE_URL')).split('=')[1].trim();

async function main() {
  const pool = new Pool({ connectionString: dbUrl });
  
  try {
    const typeRes = await pool.query("SELECT * FROM entity_types WHERE type_key LIKE '%ingredienti%' OR name ILIKE '%ingredienti%';");
    console.log('--- ENTITY TYPES ---');
    console.log(JSON.stringify(typeRes.rows, null, 2));

    if (typeRes.rows.length > 0) {
      const typeId = typeRes.rows[0].id;
      const fieldsRes = await pool.query("SELECT * FROM entity_type_fields WHERE entity_type_id = $1;", [typeId]);
      console.log('\n--- FIELDS ---');
      console.log(JSON.stringify(fieldsRes.rows, null, 2));

      const storageMetaRes = await pool.query("SELECT * FROM storage_table_meta WHERE entity_type_id = $1;", [typeId]);
      console.log('\n--- STORAGE META ---');
      console.log(JSON.stringify(storageMetaRes.rows, null, 2));

      if (storageMetaRes.rows.length > 0) {
        const tableName = storageMetaRes.rows[0].table_name;
        console.log(`\n--- TABLE: ${tableName} ---`);
        try {
          const tableRes = await pool.query(`SELECT * FROM ${tableName} LIMIT 5;`);
          console.log(JSON.stringify(tableRes.rows, null, 2));
        } catch (e) {
          console.log(`Error querying table: ${e.message}`);
        }
      }
    }
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}
main();
