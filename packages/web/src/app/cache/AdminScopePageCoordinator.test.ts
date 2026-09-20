/** Verifies bounded scope pages are retained independently from mutation invalidation. */
import { describe, expect, it, vi } from 'vitest';
import { CacheKernel } from './CacheKernel';
import { AdminScopePageCoordinator } from './AdminScopePageCoordinator';

const item = (id: string) => ({
  id,
  userId: `user-${id}`,
  userEmail: `${id}@example.test`,
  nodeId: `node-${id}`,
  nodeName: `Node ${id}`,
  roleId: `role-${id}`,
  roleName: 'Reader',
  assignmentEffect: 'allow' as const,
  propagation: 'subtree' as const,
  assignedAt: '2026-01-01T00:00:00.000Z',
});

describe('AdminScopePageCoordinator', () => {
  it('keys search and sort independently, reuses verified pages, and invalidates after a change', async () => {
    const load = vi.fn(async (input: { page: number }) => ({
      items: [item(`scope-${input.page}`)], total: 2, page: input.page, pageCount: 2,
    }));
    const coordinator = new AdminScopePageCoordinator(new CacheKernel(), load, async () => true);

    await coordinator.read({ page: 1, pageSize: 25, search: 'alpha' });
    await coordinator.read({ page: 1, pageSize: 25, search: 'alpha' });
    await coordinator.read({ page: 1, pageSize: 25, search: 'beta' });
    await coordinator.read({ page: 1, pageSize: 25, search: 'beta', sort: { key: 'role', direction: 'descending' } });
    expect(load).toHaveBeenCalledTimes(3);

    coordinator.invalidateFamily();
    await coordinator.read({ page: 1, pageSize: 25, search: 'alpha' });
    expect(load).toHaveBeenCalledTimes(4);
  });
});
