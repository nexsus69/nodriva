'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { AppCache, CachedLockState } from '../cache/GlobalCacheClient';

interface LockIndicatorProps {
  resourceType: 'node' | 'entity';
  resourceId: string;
}

function LockIcon({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 10V8a5 5 0 0110 0v2m-9 0h8a2 2 0 012 2v7a2 2 0 01-2 2H8a2 2 0 01-2-2v-7a2 2 0 012-2z" />
    </svg>
  );
}

export function LockIndicator({ resourceType, resourceId }: LockIndicatorProps) {
  const { data: session } = useSession();
  const currentUserId = (session as { userId?: string } | null)?.userId;
  const [state, setState] = useState<CachedLockState>(() =>
    AppCache.getLockState(resourceType, resourceId)
  );

  useEffect(() => {
    setState(AppCache.getLockState(resourceType, resourceId));
    const unsubscribe = AppCache.subscribeLock(resourceType, resourceId, setState);
    const releaseRealtime = AppCache.retainLockResource(resourceType, resourceId);
    return () => {
      unsubscribe();
      releaseRealtime();
    };
  }, [resourceId, resourceType]);

  if (!state.locked) return <span className="w-5" aria-hidden="true" />;

  const mine = !!currentUserId && state.byUserId === currentUserId;
  return (
    <span
      className={`inline-flex h-7 w-7 items-center justify-center rounded-lg ${mine ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-600'}`}
      title={mine ? 'Elemento bloccato da te' : 'Elemento bloccato da un altro utente'}
      aria-label={mine ? 'Elemento bloccato da te' : 'Elemento bloccato da un altro utente'}
    >
      <LockIcon className="h-4 w-4" />
    </span>
  );
}
