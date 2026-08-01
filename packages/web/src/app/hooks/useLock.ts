'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Pusher from 'pusher-js';
import {
  acquireLockAction,
  refreshLockAction,
  releaseLockAction,
} from '../actions/lockActions';

type LockResourceType = 'node' | 'entity';

interface UseLockProps {
  resourceType: LockResourceType;
  resourceId: string;
}

interface LockEvent {
  userId: string;
}

export function useLock({ resourceType, resourceId }: UseLockProps) {
  const [isMyLock, setIsMyLock] = useState(false);
  const [lockedByOther, setLockedByOther] = useState<{ locked: boolean; byUserId?: string }>({
    locked: false,
  });
  const [error, setError] = useState<string | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ownsLockRef = useRef(false);

  const stopRefreshTimer = useCallback(() => {
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  }, []);

  const startRefreshTimer = useCallback(() => {
    stopRefreshTimer();
    refreshTimerRef.current = setInterval(async () => {
      const result = await refreshLockAction(resourceType, resourceId);
      if (!result.success) {
        stopRefreshTimer();
        ownsLockRef.current = false;
        setIsMyLock(false);
        setError(result.message || 'Il lock di modifica è scaduto.');
      }
    }, 60_000);
  }, [resourceId, resourceType, stopRefreshTimer]);

  const acquireLock = useCallback(async (): Promise<boolean> => {
    setError(null);
    setLockedByOther({ locked: false });
    const result = await acquireLockAction(resourceType, resourceId);
    if (!result.success) {
      setLockedByOther({ locked: result.error === 'LOCK_CONFLICT' });
      setError(result.message || 'Impossibile entrare in modalità modifica.');
      return false;
    }

    ownsLockRef.current = true;
    setIsMyLock(true);
    startRefreshTimer();
    return true;
  }, [resourceId, resourceType, startRefreshTimer]);

  const releaseLock = useCallback(async (): Promise<void> => {
    if (!ownsLockRef.current) return;
    const result = await releaseLockAction(resourceType, resourceId);
    if (!result.success) {
      setError(result.message || 'Impossibile rilasciare il lock.');
      return;
    }

    ownsLockRef.current = false;
    setIsMyLock(false);
    setLockedByOther({ locked: false });
    stopRefreshTimer();
  }, [resourceId, resourceType, stopRefreshTimer]);

  // Pusher exists only while this client owns an edit lock.
  useEffect(() => {
    if (!isMyLock || !process.env.NEXT_PUBLIC_PUSHER_KEY) return;

    const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'mt1',
      wsHost: process.env.NEXT_PUBLIC_PUSHER_HOST,
      wsPort: process.env.NEXT_PUBLIC_PUSHER_PORT
        ? Number.parseInt(process.env.NEXT_PUBLIC_PUSHER_PORT, 10)
        : undefined,
      forceTLS: process.env.NEXT_PUBLIC_PUSHER_SCHEME === 'https',
      enableStats: false,
      enabledTransports: ['ws', 'wss'],
      channelAuthorization: {
        endpoint: '/api/pusher/auth',
        transport: 'ajax',
      },
    });

    const channelName = `private-locks-${resourceType}-${resourceId}`;
    const channel = pusher.subscribe(channelName);
    channel.bind('lock:acquired', (event: LockEvent) => {
      if (!ownsLockRef.current) {
        setLockedByOther({ locked: true, byUserId: event.userId });
      }
    });
    channel.bind('lock:force-released', () => {
      ownsLockRef.current = false;
      setIsMyLock(false);
      stopRefreshTimer();
      setError('Il lock è stato rilasciato da un amministratore.');
    });

    return () => {
      channel.unbind_all();
      pusher.unsubscribe(channelName);
      pusher.disconnect();
    };
  }, [isMyLock, resourceId, resourceType, stopRefreshTimer]);

  useEffect(() => {
    return () => {
      stopRefreshTimer();
      if (ownsLockRef.current) {
        ownsLockRef.current = false;
        void releaseLockAction(resourceType, resourceId);
      }
    };
  }, [resourceId, resourceType, stopRefreshTimer]);

  return {
    lockedByOther,
    isMyLock,
    error,
    acquireLock,
    releaseLock,
  };
}
