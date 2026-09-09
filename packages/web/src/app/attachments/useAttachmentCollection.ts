'use client';

/** Owns one authorized attachment collection and reconciles targeted cache notifications. */

import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { AppCache } from '../cache/GlobalCacheClient';
import {
  deleteResourceAttachment,
  listResourceAttachments,
  type AttachmentItem,
} from './attachmentClient';
import {
  beginAttachmentDeletion,
  beginAttachmentRefresh,
  completeAttachmentDeletion,
  failAttachmentDeletion,
  failAttachmentRefresh,
  receiveAttachmentCollection,
} from './attachmentCollectionModel';

export interface AttachmentCollectionTarget {
  resourceType: 'node' | 'entity';
  resourceId: string;
  fieldKey: string;
  kind: 'file' | 'image';
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function useAttachmentCollection(target: AttachmentCollectionTarget) {
  const cacheTarget = useMemo(() => ({
    resourceType: target.resourceType,
    resourceId: target.resourceId,
    fieldKey: target.fieldKey,
    kind: target.kind,
  } as const), [target.fieldKey, target.kind, target.resourceId, target.resourceType]);
  const resourceTarget = useMemo(() => ({
    resourceType: target.resourceType,
    resourceId: target.resourceId,
  } as const), [target.resourceId, target.resourceType]);
  const requestVersion = useRef(0);
  const subscribe = useCallback(
    (subscriber: () => void) => AppCache.subscribeAttachmentCollection(cacheTarget, subscriber),
    [cacheTarget],
  );
  const getSnapshot = useCallback(
    () => AppCache.getAttachmentCollection(cacheTarget),
    [cacheTarget],
  );
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const refresh = useCallback(async () => {
    const version = ++requestVersion.current;
    AppCache.setAttachmentCollection(cacheTarget, beginAttachmentRefresh(AppCache.getAttachmentCollection(cacheTarget)));
    try {
      const items = await listResourceAttachments(target.resourceType, target.resourceId, target.fieldKey, target.kind);
      if (requestVersion.current !== version) return;
      AppCache.setAttachmentCollection(cacheTarget, receiveAttachmentCollection(items));
    } catch (error) {
      if (requestVersion.current !== version) return;
      AppCache.setAttachmentCollection(
        cacheTarget,
        failAttachmentRefresh(AppCache.getAttachmentCollection(cacheTarget), errorMessage(error, 'Impossibile caricare gli allegati.')),
      );
    }
  }, [cacheTarget, target.fieldKey, target.kind, target.resourceId, target.resourceType]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => AppCache.subscribeAttachmentCollectionInvalidation(resourceTarget, () => {
    void refresh();
  }), [refresh, resourceTarget]);

  const remove = useCallback(async (attachment: AttachmentItem) => {
    requestVersion.current += 1;
    AppCache.setAttachmentCollection(cacheTarget, beginAttachmentDeletion(AppCache.getAttachmentCollection(cacheTarget), attachment.id));
    try {
      await deleteResourceAttachment({
        id: attachment.id,
        resourceType: target.resourceType,
        resourceId: target.resourceId,
      });
      AppCache.setAttachmentCollection(cacheTarget, completeAttachmentDeletion(AppCache.getAttachmentCollection(cacheTarget), attachment.id));
    } catch (error) {
      AppCache.setAttachmentCollection(
        cacheTarget,
        failAttachmentDeletion(AppCache.getAttachmentCollection(cacheTarget), attachment.id, errorMessage(error, 'Impossibile eliminare l’allegato.')),
      );
    }
  }, [cacheTarget, target.resourceId, target.resourceType]);

  return { ...state, refresh, remove };
}
