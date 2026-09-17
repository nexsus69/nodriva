/** Verifies the PostgreSQL administrative catalogue issues bounded ACL-filtered pages. */
import { describe, expect, it, vi } from 'vitest';
import { AdminContentCatalogQueryPortPostgres } from './AdminContentCatalogQueryPortPostgres.js';
import type { PgExecutor } from './PgExecutor.js';

describe('AdminContentCatalogQueryPortPostgres', () => {
  it('applies server search, ordering, limit and offset to an entity page', async () => {
    const executor = { query: vi.fn().mockResolvedValueOnce({ rows: [{ total: 51 }] }).mockResolvedValueOnce({ rows: [{ id: 'entity-26', parentNodeId: 'node-1', entityTypeId: 'type-1', name: 'Task 26', description: '', rowVersion: 1, nodeName: 'Node', nodePath: 'root.node', typeLabel: 'Task' }] }) };
    const page = await new AdminContentCatalogQueryPortPostgres(executor as unknown as PgExecutor).findEntitiesPage({ actorUserId: 'actor', page: 2, pageSize: 25, search: 'Task', sort: { key: 'name', direction: 'descending' } });
    expect(page).toMatchObject({ total: 51, page: 2, pageCount: 3 });
    expect(executor.query.mock.calls[1]?.[0]).toContain('ORDER BY e.name DESC');
    expect(executor.query.mock.calls[1]?.[0]).toContain('LIMIT $3 OFFSET $4');
    expect(executor.query.mock.calls[1]?.[1]).toEqual(['actor', '%Task%', 25, 25]);
  });

  it('clamps an out-of-range page before issuing its bounded query', async () => {
    const executor = { query: vi.fn().mockResolvedValueOnce({ rows: [{ total: 51 }] }).mockResolvedValueOnce({ rows: [{ id: 'entity-51' }] }) };
    const page = await new AdminContentCatalogQueryPortPostgres(executor as unknown as PgExecutor).findEntitiesPage({ actorUserId: 'actor', page: 99, pageSize: 25 });
    expect(page).toMatchObject({ total: 51, page: 3, pageCount: 3, items: [{ id: 'entity-51' }] });
    expect(executor.query.mock.calls[1]?.[1]).toEqual(['actor', 25, 50]);
  });

  it('declares the escaped LIKE semantics used for literal search input', async () => {
    const executor = { query: vi.fn().mockResolvedValueOnce({ rows: [{ total: 0 }] }).mockResolvedValueOnce({ rows: [] }) };
    await new AdminContentCatalogQueryPortPostgres(executor as unknown as PgExecutor).findNodesPage({ actorUserId: 'actor', page: 1, pageSize: 25, search: '50%_done' });
    expect(executor.query.mock.calls[0]?.[0]).toContain("ILIKE $2 ESCAPE '\\'");
    expect(executor.query.mock.calls[0]?.[1]).toEqual(['actor', '%50\\%\\_done%']);
  });

  it('reads one entity summary through the same ACL predicate used by the page query', async () => {
    const executor = { query: vi.fn().mockResolvedValue({ rows: [{ id: 'entity-1' }] }) };
    await expect(new AdminContentCatalogQueryPortPostgres(executor as unknown as PgExecutor).findEntitySummary('actor', 'entity-1'))
      .resolves.toEqual({ id: 'entity-1' });
    expect(executor.query).toHaveBeenCalledWith(expect.stringContaining('e.id=$2'), ['actor', 'entity-1']);
    expect(executor.query.mock.calls[0]?.[0]).toContain("p.permission_key = 'entity.read'");
  });
});
