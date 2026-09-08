/** Verifies SQLite audit persistence, including optional resource labels. */
import { describe, expect, it } from 'vitest';
import { ensureSqliteSchema } from './SqliteSchema.js';
import { SqliteDatabase } from './SqliteDatabase.js';
import { AuditPortSqlite } from './AuditPortSqlite.js';
import { AuditQueryPortSqlite } from './AuditQueryPortSqlite.js';

describe('AuditPortSqlite', () => {
  it('persists immutable before/after payloads', async () => {
    const database = new SqliteDatabase(); ensureSqliteSchema(database);
    await new AuditPortSqlite(database).record('user', 'node.updated', 'node', 'node-1', null, { name: 'old' }, { name: 'new' }, 'Nodo principale');
    const row = database.get<{ action_key: string; resource_label: string; before_payload: string; after_payload: string }>('SELECT action_key,resource_label,before_payload,after_payload FROM audit_logs');
    expect(row?.action_key).toBe('node.updated');
    expect(row?.resource_label).toBe('Nodo principale');
    expect(JSON.parse(row?.before_payload ?? '{}')).toEqual({ name: 'old' });
    expect(JSON.parse(row?.after_payload ?? '{}')).toEqual({ name: 'new' });
    database.close();
  });

  it('uses the id as a deterministic pagination tie-breaker', async () => {
    const database = new SqliteDatabase(); ensureSqliteSchema(database);
    const occurredAt = '2026-09-08T10:00:00.000Z';
    for (const id of ['audit-a', 'audit-c', 'audit-b']) {
      database.run(
        'INSERT INTO audit_logs(id,action_key,resource_kind,resource_id,occurred_at) VALUES(?,?,?,?,?)',
        [id, 'test.action', 'node', id, occurredAt],
      );
    }

    const query = new AuditQueryPortSqlite(database);
    await expect(query.listAuditLogs({ page: 1, pageSize: 2 })).resolves.toMatchObject({
      items: [{ id: 'audit-c' }, { id: 'audit-b' }],
    });
    await expect(query.listAuditLogs({ page: 2, pageSize: 2 })).resolves.toMatchObject({
      items: [{ id: 'audit-a' }],
    });
    database.close();
  });
});
