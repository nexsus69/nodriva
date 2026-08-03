'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { useSession } from 'next-auth/react';
import { AppCache } from '../cache/GlobalCacheClient';

interface LockIndicatorProps {
  resourceType: 'node' | 'entity';
  resourceId: string;
  className?: string;
}

function LockIcon({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 10V8a5 5 0 0110 0v2m-9 0h8a2 2 0 012 2v7a2 2 0 01-2 2H8a2 2 0 01-2-2v-7a2 2 0 012-2z" />
    </svg>
  );
}

export function LockIndicator({ resourceType, resourceId, className = '' }: LockIndicatorProps) {
  const { data: session } = useSession();
  const currentUserId = (session as { userId?: string } | null)?.userId;
  const subscribe = useCallback(
    (onStoreChange: () => void) =>
      AppCache.subscribeLock(resourceType, resourceId, onStoreChange),
    [resourceId, resourceType]
  );
  const getSnapshot = useCallback(
    () => AppCache.getLockState(resourceType, resourceId),
    [resourceId, resourceType]
  );
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    void AppCache.hydrateLockState(resourceType, resourceId);
  }, [resourceId, resourceType]);

  if (!state.locked) return null;

  const mine = !!currentUserId && state.byUserId === currentUserId;
  return (
    <span
      className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md align-middle ${className} ${mine ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-600'}`}
      title={mine ? 'Elemento bloccato da te' : 'Elemento bloccato da un altro utente'}
      aria-label={mine ? 'Elemento bloccato da te' : 'Elemento bloccato da un altro utente'}
    >
      <LockIcon className="h-3.5 w-3.5" />
    </span>
  );
}
