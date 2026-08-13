import { describe, expect, it, vi } from 'vitest';
import { UnauthorizedError } from '@dashboard/core';
import type { JWT } from 'next-auth/jwt';
import { reconcileDatabaseSessionToken, type DatabaseSessionIdentityService } from './authSessionToken';

const storedToken: JWT = {
  userId: 'user-1',
  dbToken: 'opaque-token',
  dbSessionId: 'session-1',
  email: 'old@example.test',
};

function service(): DatabaseSessionIdentityService {
  return {
    resolveSession: vi.fn().mockResolvedValue('user-1'),
    getUserById: vi.fn().mockResolvedValue({ email: 'current@example.test' }),
  };
}

describe('reconcileDatabaseSessionToken', () => {
  it('stores the database token and session identity after login', async () => {
    const result = await reconcileDatabaseSessionToken({}, {
      id: 'user-1',
      email: 'user@example.test',
      dbToken: 'opaque-token',
      dbSessionId: 'session-1',
    }, service());

    expect(result).toMatchObject({
      userId: 'user-1',
      dbToken: 'opaque-token',
      dbSessionId: 'session-1',
      email: 'user@example.test',
    });
  });

  it('refreshes claims while the database session is valid', async () => {
    const result = await reconcileDatabaseSessionToken(storedToken, undefined, service());

    expect(result).toEqual({ ...storedToken, email: 'current@example.test' });
  });

  it('removes database identity only for an explicitly expired session', async () => {
    const sessions = service();
    vi.mocked(sessions.resolveSession).mockRejectedValue(new UnauthorizedError('Session expired'));

    const result = await reconcileDatabaseSessionToken(storedToken, undefined, sessions);

    expect(result.userId).toBeUndefined();
    expect(result.dbToken).toBeUndefined();
    expect(result.dbSessionId).toBeUndefined();
  });

  it('retains signed claims during a temporary infrastructure failure', async () => {
    const sessions = service();
    const failure = new Error('database unavailable');
    const report = vi.fn();
    vi.mocked(sessions.resolveSession).mockRejectedValue(failure);

    const result = await reconcileDatabaseSessionToken(storedToken, undefined, sessions, report);

    expect(result).toBe(storedToken);
    expect(report).toHaveBeenCalledWith(failure);
  });

  it('recovers on the next request after a temporary failure', async () => {
    const sessions = service();
    vi.mocked(sessions.resolveSession)
      .mockRejectedValueOnce(new Error('database unavailable'))
      .mockResolvedValueOnce('user-1');

    const retained = await reconcileDatabaseSessionToken(storedToken, undefined, sessions, vi.fn());
    const recovered = await reconcileDatabaseSessionToken(retained, undefined, sessions, vi.fn());

    expect(recovered).toEqual({ ...storedToken, email: 'current@example.test' });
  });

  it('removes stale identity when the authenticated user no longer exists', async () => {
    const sessions = service();
    vi.mocked(sessions.getUserById).mockResolvedValue(null);

    const result = await reconcileDatabaseSessionToken(storedToken, undefined, sessions);

    expect(result.userId).toBeUndefined();
    expect(result.dbToken).toBeUndefined();
    expect(result.dbSessionId).toBeUndefined();
  });
});
