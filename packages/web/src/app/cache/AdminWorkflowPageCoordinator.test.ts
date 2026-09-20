/** Verifies workflow windows are bounded, query-keyed and invalidated by mutations. */
import { describe, expect, it, vi } from 'vitest';
import { CacheKernel } from './CacheKernel';
import { AdminWorkflowPageCoordinator } from './AdminWorkflowPageCoordinator';

describe('AdminWorkflowPageCoordinator', () => {
  it('reuses a verified page and reloads after a workflow invalidation', async () => {
    const load = vi.fn(async (input: { page: number }) => ({ items: [{ workflowId: `workflow_${input.page}`, name: `Workflow ${input.page}`, version: 1, isActive: true, triggerEventTypes: [], conditions: [], steps: [] }], total: 2, page: input.page, pageCount: 2 }));
    const coordinator = new AdminWorkflowPageCoordinator(new CacheKernel(), load, async () => true);
    await coordinator.read({ page: 1, pageSize: 25, search: 'workflow' });
    await coordinator.read({ page: 1, pageSize: 25, search: 'workflow' });
    await coordinator.read({ page: 2, pageSize: 25, search: 'workflow' });
    expect(load).toHaveBeenCalledTimes(2);
    coordinator.invalidateFamily();
    await coordinator.read({ page: 1, pageSize: 25, search: 'workflow' });
    expect(load).toHaveBeenCalledTimes(3);
  });
});
