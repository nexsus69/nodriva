import pg from 'pg';
import { describe } from 'vitest';
import { PgExecutor } from './PgExecutor.js';
import { TypeDefinitionReaderPostgres } from './TypeDefinitionReaderPostgres.js';
import { registerTypeDefinitionReaderContract } from '../contract/TypeDefinitionReader.contract.js';

const databaseUrl = process.env.INTEGRATION_DATABASE_URL;
const databaseName = databaseUrl ? new URL(databaseUrl).pathname.slice(1) : '';
const describeIntegration = databaseUrl && /(?:^|_)test(?:_|$)/.test(databaseName) ? describe : describe.skip;

describeIntegration('PostgreSQL contract tests', () => {
  registerTypeDefinitionReaderContract('PostgreSQL', async () => {
    const pool = new pg.Pool({ connectionString: databaseUrl });
    const executor = new PgExecutor(pool);
    const typeId = '10000000-0000-0000-0000-000000000001';
    const statusId = '10000000-0000-0000-0000-000000000002';
    const serialId = '10000000-0000-0000-0000-000000000003';
    await executor.query('DELETE FROM node_types WHERE id = $1', [typeId]);
    await executor.query(`INSERT INTO node_types(id,type_key,name) VALUES($1,'contract_device','Contract device')`, [typeId]);
    await executor.query(`INSERT INTO node_type_fields(id,node_type_id,field_key,label,column_name,data_type,position,enum_mode)
      VALUES($1,$2,'status','Status','status','enum',0,'managed'),($3,$2,'serial_number','Serial','serial_number','string',1,'static')`, [statusId, typeId, serialId]);
    await executor.query('UPDATE node_type_fields SET encryption_mode = $1 WHERE id = $2', ['encrypted', serialId]);
    await executor.query(`INSERT INTO node_type_field_enum_options(id,field_id,value,label,position,is_active)
      VALUES('10000000-0000-0000-0000-000000000004',$1,'active','Active',0,true)`, [statusId]);
    await executor.query(`INSERT INTO node_type_field_constraints(id,field_id,constraint_type,constraint_value_text)
      VALUES('10000000-0000-0000-0000-000000000005',$1,'regex','^[A-Z0-9]+$')`, [serialId]);
    return {
      reader: new TypeDefinitionReaderPostgres(executor),
      deactivateType: async () => { await executor.query('UPDATE node_types SET is_active = FALSE WHERE id = $1', [typeId]); },
      dispose: async () => {
        await executor.query('DELETE FROM node_types WHERE id = $1', [typeId]);
        await pool.end();
      },
    };
  });
});
