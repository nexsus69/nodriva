/** Verifies the SQLite administrative catalogue stays page-bounded and ACL-filtered. */
import { describe, expect, it, vi } from 'vitest';
import { ensureSqliteSchema } from './SqliteSchema.js';
import { SqliteDatabase } from './SqliteDatabase.js';
import { AdminContentCatalogQueryPortSqlite } from './AdminContentCatalogQueryPortSqlite.js';

describe('AdminContentCatalogQueryPortSqlite', () => {
  it('returns one searched node page without materializing the catalogue in the caller', async () => {
    const database = new SqliteDatabase();
    ensureSqliteSchema(database);
    const now = '2026-01-01T00:00:00.000Z';
    database.run('INSERT INTO users (id,email,is_active,is_super_admin) VALUES (?,?,?,?)', ['actor', 'actor@example.test', 1, 1]);
    database.run('INSERT INTO node_types (id,type_key,name) VALUES (?,?,?)', ['type', 'folder', 'Folder']);
    for (let index = 0; index < 60; index += 1) database.run('INSERT INTO nodes (id,path,path_label,depth,node_type_id,name,created_at,updated_at,row_version,payload) VALUES (?,?,?,?,?,?,?,?,?,?)', [`node-${index}`, `root.${index}`, String(index), 1, 'type', `Node ${index}`, now, now, 1, '{}']);
    const all = vi.spyOn(database, 'all');
    const page = await new AdminContentCatalogQueryPortSqlite(database).findNodesPage({ actorUserId: 'actor', page: 2, pageSize: 25, search: 'Node', sort: { key: 'name', direction: 'ascending' } });
    expect(page.total).toBe(60);
    expect(page.pageCount).toBe(3);
    expect(page.items).toHaveLength(25);
    expect(all.mock.calls.at(-1)?.[0]).toContain('LIMIT ? OFFSET ?');
    expect(all.mock.calls.at(-1)?.[1]).toEqual(expect.arrayContaining([25, 25]));
    database.close();
  });

  it('reads one entity summary with the same actor-bound ACL predicate', async () => {
    const get = vi.fn().mockReturnValue({ id: 'entity-1' });
    const database = { get, protectAsyncMethods: vi.fn() } as unknown as SqliteDatabase;
    await expect(new AdminContentCatalogQueryPortSqlite(database).findEntitySummary('actor', 'entity-1'))
      .resolves.toEqual({ id: 'entity-1' });
    expect(get).toHaveBeenCalledWith(expect.stringContaining('e.id=?'), ['entity-1', 'actor', 'entity.read', 'entity.read']);
  });

  it('reads one node summary with the same actor-bound ACL predicate', async () => {
    const get = vi.fn().mockReturnValue({ id: 'node-1' });
    const database = { get, protectAsyncMethods: vi.fn() } as unknown as SqliteDatabase;
    await expect(new AdminContentCatalogQueryPortSqlite(database).findNodeSummary('actor', 'node-1'))
      .resolves.toEqual({ id: 'node-1' });
    expect(get).toHaveBeenCalledWith(expect.stringContaining('n.id=?'), ['node-1', 'actor', 'node.read', 'node.read']);
  });

  it('applies ACL, count, stable order and limit to one causal recycle-bin page', async () => {
    const get = vi.fn().mockReturnValue({ total: 51 });
    const all = vi.fn().mockReturnValue([{ id: 'entity-26', kind: 'entity', name: 'Task', detail: 'Task type', deletedAt: '2026-01-02T00:00:00.000Z', rowVersion: 2, affectedNodeCount: 0, affectedEntityCount: 1 }]);
    const database = { get, all, protectAsyncMethods: vi.fn() } as unknown as SqliteDatabase;
    const page = await new AdminContentCatalogQueryPortSqlite(database).findRecycleBinPage({ actorUserId: 'actor', page: 2, pageSize: 25 });
    expect(page).toMatchObject({ total: 51, page: 2, pageCount: 3, items: [{ id: 'entity-26', kind: 'entity' }] });
    expect(all).toHaveBeenCalledWith(expect.stringContaining('ORDER BY deletedAt DESC,id DESC LIMIT ? OFFSET ?'), ['actor', 'node.restore', 'node.restore', 'actor', 'entity.restore', 'entity.restore', 25, 25]);
  });
});
