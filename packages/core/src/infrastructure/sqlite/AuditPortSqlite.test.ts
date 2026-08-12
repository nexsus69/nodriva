import { describe, expect, it } from 'vitest';
import { ensureSqliteSchema } from './SqliteSchema.js';
import { SqliteDatabase } from './SqliteDatabase.js';
import { AuditPortSqlite } from './AuditPortSqlite.js';

describe('AuditPortSqlite', () => {
  it('persists immutable before/after payloads', async () => {
    const database = new SqliteDatabase(); ensureSqliteSchema(database);
    await new AuditPortSqlite(database).record('user', 'node.updated', 'node', 'node-1', null, { name: 'old' }, { name: 'new' });
    const row = database.get<{ action_key: string; before_payload: string; after_payload: string }>('SELECT action_key,before_payload,after_payload FROM audit_logs');
    expect(row?.action_key).toBe('node.updated');
    expect(JSON.parse(row?.before_payload ?? '{}')).toEqual({ name: 'old' });
    expect(JSON.parse(row?.after_payload ?? '{}')).toEqual({ name: 'new' });
    database.close();
  });
});
