/** Verifies bounded user-page retention independently from user records and mutations. */
import { describe, expect, it, vi } from 'vitest';
import { UserPageCoordinator } from './UserPageCoordinator';

describe('UserPageCoordinator', () => {
  it('reuses normalized queries, evicts LRU pages, and invalidates explicitly', async () => {
    const load = vi.fn(async ({ page }: { page: number }) => ({ items: [], total: 6, page, pageCount: 6 }));
    const coordinator = new UserPageCoordinator(load, vi.fn(), 2);
    await coordinator.read({ page: 1, pageSize: 25, search: ' staff ' });
    await coordinator.read({ page: 1, pageSize: 25, search: 'staff' });
    await coordinator.read({ page: 2, pageSize: 25 });
    await coordinator.read({ page: 3, pageSize: 25 });
    await coordinator.read({ page: 1, pageSize: 25, search: 'staff' });
    expect(load).toHaveBeenCalledTimes(4);
    coordinator.invalidate();
    await coordinator.read({ page: 3, pageSize: 25 });
    expect(load).toHaveBeenCalledTimes(5);
  });
});
