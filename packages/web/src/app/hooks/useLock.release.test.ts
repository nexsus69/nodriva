/** Reproduces explicit release while a delayed cache snapshot temporarily hides ownership. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useLock } from './useLock';
import { releaseLockAction } from '../actions/lockActions';
import { AppCache } from '../cache/GlobalCacheClient';

vi.mock('react', () => ({
  useCallback: (callback: unknown) => callback,
  useEffect: () => undefined,
  useMemo: (callback: () => unknown) => callback(),
  useRef: (current: unknown) => ({ current }),
  useState: () => [undefined, vi.fn()],
  useSyncExternalStore: (_subscribe: unknown, get: () => unknown) => get(),
  useTransition: () => [false, (callback: () => void) => callback()],
}));
vi.mock('next-auth/react', () => ({ useSession: () => ({ data: { userId: 'user', activitySessionId: 'session' } }) }));
vi.mock('../actions/lockActions', () => ({ acquireLockAction: vi.fn(), releaseLockAction: vi.fn() }));
vi.mock('../cache/GlobalCacheClient', () => ({ AppCache: { getLockState: () => ({ locked: false }), setLockState: vi.fn() } }));
vi.mock('../activity/ActivityProvider', () => ({ useHumanActivity: () => ({ registerActiveLock: vi.fn() }) }));
vi.mock('../mutations/useUserMutation', () => ({ useUserMutation: () => ({ failure: null, execute: async (work: () => Promise<void>) => { try { await work(); return { ok: true }; } catch { return { ok: false }; } } }) }));

describe('explicit lock release', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('sends the release even when the local cache and ownership ref are empty', async () => {
    vi.mocked(releaseLockAction).mockResolvedValue({ success: true });
    const lock = useLock({ resourceType: 'node', resourceId: 'node' });
    expect(lock.isMyLock).toBe(false);
    await lock.releaseLock();
    expect(releaseLockAction).toHaveBeenCalledWith('node', 'node');
    expect(AppCache.setLockState).toHaveBeenCalledWith('node', 'node', { locked: false });
  });

  it('does not publish a successful local release when the backend rejects another session', async () => {
    vi.mocked(releaseLockAction).mockResolvedValue({ success: false, details: { code: 'LOCK_FORBIDDEN' } } as never);
    await useLock({ resourceType: 'entity', resourceId: 'entity' }).releaseLock();
    expect(releaseLockAction).toHaveBeenCalledWith('entity', 'entity');
    expect(AppCache.setLockState).not.toHaveBeenCalled();
  });
});
