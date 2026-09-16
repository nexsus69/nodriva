import { describe, expect, it, vi } from 'vitest';
import { UserRepositoryPostgres } from './UserRepositoryPostgres.js';
import type { PgExecutor } from './PgExecutor.js';

describe('UserRepositoryPostgres paged catalogue', () => {
  it('keeps delegation, count, search and bounded ordering in SQL', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [{ total: 3 }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ id: 'u2', email: 'bravo@example.com', isActive: true, isSuperAdmin: false, createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-01'), roles: [] }], rowCount: 1 });
    const repository = new UserRepositoryPostgres({ query } as unknown as PgExecutor);
    await expect(repository.listUsersManageablePage('actor', { page: 2, pageSize: 2, search: 'bravo', sort: { key: 'email', direction: 'descending' } }))
      .resolves.toMatchObject({ total: 3, page: 2, pageCount: 2, items: [{ id: 'u2' }] });
    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[0]?.[0]).toContain('COUNT(*)');
    expect(query.mock.calls[1]?.[0]).toContain('ORDER BY u.email DESC');
    expect(query.mock.calls[1]?.[0]).toContain('LIMIT $3 OFFSET $4');
    expect(query.mock.calls[1]?.[1]).toEqual(['actor', '%bravo%', 2, 2]);
  });
});
