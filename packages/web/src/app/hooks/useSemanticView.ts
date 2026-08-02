import { useState, useEffect, useCallback, useRef } from 'react';
import { GlobalViewStore, ViewState, getViewHasMoreForward, getViewHasMoreBackward } from '../cache/ViewStore';
import { ViewResolver } from '../cache/CacheService';
import { ViewKeyBuilder, SemanticViewKeyParams } from '../cache/SemanticViewKey';
import { GlobalPolicyRegistry } from '../cache/PolicyRegistry';
import { AppCache } from '../cache/GlobalCacheClient';
import type { RetentionClass } from '../cache/PolicyRegistry';

export function useSemanticView(
  params: SemanticViewKeyParams,
  requireComplete: boolean = false,
  retentionClass: RetentionClass = 'sticky'
) {
  const viewKey = ViewKeyBuilder.build(params);
  
  const [viewState, setViewState] = useState<ViewState | null>(() => GlobalViewStore.get(viewKey));
  const [lastFailedAction, setLastFailedAction] = useState<'initial' | 'forward' | 'backward' | null>(null);
  const [isLoadingMoreForward, setIsLoadingMoreForward] = useState(false);
  const [isLoadingMoreBackward, setIsLoadingMoreBackward] = useState(false);

  // Guard sincroni ref-based: immuni al React batching.
  const isExtendingForwardRef = useRef(false);
  const isExtendingBackwardRef = useRef(false);

  // Ref stabile per params: evita che l'oggetto inline nell'effect deps
  // causi re-run infiniti dell'effect (nuovo reference ad ogni render).
  // viewKey codifica già tutta l'informazione semantica di params.
  const paramsRef = useRef(params);
  useEffect(() => {
    paramsRef.current = params;
  }, [params]);

  useEffect(() => {
    const unsubscribe = GlobalViewStore.subscribe(viewKey, (newState) => {
      setViewState(newState);
      if (newState?.status === 'success') {
        setLastFailedAction(null);
      }
    });

    const ownerId =
      retentionClass === 'persistent'
        ? `persistent:${viewKey}`
        : `useSemanticView_${viewKey}_${Math.random().toString(36).substring(7)}`;
    GlobalPolicyRegistry.retain('view', viewKey, ownerId, retentionClass);

    ViewResolver.resolve({
      type: 'resolve',
      params: paramsRef.current,
      requireComplete
    }).catch(() => {
      setLastFailedAction('initial');
    });

    return () => {
      unsubscribe();
      // Persistent views are session-scoped and are cleared by AppCache.purgeAll
      // on logout/identity changes, not by a component or collapsed tree branch.
      if (retentionClass !== 'persistent') {
        GlobalPolicyRegistry.release('view', viewKey, ownerId);
      }
    };
  }, [viewKey, requireComplete, retentionClass]);

  const loadMoreForward = useCallback(async (onBeforeUpdateDOM?: () => void) => {
    if (isExtendingForwardRef.current) return;

    const currentState = GlobalViewStore.get(viewKey);
    if (!currentState || !getViewHasMoreForward(currentState)) return;
    
    isExtendingForwardRef.current = true;
    setIsLoadingMoreForward(true);
    setLastFailedAction(null);
    try {
      onBeforeUpdateDOM?.();
      await ViewResolver.resolve({
        type: 'extend',
        params: paramsRef.current,
        requireComplete,
        direction: 'forward'
      });
    } catch {
      setLastFailedAction('forward');
    } finally {
      isExtendingForwardRef.current = false;
      setIsLoadingMoreForward(false);
    }
  }, [viewKey, requireComplete]);

  const loadMoreBackward = useCallback(async (onBeforeUpdateDOM?: () => void) => {
    if (isExtendingBackwardRef.current) return;

    const currentState = GlobalViewStore.get(viewKey);
    if (!currentState || !getViewHasMoreBackward(currentState)) return;

    isExtendingBackwardRef.current = true;
    setIsLoadingMoreBackward(true);
    setLastFailedAction(null);
    try {
      onBeforeUpdateDOM?.();
      await ViewResolver.resolve({
        type: 'extend',
        params: paramsRef.current,
        requireComplete,
        direction: 'backward'
      });
    } catch {
      setLastFailedAction('backward');
    } finally {
      isExtendingBackwardRef.current = false;
      setIsLoadingMoreBackward(false);
    }
  }, [viewKey, requireComplete]);

  const refresh = useCallback(() => {
    setLastFailedAction(null);
    void ViewResolver.resolve({
      type: 'resolve',
      params: paramsRef.current,
      requireComplete,
    }).catch(() => {
      setLastFailedAction('initial');
    });
  }, [requireComplete]);

  const retry = useCallback(() => {
    if (lastFailedAction === 'initial') refresh();
    else if (lastFailedAction === 'forward') loadMoreForward();
    else if (lastFailedAction === 'backward') loadMoreBackward();
  }, [lastFailedAction, refresh, loadMoreForward, loadMoreBackward]);

  useEffect(() => {
    const realtimeResource =
      (params.viewType === 'SUBTREE_LIST' ||
        params.viewType === 'NODE_ENTITY_COLLECTION' ||
        params.viewType === 'ENTITY_DETAIL') &&
      params.baseNodeId
        ? { resourceType: 'node' as const, resourceId: params.baseNodeId }
        : null;

    if (!realtimeResource) return;
    return AppCache.retainRealtimeResource(
      realtimeResource.resourceType,
      realtimeResource.resourceId,
      (event) => {
        // Un aggiornamento di un'entità viene già applicato alla cache
        // normalizzata. Se l'entità non è nella finestra corrente, non serve
        // ricaricare l'intera vista.
        if (event.changeType === 'updated') return;
        refresh();
      }
    );
  }, [params.baseNodeId, params.entityId, params.viewType, refresh]);

  return {
    viewKey,
    viewState,
    isLoadingMoreForward,
    isLoadingMoreBackward,
    loadMoreForward,
    loadMoreBackward,
    refresh,
    retry,
    lastFailedAction
  };
}
