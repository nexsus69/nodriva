/** Applies received realtime messages through explicit cache-effect ports. */
import type { RealtimeDataChangedEvent } from '@dashboard/core';
import type { LockChannelEvent } from './RealtimeCacheBridge';
import type { ResourceCacheChange } from './ResourceCacheInvalidationCoordinator';
import type { CachedLockState } from './LockStateStore';

export interface RealtimeEventApplierPorts {
  isLocalEvent(event: RealtimeDataChangedEvent): boolean;
  invalidateMetadata(kind: 'node' | 'entity'): void;
  notifyAttachmentResourceChanged(target: { resourceType: 'node' | 'entity'; resourceId: string }): void;
  invalidateNode(resourceId: string): void;
  invalidateEntityReference(entityTypeId: string, resourceId: string): void;
  notifyCacheChanged(): void;
  purgeUsers(): void;
  invalidateAdmin(keys: readonly string[]): void;
  injectEntity(entityTypeId: string, resourceId: string, data: unknown): void;
  injectNode(resourceId: string, data: unknown): void;
  applyResourceChange(change: ResourceCacheChange): void;
  getLock(resourceType: LockChannelEvent['resourceType'], resourceId: string): CachedLockState;
  setLock(resourceType: LockChannelEvent['resourceType'], resourceId: string, state: CachedLockState): void;
}

/**
 * Maps authoritative realtime messages to cache effects. It deliberately has
 * no knowledge of Pusher, HTTP synchronization, or cache implementations.
 */
export class RealtimeEventApplier {
  public constructor(private readonly ports: RealtimeEventApplierPorts) {}

  public applyLock(
    eventName: 'lock:acquired' | 'lock:released' | 'lock:force-released',
    event: LockChannelEvent,
  ): void {
    if (eventName === 'lock:acquired') {
      this.ports.setLock(event.resourceType, event.resourceId, {
        locked: true,
        byUserId: event.userId,
        bySessionId: event.sessionId,
        expiresAt: event.expiresAt,
      });
      return;
    }
    if (eventName === 'lock:force-released') {
      this.ports.setLock(event.resourceType, event.resourceId, { locked: false });
      return;
    }
    const current = this.ports.getLock(event.resourceType, event.resourceId);
    // A delayed release from an older session must not erase a newer lock.
    if (!event.sessionId || current.bySessionId === event.sessionId) {
      this.ports.setLock(event.resourceType, event.resourceId, { locked: false });
    }
  }

  public applyDataChanged(event: RealtimeDataChangedEvent): void {
    if (this.ports.isLocalEvent(event)) return;
    if (event.metadataKind) {
      this.ports.invalidateMetadata(event.metadataKind);
      return;
    }
    if (event.subresourceKind === 'attachment') {
      this.applyAttachmentChanged(event);
      return;
    }
    if (event.resourceType !== 'node' && event.resourceType !== 'entity') {
      this.applyAdministrativeChange(event.resourceType);
      this.ports.notifyCacheChanged();
      return;
    }
    if (event.resourceType === 'entity') {
      this.applyEntityChanged(event);
      return;
    }
    this.applyNodeChanged(event);
  }

  private applyAttachmentChanged(event: RealtimeDataChangedEvent): void {
    if (event.resourceType !== 'node' && event.resourceType !== 'entity') return;
    this.ports.notifyAttachmentResourceChanged({ resourceType: event.resourceType, resourceId: event.resourceId });
    if (event.resourceType === 'node') this.ports.invalidateNode(event.resourceId);
    else if (event.entityTypeId) this.ports.invalidateEntityReference(event.entityTypeId, event.resourceId);
    this.ports.notifyCacheChanged();
  }

  private applyAdministrativeChange(resourceType: Exclude<RealtimeDataChangedEvent['resourceType'], 'node' | 'entity'>): void {
    switch (resourceType) {
      case 'user':
        this.ports.purgeUsers();
        this.ports.invalidateAdmin(['users']);
        break;
      case 'role':
        this.ports.invalidateAdmin(['roles', 'role']);
        break;
      case 'scope':
        this.ports.invalidateAdmin(['scope-assignments']);
        break;
      case 'audit':
        this.ports.invalidateAdmin(['audit', 'deleted-nodes', 'deleted-entities']);
        break;
      case 'system':
        this.ports.invalidateAdmin([
          'capabilities', 'settings', 'workflow-definitions', 'workflow-event-types', 'workflow-action-types',
        ]);
        break;
      case 'placement_policy':
        this.ports.invalidateAdmin(['placement-policies', 'placement-policy']);
        break;
      case 'node_type':
        this.ports.invalidateMetadata('node');
        break;
      case 'entity_type':
        this.ports.invalidateMetadata('entity');
        break;
    }
  }

  private applyEntityChanged(event: RealtimeDataChangedEvent): void {
    const entityTypeId = event.entityTypeId;
    if (entityTypeId && event.changeType !== 'deleted' && event.data) {
      this.ports.injectEntity(entityTypeId, event.resourceId, event.data);
    }
    this.ports.applyResourceChange({
      resourceType: 'entity', resourceId: event.resourceId, changeType: event.changeType,
      entityTypeId, affectedResourceIds: event.affectedResourceIds,
    });
    this.ports.invalidateAdmin(['subtree-entities', 'admin-entities-page']);
  }

  private applyNodeChanged(event: RealtimeDataChangedEvent): void {
    const ids = event.affectedResourceIds?.length ? event.affectedResourceIds : [event.resourceId];
    if (event.changeType !== 'deleted' && event.data) this.ports.injectNode(event.resourceId, event.data);
    for (const id of ids) {
      if (id !== event.resourceId) this.ports.invalidateNode(id);
    }
    this.ports.applyResourceChange({
      resourceType: 'node', resourceId: event.resourceId, changeType: event.changeType, affectedResourceIds: ids,
    });
    this.ports.invalidateAdmin(['children', 'subtree-entities', 'admin-nodes-page', 'admin-entities-page']);
  }
}
