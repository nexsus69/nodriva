import { afterEach, describe, expect, it, vi } from 'vitest';
import { UnauthorizedError } from '@dashboard/core';
import { changeCurrentPasswordAction } from './currentAccountActions';

const mocks = vi.hoisted(() => ({ changePassword: vi.fn(), resolveActorUserId: vi.fn(), signOut: vi.fn() }));
vi.mock('../../server/db', () => ({ currentAccountService: { changePassword: mocks.changePassword } }));
vi.mock('./auth/AuthResolver', () => ({ AuthResolver: { resolveActorUserId: mocks.resolveActorUserId } }));
vi.mock('../../auth', () => ({ signOut: mocks.signOut }));

afterEach(() => { vi.restoreAllMocks(); mocks.changePassword.mockReset(); mocks.resolveActorUserId.mockReset(); mocks.signOut.mockReset(); });

describe('current account password action', () => {
  it('derives the account from the session, never from client input, and clears its session after success', async () => {
    mocks.resolveActorUserId.mockResolvedValue('11111111-1111-4111-8111-111111111111');
    mocks.changePassword.mockResolvedValue(undefined);
    await expect(changeCurrentPasswordAction('OldPassword!123', 'NewPassword!456')).resolves.toEqual({ success: true });
    expect(mocks.changePassword).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111', 'OldPassword!123', 'NewPassword!456');
    expect(mocks.signOut).toHaveBeenCalledWith({ redirect: false });
  });

  it('returns the standard safe error when the current password is rejected', async () => {
    mocks.resolveActorUserId.mockResolvedValue('11111111-1111-4111-8111-111111111111');
    mocks.changePassword.mockRejectedValue(new UnauthorizedError('Current password is invalid.'));
    await expect(changeCurrentPasswordAction('wrong', 'NewPassword!456')).resolves.toMatchObject({ success: false, error: { code: 'AUTH_UNAUTHORIZED' } });
    expect(mocks.signOut).not.toHaveBeenCalled();
  });
});
