/** Exercises safe user-cache mutation outcome propagation. */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ listUsersPageAction: vi.fn(), resetUserPasswordAction: vi.fn() }));
vi.mock('../actions/userActions', () => ({
  listUsersPageAction: mocks.listUsersPageAction,
  resetUserPasswordAction: mocks.resetUserPasswordAction,
}));

import { CacheKernel } from './CacheKernel';
import { UserCacheClient } from './UserCacheClient';

describe('UserCacheClient paged catalogue', () => {
  beforeEach(() => {
    mocks.listUsersPageAction.mockReset();
    mocks.resetUserPasswordAction.mockReset();
  });

  it('preserves the backend password-reset rejection for the form to display', async () => {
    mocks.resetUserPasswordAction.mockResolvedValue({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'La password non rispetta i requisiti indicati.' },
    });
    const client = new UserCacheClient(new CacheKernel(), () => undefined);

    await expect(client.resetUserPassword({
      userId: '11111111-1111-4111-8111-111111111111',
      newPassword: 'Password123456',
      expectedRowVersion: 1,
    })).rejects.toThrow('La password non rispetta i requisiti indicati.');
  });

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
