import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ listUsersPageAction: vi.fn() }));
vi.mock('../actions/userActions', () => ({ listUsersPageAction: mocks.listUsersPageAction }));

import { CacheKernel } from './CacheKernel';
import { UserCacheClient } from './UserCacheClient';

describe('UserCacheClient paged catalogue', () => {
  beforeEach(() => mocks.listUsersPageAction.mockReset());

  it('keeps page 1 and page 2 separate, then invalidates both after a mutation event', async () => {
    mocks.listUsersPageAction.mockImplementation(async (input?: { page: number }) => {
      const page = input?.page ?? 1;
      return { success: true, data: { items: [{ id: `user-${page}`, email: `user-${page}@example.com`, isActive: true, isSuperAdmin: false, roles: [], createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }], total: 2, page, pageCount: 2 } };
    });
    const client = new UserCacheClient(new CacheKernel(), () => undefined);
    await client.listUsersPage({ page: 1, pageSize: 25 });
    await client.listUsersPage({ page: 2, pageSize: 25 });
    await client.listUsersPage({ page: 1, pageSize: 25 });
    expect(mocks.listUsersPageAction).toHaveBeenCalledTimes(2);
    client.invalidatePages();
    await client.listUsersPage({ page: 1, pageSize: 25 });
    await client.listUsersPage({ page: 2, pageSize: 25 });
    expect(mocks.listUsersPageAction).toHaveBeenCalledTimes(4);
  });
});
