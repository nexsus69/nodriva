/** Verifies bounded causal recycle-bin page windows. */
import { describe, expect, it, vi } from 'vitest';
import { CacheKernel } from './CacheKernel';
import { AdminRecycleBinPageCoordinator } from './AdminRecycleBinPageCoordinator';
const page = (number: number) => ({ items: [{ id: `op-${number}`, kind: 'entity' as const, name: 'x', detail: 'T', deletedAt: '2026-01-01T00:00:00.000Z', rowVersion: 1, affectedNodeCount: 0, affectedEntityCount: 1 }], total: 6, page: number, pageCount: 6 });
describe('AdminRecycleBinPageCoordinator', () => {
  it('reuses a verified window, bounds retention, and reloads after invalidation', async () => {
    const load = vi.fn(async (input: { page: number }) => page(input.page)); const coordinator = new AdminRecycleBinPageCoordinator(new CacheKernel(), load, async () => true);
    await coordinator.read({ page: 1, pageSize: 25 }); await coordinator.read({ page: 2, pageSize: 25 }); await coordinator.read({ page: 1, pageSize: 25 }); expect(load).toHaveBeenCalledTimes(2);
    for (let number = 3; number <= 6; number += 1) await coordinator.read({ page: number, pageSize: 25 });
    coordinator.invalidateFamily(); await coordinator.read({ page: 1, pageSize: 25 }); expect(load).toHaveBeenCalledTimes(7);
  });
});
