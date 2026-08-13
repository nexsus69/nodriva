import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenError, UnauthorizedError } from '@dashboard/core';

const mocks = vi.hoisted(() => ({
  resolveActorUserId: vi.fn(),
  assertHasPermission: vi.fn(),
}));

vi.mock('../../server/db', () => ({
  accessControlPort: { assertHasPermission: mocks.assertHasPermission },
}));

vi.mock('./auth/AuthResolver', () => ({
  AuthResolver: { resolveActorUserId: mocks.resolveActorUserId },
}));

import { checkAdminAccessAction } from './adminAccessActions';

describe('checkAdminAccessAction', () => {
  beforeEach(() => {
    mocks.resolveActorUserId.mockReset();
    mocks.assertHasPermission.mockReset();
    mocks.resolveActorUserId.mockResolvedValue('actor-1');
  });

  it('allows access when any administrative permission is granted', async () => {
    mocks.assertHasPermission
      .mockRejectedValueOnce(new ForbiddenError())
      .mockResolvedValueOnce(undefined);

    await expect(checkAdminAccessAction()).resolves.toBe(true);
    expect(mocks.assertHasPermission).toHaveBeenCalledTimes(2);
  });

  it('denies access when every administrative permission is refused', async () => {
    mocks.assertHasPermission.mockRejectedValue(new ForbiddenError());

    await expect(checkAdminAccessAction()).resolves.toBe(false);
    expect(mocks.assertHasPermission).toHaveBeenCalledTimes(5);
  });

  it('denies access when the session is not authenticated', async () => {
    mocks.resolveActorUserId.mockRejectedValue(new UnauthorizedError());

    await expect(checkAdminAccessAction()).resolves.toBe(false);
    expect(mocks.assertHasPermission).not.toHaveBeenCalled();
  });

  it('propagates infrastructure failures instead of reporting access denied', async () => {
    const databaseError = new Error('database unavailable');
    mocks.assertHasPermission.mockRejectedValue(databaseError);

    await expect(checkAdminAccessAction()).rejects.toBe(databaseError);
    expect(mocks.assertHasPermission).toHaveBeenCalledTimes(1);
  });

  it('propagates unexpected authentication failures', async () => {
    const authenticationFailure = new Error('session store unavailable');
    mocks.resolveActorUserId.mockRejectedValue(authenticationFailure);

    await expect(checkAdminAccessAction()).rejects.toBe(authenticationFailure);
  });
});
