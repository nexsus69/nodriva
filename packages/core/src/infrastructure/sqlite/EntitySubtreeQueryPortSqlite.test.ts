/** Verifies SQLite subtree pagination applies ACL checks in bounded batches. */
import { describe, expect, it, vi } from 'vitest';
import type { AccessControlPort } from '../../application/ports/AccessControlPort.js';
import { ensureSqliteSchema } from './SqliteSchema.js';
import { SqliteDatabase } from './SqliteDatabase.js';
import { EntitySubtreeQueryPortSqlite } from './EntitySubtreeQueryPortSqlite.js';

describe('EntitySubtreeQueryPortSqlite', () => {
  it('uses bounded batch ACL checks instead of one check per candidate', async () => {
    const database = new SqliteDatabase();
    ensureSqliteSchema(database);
    const now = new Date('2026-01-01T00:00:00.000Z').toISOString();
    database.run('INSERT INTO node_types (id,type_key,name) VALUES (?,?,?)', ['node-type', 'folder', 'Folder']);
    database.run('INSERT INTO entity_types (id,type_key,name,storage_table) VALUES (?,?,?,?)', ['entity-type', 'record', 'Record', 'entity_data_record']);
    database.run('INSERT INTO nodes (id,path,path_label,depth,node_type_id,name,created_at,updated_at,row_version,payload) VALUES (?,?,?,?,?,?,?,?,?,?)', ['root', 'root', 'root', 0, 'node-type', 'Root', now, now, 1, '{}']);
    for (let index = 0; index < 120; index += 1) {
      database.run('INSERT INTO entities (id,entity_type_id,parent_node_id,name,description,row_version,created_at,updated_at,payload) VALUES (?,?,?,?,?,?,?,?,?)', [`entity-${index}`, 'entity-type', 'root', `Entity ${index}`, '', 1, now, now, '{}']);
    }
    const listReadableResourceIds = vi.fn(async (_actor: string, _domain: 'node' | 'entity', ids: readonly string[]) => ids.filter((id) => Number(id.split('-')[1]) % 30 === 0));
    const acl = { listReadableResourceIds } as unknown as AccessControlPort;
    const query = new EntitySubtreeQueryPortSqlite(database, acl);

    const result = await query.findSubtreeEntitiesPaginated({ baseNodeId: 'root', limit: 3, actorUserId: 'actor' });
    expect(result.items.map((item) => item.id)).toEqual(['entity-0', 'entity-30', 'entity-60']);
    expect(result.hasMore).toBe(true);
    expect(listReadableResourceIds).toHaveBeenCalled();
    expect(listReadableResourceIds.mock.calls.every((call) => call[2].length <= 25)).toBe(true);
    expect(listReadableResourceIds.mock.calls.length).toBeGreaterThan(1);
    database.close();
  });
});
