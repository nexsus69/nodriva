import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config({ path: '../web/.env' });

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
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
        } catch (e: any) {
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
