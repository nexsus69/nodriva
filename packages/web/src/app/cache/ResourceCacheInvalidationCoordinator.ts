import type { ResourceKind } from '@dashboard/core';

export type ResourceCacheChangeType = 'created' | 'updated' | 'moved' | 'deleted' | 'restored';

/** Semantic cache change consumed by both local mutations and realtime events. */
export interface ResourceCacheChange {
  resourceType: Extract<ResourceKind, 'node' | 'entity'>;
  resourceId: string;
  changeType: ResourceCacheChangeType;
  entityTypeId?: string;
  affectedResourceIds?: readonly string[];
}

export interface ResourceCacheInvalidationSink {
  removeNode(resourceId: string): void;
  removeEntity(resourceTypeId: string, resourceId: string): void;
  invalidateNodeChildren(): void;
  invalidateNodeHierarchy(): void;
  invalidateEntityMembership(): void;
  invalidateNodeReference(resourceId: string): void;
  invalidateEntityReference(entityTypeId: string, resourceId: string): void;
}

/**
 * Applies the cache effects of a resource mutation in one place.
 *
 * Callers provide the semantic change only; they must not know whether the
 * normalized kernel or the windowed view store needs invalidation.
 */
export class ResourceCacheInvalidationCoordinator {
  public constructor(private readonly sink: ResourceCacheInvalidationSink) {}

  public apply(change: ResourceCacheChange): void {
    if (change.resourceType === 'entity') {
      if (change.changeType === 'deleted' && change.entityTypeId) {
        this.sink.removeEntity(change.entityTypeId, change.resourceId);
        this.sink.invalidateEntityReference(change.entityTypeId, change.resourceId);
      }
      // Entity projections contain both membership and row data. Invalidating
      // membership is intentionally conservative so local and remote updates
      // have the same observable result.
      this.sink.invalidateEntityMembership();
      return;
    }

    if (change.changeType === 'deleted') {
      this.sink.removeNode(change.resourceId);
      this.sink.invalidateNodeReference(change.resourceId);
    }
    this.sink.invalidateNodeChildren();

    if (change.changeType === 'moved'
      || change.changeType === 'updated'
      || change.changeType === 'deleted'
      || change.changeType === 'restored') {
      this.sink.invalidateNodeHierarchy();
    }
    if (change.changeType === 'deleted' || (change.affectedResourceIds?.length ?? 0) > 1) {
      this.sink.invalidateEntityMembership();
    }
  }
}
