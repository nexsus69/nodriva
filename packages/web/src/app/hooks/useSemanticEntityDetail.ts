'use client';

import { useMemo } from 'react';
import { useSemanticView } from './useSemanticView';
import { AppCache } from '../cache/GlobalCacheClient';
import { flattenViewPages } from '../cache/ViewStore';
import type { ClientEntity } from '../types/models';
import { useAppCacheRevision } from './useAppCacheRevision';

export function useSemanticEntityDetail(entityId: string, baseNodeId?: string) {
  const { viewState, refresh, retry, lastFailedAction } = useSemanticView({
    viewType: 'ENTITY_DETAIL',
    entityId,
    baseNodeId
  }, true);

  const isLoading = viewState?.status === 'loading';
  const isError = viewState?.status === 'error';
  const error = viewState?.error;

  const entityTypeId = useMemo(() => {
    if (!viewState) return null;
    const flatItems = flattenViewPages(viewState);
    if (flatItems.length > 0 && flatItems[0].type === 'row') {
      return flatItems[0].entityTypeId || null;
    }
    return null;
  }, [viewState]);

  const cacheRevision = useAppCacheRevision();

  void cacheRevision;
  const entity: ClientEntity | null = entityTypeId
    ? AppCache.getEntityCache(entityTypeId).get(entityId)
    : null;

  return {
    entity,
    isLoading,
    isError,
    error,
    refresh,
    retry,
    lastFailedAction
  };
}
