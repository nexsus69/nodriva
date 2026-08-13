import { TypeDefinitionReaderSqlite } from './TypeDefinitionReaderSqlite.js';
import { SqliteDatabase } from './SqliteDatabase.js';
import { ensureSqliteSchema } from './SqliteSchema.js';
import { registerTypeDefinitionReaderContract } from '../contract/TypeDefinitionReader.contract.js';

registerTypeDefinitionReaderContract('SQLite', async () => {
  const database = new SqliteDatabase();
  ensureSqliteSchema(database);
  database.run('INSERT INTO node_types(id,type_key,name) VALUES(?,?,?)', ['type', 'contract_device', 'Contract device']);
  database.run('INSERT INTO node_type_fields(id,node_type_id,field_key,label,column_name,data_type,position,enum_mode) VALUES(?,?,?,?,?,?,?,?)', ['status', 'type', 'status', 'Status', 'status', 'enum', 0, 'managed']);
  database.run('INSERT INTO node_type_fields(id,node_type_id,field_key,label,column_name,data_type,position,encryption_mode) VALUES(?,?,?,?,?,?,?,?)', ['serial', 'type', 'serial_number', 'Serial', 'serial_number', 'string', 1, 'encrypted']);
  database.run('INSERT INTO node_type_field_enum_options(id,field_id,value,label,position,is_active,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)', ['option', 'status', 'active', 'Active', 0, 1, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z']);
  database.run('INSERT INTO node_type_field_constraints(id,field_id,constraint_type,constraint_value_text,created_at) VALUES(?,?,?,?,?)', ['constraint', 'serial', 'regex', '^[A-Z0-9]+$', '2026-01-01T00:00:00.000Z']);
  return {
    reader: new TypeDefinitionReaderSqlite(database),
    deactivateType: async () => { database.run('UPDATE node_types SET is_active=0 WHERE id=?', ['type']); },
    dispose: async () => { database.close(); },
  };
});
