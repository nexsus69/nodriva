/** Verifies administrative read caching, invalidation, and retry semantics. */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  listScopeAssignmentsAction: vi.fn(),
  listDeletedNodesAction: vi.fn(),
  listDeletedEntitiesAction: vi.fn(),
  restoreDeletedNodeAction: vi.fn(),
  listAuditLogsAction: vi.fn(),
  listTypesPageAction: vi.fn(),
}));

vi.mock('../actions/securityActions', () => ({
  listScopeAssignmentsAction: mocks.listScopeAssignmentsAction,
}));
vi.mock('../actions/auditActions', () => ({ listAuditLogsAction: mocks.listAuditLogsAction }));
vi.mock('../actions/nodeActions', () => ({}));
vi.mock('../actions/seedAction', () => ({}));
vi.mock('../actions/systemActions', () => ({}));
vi.mock('../actions/typeActions', () => ({ listTypesPageAction: mocks.listTypesPageAction }));
vi.mock('../actions/recycleActions', () => ({
  listDeletedNodesAction: mocks.listDeletedNodesAction,
  listDeletedEntitiesAction: mocks.listDeletedEntitiesAction,
  restoreDeletedNodeAction: mocks.restoreDeletedNodeAction,
}));
vi.mock('../actions/entityActions', () => ({}));

import { AdminCacheClient } from './AdminCacheClient';
import { CacheReadTraceStore } from './CacheReadTraceStore';

describe('AdminCacheClient failed reads', () => {
  beforeEach(() => Object.values(mocks).forEach((mock) => mock.mockReset()));

  it('evicts a failed action result so retry reaches the backend', async () => {
    mocks.listScopeAssignmentsAction
      .mockResolvedValueOnce({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Unavailable' } })
      .mockResolvedValueOnce({ success: true, data: [] });
    const client = new AdminCacheClient();

    await expect(client.listScopeAssignments()).resolves.toMatchObject({ success: false });
    await expect(client.listScopeAssignments()).resolves.toEqual({ success: true, data: [] });
    expect(mocks.listScopeAssignmentsAction).toHaveBeenCalledTimes(2);
  });

  it('deduplicates and retains a successful read', async () => {
    mocks.listScopeAssignmentsAction.mockResolvedValue({ success: true, data: [] });
    const client = new AdminCacheClient();

    await client.listScopeAssignments();
    await client.listScopeAssignments();
    expect(mocks.listScopeAssignmentsAction).toHaveBeenCalledTimes(1);
  });

  it('does not let an obsolete failure evict a newer successful request', async () => {
    let resolveFirst!: (value: { success: false; error: { code: string; message: string } }) => void;
    const first = new Promise<{ success: false; error: { code: string; message: string } }>((resolve) => {
      resolveFirst = resolve;
    });
    mocks.listScopeAssignmentsAction
      .mockReturnValueOnce(first)
      .mockResolvedValueOnce({ success: true, data: [] });
    const client = new AdminCacheClient();

    const obsoleteRequest = client.listScopeAssignments();
    client.invalidate(['scope-assignments']);
    await expect(client.listScopeAssignments()).resolves.toEqual({ success: true, data: [] });
    resolveFirst({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Old failure' } });
    await obsoleteRequest;
    await client.listScopeAssignments();

    expect(mocks.listScopeAssignmentsAction).toHaveBeenCalledTimes(2);
  });

  it('invalidates both recycle projections after restoring a node subtree', async () => {
    mocks.listDeletedNodesAction
      .mockResolvedValueOnce({ success: true, data: [{ id: 'old-node' }] })
      .mockResolvedValueOnce({ success: true, data: [] });
    mocks.listDeletedEntitiesAction
      .mockResolvedValueOnce({ success: true, data: [{ id: 'old-entity' }] })
      .mockResolvedValueOnce({ success: true, data: [] });
    mocks.restoreDeletedNodeAction.mockResolvedValue({ success: true, data: { restored: true } });
    const client = new AdminCacheClient();

    await Promise.all([client.listDeletedNodes(), client.listDeletedEntities()]);
    await client.restoreDeletedNode({ nodeId: 'old-node', expectedRowVersion: 1 });
    await Promise.all([client.listDeletedNodes(), client.listDeletedEntities()]);

    expect(mocks.listDeletedNodesAction).toHaveBeenCalledTimes(2);
    expect(mocks.listDeletedEntitiesAction).toHaveBeenCalledTimes(2);
  });

  it('keeps a bounded LRU working set for generic server-paged catalogues', async () => {
    mocks.listTypesPageAction.mockImplementation(async (_kind: string, { page }: { page: number }) => ({ success: true, data: { items: [], total: 6, page, pageCount: 6 } }));
    const client = new AdminCacheClient();
    for (let page = 1; page <= 6; page += 1) await client.listTypesPage('node', { page, pageSize: 25 });
    await client.listTypesPage('node', { page: 1, pageSize: 25 });
    expect(mocks.listTypesPageAction).toHaveBeenCalledTimes(7);
  });

  it('traces whether an administrative page came from the backend or the cache', async () => {
    mocks.listTypesPageAction.mockResolvedValue({ success: true, data: { items: [], total: 1, page: 1, pageCount: 1 } });
    const trace = new CacheReadTraceStore();
    const client = new AdminCacheClient(undefined, undefined, trace);
    await client.listTypesPage('node', { page: 1, pageSize: 25 });
    await client.listTypesPage('node', { page: 1, pageSize: 25 });
    expect(trace.getEvents()).toEqual([
      expect.objectContaining({ source: 'backend', reason: 'cache-miss' }),
      expect.objectContaining({ source: 'cache', reason: 'continuity-confirmed' }),
    ]);
  });

  it('keeps audit result pages in the same bounded working set', async () => {
    mocks.listAuditLogsAction.mockImplementation(async ({ page }: { page: number }) => ({ success: true, data: { items: [], total: 6, page, pageCount: 6 } }));
    const client = new AdminCacheClient();
    for (let page = 1; page <= 6; page += 1) await client.listAuditLogs({ page, pageSize: 25 });
    await client.listAuditLogs({ page: 1, pageSize: 25 });
    expect(mocks.listAuditLogsAction).toHaveBeenCalledTimes(7);
  });

  it('keeps type pages isolated instead of materializing a complete type catalogue', async () => {
    mocks.listTypesPageAction.mockImplementation(async (_kind: string, { page }: { page: number }) => ({ success: true, data: { items: [{ id: `type-${page}` }], total: 51, page, pageCount: 3 } }));
    const client = new AdminCacheClient();
    const first = await client.listTypesPage('node', { page: 1, pageSize: 25 });
    const second = await client.listTypesPage('node', { page: 2, pageSize: 25 });
    expect(first).toMatchObject({ data: { items: [{ id: 'type-1' }] } });
    expect(second).toMatchObject({ data: { items: [{ id: 'type-2' }] } });
    expect(mocks.listTypesPageAction).toHaveBeenCalledTimes(2);
  });
});
