/** Verifies PostgreSQL keeps scope pagination and delegation filtering in SQL. */
import { describe, expect, it, vi } from 'vitest';
import { SecurityRepositoryPostgres } from './SecurityRepositoryPostgres.js';
import type { PgExecutor } from './PgExecutor.js';

describe('SecurityRepositoryPostgres', () => {
  it('bounds searched role catalogue queries in PostgreSQL', async () => {
    const executor = { query: vi.fn()
      .mockResolvedValueOnce({ rows: [{ total: 1 }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ id: 'role', roleKey: 'operator', name: 'Operator', description: '', isSystem: false, permissionCount: 2, updatedAt: new Date('2026-01-01T00:00:00.000Z') }], rowCount: 1 }) };
    const repository = new SecurityRepositoryPostgres(executor as unknown as PgExecutor);
    await expect(repository.listRolesPage({ page: 1, pageSize: 25, search: 'operator', sort: { key: 'permissions', direction: 'descending' } })).resolves.toMatchObject({ total: 1, items: [expect.objectContaining({ roleKey: 'operator' })] });
    expect(executor.query.mock.calls[1]?.[0]).toContain('ORDER BY "permissionCount" DESC');
    expect(executor.query.mock.calls[1]?.[0]).toContain('LIMIT $2 OFFSET $3');
  });

  it('uses the manageable-user CTE for the count and bounded searched page', async () => {
    const executor = { query: vi.fn()
      .mockResolvedValueOnce({ rows: [{ total: 1 }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ id: 'scope', userId: 'user', userEmail: 'user@example.test', nodeId: 'node', nodeName: 'Node', roleId: 'role', roleName: 'Reader', assignmentEffect: 'allow', propagation: 'subtree', assignedAt: new Date('2026-01-01T00:00:00.000Z') }], rowCount: 1 }), };
    const repository = new SecurityRepositoryPostgres(executor as unknown as PgExecutor);

    await expect(repository.listScopeAssignmentsManageablePage('actor', {
      page: 1, pageSize: 25, search: 'user', sort: { key: 'role', direction: 'descending' },
    })).resolves.toMatchObject({ total: 1, page: 1, pageCount: 1, items: [expect.objectContaining({ id: 'scope' })] });

    expect(executor.query.mock.calls[0]?.[0]).toContain('WITH delegable AS');
    expect(executor.query.mock.calls[1]?.[0]).toContain('ILIKE $2');
    expect(executor.query.mock.calls[1]?.[0]).toContain('ORDER BY r.name DESC');
    expect(executor.query.mock.calls[1]?.[0]).toContain('LIMIT $3 OFFSET $4');
  });
});
