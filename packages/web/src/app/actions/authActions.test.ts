/** Verifies that a temporary throttle reaches the login form as a safe, distinct outcome. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginRateLimitCredentialsError } from '../../auth/LoginRateLimitCredentialsError';

const mocks = vi.hoisted(() => ({ signIn: vi.fn(), signOut: vi.fn() }));
vi.mock('../../auth', () => ({ signIn: mocks.signIn, signOut: mocks.signOut }));

import { loginAction } from './authActions';

describe('loginAction', () => {
  beforeEach(() => {
    mocks.signIn.mockReset();
    mocks.signOut.mockReset();
  });

  it('returns a safe rate-limit code rather than generic invalid credentials', async () => {
    mocks.signIn.mockRejectedValue(new LoginRateLimitCredentialsError());

    await expect(loginAction('person@example.test', 'Password123!')).resolves.toEqual({ success: false, errorCode: 'LOGIN_RATE_LIMITED' });
  });
});
