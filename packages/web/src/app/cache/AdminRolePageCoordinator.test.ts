/** Verifies bounded role windows use query identity and mutation invalidation. */
import { describe, expect, it, vi } from 'vitest';
import { CacheKernel } from './CacheKernel';
import { AdminRolePageCoordinator } from './AdminRolePageCoordinator';

describe('AdminRolePageCoordinator', () => {
  it('reuses a verified page and reloads it after role invalidation', async () => {
    const load = vi.fn(async (input: { page: number }) => ({ items: [{ id: `role-${input.page}`, roleKey: `role_${input.page}`, name: `Role ${input.page}`, description: '', isSystem: false, permissionCount: 0, updatedAt: '2026-01-01T00:00:00.000Z' }], total: 2, page: input.page, pageCount: 2 }));
    const coordinator = new AdminRolePageCoordinator(new CacheKernel(), load, async () => true);
    await coordinator.read({ page: 1, pageSize: 25, search: 'operator' });
    await coordinator.read({ page: 1, pageSize: 25, search: 'operator' });
    await coordinator.read({ page: 1, pageSize: 25, search: 'operator', sort: { key: 'permissions', direction: 'descending' } });
    expect(load).toHaveBeenCalledTimes(2);
    coordinator.invalidateFamily();
    await coordinator.read({ page: 1, pageSize: 25, search: 'operator' });
    expect(load).toHaveBeenCalledTimes(3);
  });
});
