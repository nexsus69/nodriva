import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  listScopeAssignmentsAction: vi.fn(),
}));

vi.mock('../actions/securityActions', () => ({
  listScopeAssignmentsAction: mocks.listScopeAssignmentsAction,
}));
vi.mock('../actions/auditActions', () => ({}));
vi.mock('../actions/nodeActions', () => ({}));
vi.mock('../actions/seedAction', () => ({}));
vi.mock('../actions/systemActions', () => ({}));
vi.mock('../actions/typeActions', () => ({}));
vi.mock('../actions/recycleActions', () => ({}));
vi.mock('../actions/entityActions', () => ({}));

import { AdminCacheClient } from './AdminCacheClient';

describe('AdminCacheClient failed reads', () => {
  beforeEach(() => mocks.listScopeAssignmentsAction.mockReset());

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
});
