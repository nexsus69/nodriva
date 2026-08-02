'use client';

import { useSession } from 'next-auth/react';
import { useEffect } from 'react';
import { AppCache } from '../../cache/GlobalCacheClient';

export function SessionCacheSynchronizer() {
  const { data: session, update } = useSession();

  useEffect(() => {
    const currentUserId = session?.userId;
    if (!currentUserId) return;
    return AppCache.users.bindSessionRefresh(async (userId: string) => {
      if (userId === currentUserId) await update();
    });
  }, [session?.userId, update]);

  return null;
}
