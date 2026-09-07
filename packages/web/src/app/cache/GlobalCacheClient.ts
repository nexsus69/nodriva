/** Coordinates browser-side canonical caches, view invalidation and mutations. */
import { ClientNode, ClientEntity } from '../types/models';
import { createNodeAction, updateNodeAction, moveNodeAction, deleteNodeAction } from '../actions/nodeActions';
import { createEntityAction, updateEntityAction, deleteEntityAction } from '../actions/entityActions';
import { getLockStateAction } from '../actions/lockActions';
import { GlobalViewStore, VIEW_DEPENDENCIES, type CacheRecordReference } from './ViewStore';
import { ViewKeyBuilder } from './SemanticViewKey';
import { GlobalPolicyRegistry } from './PolicyRegistry';
import { RealtimeCacheBridge } from './RealtimeCacheBridge';
import type { RealtimeDataChangedEvent, ResourceKind } from '@dashboard/core';
import type {
  LockChannelEvent,
  RealtimeDebugEvent,
  RealtimeConnectionState,
} from './RealtimeCacheBridge';
import { UserCacheClient } from './UserCacheClient';
import { AdminCacheClient } from './AdminCacheClient';
import { CacheKernel, type RecordSatisfaction } from './CacheKernel';
import { MetadataCacheClient } from './MetadataCacheClient';
import { KernelNodeCacheClient } from './KernelNodeCacheClient';
import { KernelEntityCacheClient } from './KernelEntityCacheClient';
import { KernelListCacheClient } from './KernelListCacheClient';
import { reconcileMetadataBestEffort } from './metadataReconciliation';
import { ResourceMutationCoordinator } from './ResourceMutationCoordinator';
import {
  ResourceCacheInvalidationCoordinator,
  type ResourceCacheChange,
} from './ResourceCacheInvalidationCoordinator';

export interface CachedLockState {
  locked: boolean;
  byUserId?: string;
  bySessionId?: string;
  expiresAt?: string;
}

const EMPTY_LOCK_STATE: CachedLockState = { locked: false };

export interface CreateNodeInput {
  parentNodeId: string | null;
  nodeTypeKey: string;
  name: string;
  description?: string;
  payload?: Record<string, unknown>;
}

export interface UpdateNodeInput {
  nodeId: string;
  name?: string;
  description?: string;
  expectedRowVersion: number;
  payloadDelta?: Record<string, unknown>;
}

export interface MoveNodeInput {
  nodeId: string;
  newParentNodeId: string | null;
  expectedNodeRowVersion: number;
}

export interface CreateEntityInput {
  parentNodeId: string;
  entityTypeKey?: string;
  entityTypeId?: string;
  name: string;
  description?: string;
  payload?: Record<string, unknown>;
}

export interface UpdateEntityInput {
  entityId: string;
  name?: string;
  description?: string;
  expectedRowVersion: number;
  payloadDelta?: Record<string, unknown>;
}

function actionError(error: { code: string; message: string; details?: unknown }): Error {
  return Object.assign(new Error(error.message), error);
}

export function isRowVersionMismatch(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'ROW_VERSION_MISMATCH';
}

/** Prevents submitting an edit whose optimistic-concurrency snapshot is stale. */
export function hasStaleOptimisticEdit(editingRowVersion: number | null, currentRowVersion: number | undefined): boolean {
  return editingRowVersion !== null
    && currentRowVersion !== undefined
    && currentRowVersion !== editingRowVersion;
}

export class GlobalCacheClient {
  private cacheRevision = 0;
  private cacheSubscribers = new Set<() => void>();
  private readonly lockStates = new Map<string, CachedLockState>();
  private readonly lockSubscribers = new Map<string, Set<(state: CachedLockState) => void>>();
  private readonly hydratedLockKeys = new Set<string>();
  private readonly pendingLockHydrations = new Map<string, Promise<void>>();
  private realtimeDebugEvents: RealtimeDebugEvent[] = [];
  public readonly mutations = new ResourceMutationCoordinator();
  private readonly realtimeDebugSubscribers = new Set<(events: RealtimeDebugEvent[]) => void>();
  private realtimeConnectionState: RealtimeConnectionState = 'initialized';
  private realtimeCapabilityEnabled = true;
  private readonly realtimeStateSubscribers = new Set<() => void>();
  private readonly adminRealtimeInvalidationSubscribers = new Set<(keys: readonly string[]) => void>();
  private virtualRootNodeIds = new Set<string>();
  private readonly realtimeBridge = new RealtimeCacheBridge(
    (event) => this.applyRealtimeEvent(event),
    (eventName, event) => this.applyLockEvent(eventName, event),
    (event) => this.recordRealtimeDebugEvent(event),
    (state: RealtimeConnectionState) => {
      if (state === 'connected') {
        reconcileMetadataBestEffort(() => this.reconcileMetadata(), 'realtime connection');
      }
    },
    (gap) => {
      if (gap.stream === 'metadata') {
        reconcileMetadataBestEffort(() => this.reconcileMetadata(), 'realtime metadata gap');
      }
      else this.reconcileResources();
    },
  );

  private recordRealtimeDebugEvent(event: RealtimeDebugEvent): void {
    this.realtimeDebugEvents = [...this.realtimeDebugEvents, event].slice(-200);
    this.realtimeDebugSubscribers.forEach((subscriber) => subscriber(this.realtimeDebugEvents));
  }

  private notifyCacheSubscribers = () => {
    this.cacheRevision += 1;
    this.cacheSubscribers.forEach((subscriber) => subscriber());
  };

  public getRevision = (): number => this.cacheRevision;

  public getCacheEpoch = (): number => this.kernel.getEpoch();

  public getReferenceSatisfaction(reference: CacheRecordReference): RecordSatisfaction {
    if (reference.namespace === 'node') {
      return this.nodes.getSatisfaction(reference.id, reference.completeness);
    }
    if (reference.namespace.startsWith('entity:')) {
      const entityTypeId = reference.namespace.slice('entity:'.length);
      return this.getEntityCache(entityTypeId).getSatisfaction(
        reference.id,
        reference.completeness,
      );
    }
    const metadataNamespace = reference.namespace === 'node-type' ? 'node-type' : 'entity-type';
    return this.kernel.getRecordSatisfaction(
      metadataNamespace,
      reference.id,
      reference.completeness,
    );
  }

  public async hydrateReference(reference: CacheRecordReference): Promise<boolean> {
    if (reference.namespace === 'node') {
      return (await this.nodes.fetchIfMissing(
        reference.id,
        reference.completeness === 'full',
      )) !== null;
    }
    if (reference.namespace.startsWith('entity:')) {
      const entityTypeId = reference.namespace.slice('entity:'.length);
      return (await this.getEntityCache(entityTypeId).fetchIfMissing(
        reference.id,
        reference.completeness === 'full',
      )) !== null;
    }
    if (reference.namespace === 'node-type' || reference.namespace === 'entity-type') {
      const records = reference.namespace === 'node-type'
        ? await this.metadata.list('node')
        : await this.metadata.list('entity');
      return records.some((record) => record.id === reference.id);
    }
    return false;
  }

  public subscribe = (subscriber: () => void): (() => void) => {
    this.cacheSubscribers.add(subscriber);
    return () => this.cacheSubscribers.delete(subscriber);
  };

  public retainRealtimeChannels = (dataChannels: string[], lockChannels: string[]): (() => void) =>
    this.realtimeBridge.retainPolicyChannels(dataChannels, lockChannels);

  public getRealtimeConnectionState = (): RealtimeConnectionState => this.realtimeConnectionState;

  public getRealtimeCapabilityEnabled = (): boolean => this.realtimeCapabilityEnabled;

  public setRealtimeOriginSession = (sessionId: string | null | undefined): void => {
    this.mutations.setOriginSessionId(sessionId);
  };

  public subscribeRealtimeState = (subscriber: () => void): (() => void) => {
    this.realtimeStateSubscribers.add(subscriber);
    return () => this.realtimeStateSubscribers.delete(subscriber);
  };

  /** Lets active admin collections reload only after an authorized realtime invalidation. */
  public subscribeAdminRealtimeInvalidations = (
    subscriber: (keys: readonly string[]) => void,
  ): (() => void) => {
    this.adminRealtimeInvalidationSubscribers.add(subscriber);
    return () => this.adminRealtimeInvalidationSubscribers.delete(subscriber);
  };

  private invalidateAdminFromRealtime(keys: readonly string[]): void {
    this.admin.invalidate([...keys]);
    this.adminRealtimeInvalidationSubscribers.forEach((subscriber) => subscriber(keys));
  }

  public setRealtimeEnabled = (enabled: boolean): void => {
    if (this.realtimeCapabilityEnabled === enabled) return;
    this.realtimeCapabilityEnabled = enabled;
    if (!enabled) this.realtimeConnectionState = 'unavailable';
    this.realtimeStateSubscribers.forEach((subscriber) => subscriber());
  };

  public setVirtualRootNodeIds = (nodeIds: string[]): void => {
    this.virtualRootNodeIds = new Set(nodeIds);
    this.notifyCacheSubscribers();
  };

  public isVirtualRootNode = (nodeId: string): boolean => this.virtualRootNodeIds.has(nodeId);

  public getRealtimeDebugEvents = (): RealtimeDebugEvent[] => this.realtimeDebugEvents;

  public subscribeRealtimeDebug = (subscriber: (events: RealtimeDebugEvent[]) => void): (() => void) => {
    this.realtimeDebugSubscribers.add(subscriber);
    subscriber(this.realtimeDebugEvents);
    return () => this.realtimeDebugSubscribers.delete(subscriber);
  };

  public clearRealtimeDebugEvents = (): void => {
    this.realtimeDebugEvents = [];
    this.realtimeDebugSubscribers.forEach((subscriber) => subscriber(this.realtimeDebugEvents));
  };

  public getLockState(resourceType: ResourceKind, resourceId: string): CachedLockState {
    const state = this.lockStates.get(this.lockKey(resourceType, resourceId));
    if (state?.locked && state.expiresAt && Date.parse(state.expiresAt) <= Date.now()) {
      return EMPTY_LOCK_STATE;
    }
    return state ?? EMPTY_LOCK_STATE;
  }

  public hydrateLockState = (resourceType: ResourceKind, resourceId: string): Promise<void> => {
    const key = this.lockKey(resourceType, resourceId);
    if (this.hydratedLockKeys.has(key)) return Promise.resolve();

    const pending = this.pendingLockHydrations.get(key);
    if (pending) return pending;

    const request = getLockStateAction(resourceType, resourceId)
      .then((state) => {
        const current = this.getLockState(resourceType, resourceId);
        // A realtime event or a local acquisition wins over an older snapshot.
        if (!current.locked || state.locked) {
          this.setLockState(resourceType, resourceId, state);
        }
        this.hydratedLockKeys.add(key);
      })
      .catch(() => {
        // A failed read must not break rendering; realtime can still hydrate it later.
      })
      .finally(() => this.pendingLockHydrations.delete(key));

    this.pendingLockHydrations.set(key, request);
    return request;
  };

  public subscribeLock(
    resourceType: ResourceKind,
    resourceId: string,
    subscriber: (state: CachedLockState) => void
  ): () => void {
    const key = this.lockKey(resourceType, resourceId);
    const subscribers = this.lockSubscribers.get(key) ?? new Set();
    subscribers.add(subscriber);
    this.lockSubscribers.set(key, subscribers);
    return () => {
      const current = this.lockSubscribers.get(key);
      if (!current) return;
      current.delete(subscriber);
      if (current.size === 0) this.lockSubscribers.delete(key);
    };
  }

  public setLockState(
    resourceType: ResourceKind,
    resourceId: string,
    state: CachedLockState
  ): void {
    const key = this.lockKey(resourceType, resourceId);
    const normalized = state.locked ? state : EMPTY_LOCK_STATE;
    this.lockStates.set(key, normalized);
    // Every caller of setLockState has an authoritative snapshot: a list query,
    // a lock mutation, or a realtime event. Marking it hydrated prevents each
    // LockIndicator rendered for a paginated list from issuing a redundant
    // one-resource server action on mount.
    this.hydratedLockKeys.add(key);
    this.lockSubscribers.get(key)?.forEach((subscriber) => subscriber(normalized));
    this.notifyCacheSubscribers();
  }

  private lockKey(resourceType: ResourceKind, resourceId: string): string {
    return `${resourceType}:${resourceId}`;
  }

  private applyLockEvent(
    eventName: 'lock:acquired' | 'lock:released' | 'lock:force-released',
    event: LockChannelEvent
  ): void {
    if (eventName === 'lock:acquired') {
      this.setLockState(event.resourceType, event.resourceId, {
        locked: true,
        byUserId: event.userId,
        bySessionId: event.sessionId,
        expiresAt: event.expiresAt,
      });
    } else if (eventName === 'lock:force-released') {
      this.setLockState(event.resourceType, event.resourceId, { locked: false });
    } else {
      const current = this.getLockState(event.resourceType, event.resourceId);
      // Ignore a delayed release belonging to an older session after another
      // session has already acquired the same resource.
      if (!event.sessionId || current.bySessionId === event.sessionId) {
        this.setLockState(event.resourceType, event.resourceId, { locked: false });
      }
    }
  }

  private applyRealtimeEvent(event: RealtimeDataChangedEvent): void {
    if (this.mutations.isLocalEvent(event)) return;
    if (event.metadataKind) {
      this.invalidateMetadata(event.metadataKind, undefined, true);
      return;
    }
    if (event.subresourceKind === 'attachment') {
      if (event.resourceType === 'node') this.nodes.invalidate(event.resourceId);
      else if (event.entityTypeId) {
        GlobalViewStore.invalidateReference({
          namespace: `entity:${event.entityTypeId}`,
          id: event.resourceId,
        });
      }
      this.notifyCacheSubscribers();
      return;
    }
    if (event.resourceType !== 'node' && event.resourceType !== 'entity') {
      switch (event.resourceType) {
        case 'user':
          this.users.purge();
          this.invalidateAdminFromRealtime(['users']);
          break;
        case 'role':
          this.invalidateAdminFromRealtime(['roles', 'role']);
          break;
        case 'scope':
          this.invalidateAdminFromRealtime(['scope-assignments']);
          break;
        case 'audit':
          this.invalidateAdminFromRealtime(['audit', 'deleted-nodes', 'deleted-entities']);
          break;
        case 'system':
          this.invalidateAdminFromRealtime([
            'capabilities',
            'settings',
            'workflow-definitions',
            'workflow-event-types',
            'workflow-action-types',
          ]);
          break;
        case 'placement_policy':
          this.invalidateAdminFromRealtime(['placement-policies', 'placement-policy']);
          break;
        case 'node_type':
          this.invalidateMetadata('node', undefined, true);
          break;
        case 'entity_type':
          this.invalidateMetadata('entity', undefined, true);
          break;
      }
      this.notifyCacheSubscribers();
      return;
    }
    if (event.resourceType === 'entity') {
      const entityTypeId = event.entityTypeId;
      if (entityTypeId && event.changeType !== 'deleted' && event.data) {
        this.getEntityCache(entityTypeId).inject(
          event.resourceId,
          event.data as ClientEntity,
          false,
          'realtime:data-changed'
        );
      }
      this.applyResourceCacheChange({
        resourceType: 'entity',
        resourceId: event.resourceId,
        changeType: event.changeType,
        entityTypeId,
        affectedResourceIds: event.affectedResourceIds,
      });
      this.invalidateAdminFromRealtime(['subtree-entities']);
    } else {
      const ids = event.affectedResourceIds?.length ? event.affectedResourceIds : [event.resourceId];
      if (event.changeType === 'deleted') {
      } else if (event.data) {
        this.nodes.inject(event.resourceId, event.data as ClientNode, false, 'realtime:data-changed');
      }
      for (const id of ids) {
        if (id !== event.resourceId) this.nodes.invalidate(id);
      }
      this.applyResourceCacheChange({
        resourceType: 'node',
        resourceId: event.resourceId,
        changeType: event.changeType,
        affectedResourceIds: ids,
      });
      this.invalidateAdminFromRealtime(['children', 'subtree-entities']);
    }
  }

  private readonly kernel = new CacheKernel();

  public nodes = new KernelNodeCacheClient(this.kernel, this.notifyCacheSubscribers);

  public lists = new KernelListCacheClient(this.kernel, this.notifyCacheSubscribers);

  public readonly metadata = new MetadataCacheClient(this.kernel);
  public readonly users = new UserCacheClient(this.kernel, this.notifyCacheSubscribers);
  public readonly admin = new AdminCacheClient((kind, typeKey) => this.invalidateMetadata(kind, typeKey));
  private readonly resourceCacheInvalidation = new ResourceCacheInvalidationCoordinator({
    removeNode: (resourceId) => this.nodes.remove(resourceId),
    removeEntity: (entityTypeId, resourceId) => this.getEntityCache(entityTypeId).remove(resourceId),
    invalidateNodeChildren: () => this.nodes.invalidateChildren(),
    invalidateNodeHierarchy: () => GlobalViewStore.invalidateDependency(VIEW_DEPENDENCIES.nodeHierarchy),
    invalidateEntityMembership: () => GlobalViewStore.invalidateDependency(VIEW_DEPENDENCIES.entityMembership),
    invalidateNodeReference: (resourceId) => GlobalViewStore.invalidateReference({ namespace: 'node', id: resourceId }),
    invalidateEntityReference: (entityTypeId, resourceId) => GlobalViewStore.invalidateReference({
      namespace: `entity:${entityTypeId}`,
      id: resourceId,
    }),
  });

  private applyResourceCacheChange(change: ResourceCacheChange): void {
    this.resourceCacheInvalidation.apply(change);
  }

  /**
   * Invalidates every client-side projection affected by a type mutation.
   * Metadata views are persistent, so invalidating only AdminCacheClient would
   * leave forms reading the previous type list indefinitely.
   */
  public invalidateMetadata(kind: 'node' | 'entity', typeKey?: string, fromRealtime = false): void {
    this.metadata.invalidate(kind);
    const viewKey = ViewKeyBuilder.build({ viewType: 'METADATA_LIST', metadataType: kind });
    GlobalViewStore.invalidateDependency(
      kind === 'node' ? VIEW_DEPENDENCIES.nodeMetadata : VIEW_DEPENDENCIES.entityMetadata,
    );
    // Compatibility for a loading state created before the first catalogue
    // response has registered its dependency token.
    GlobalViewStore.delete(viewKey);
    const adminKeys = [
      'types',
      ...(typeKey ? [`type-detail:${kind}:${typeKey}`, `type-definition:${kind}:${typeKey}`] : ['type-detail', 'type-definition']),
    ];
    if (fromRealtime) this.invalidateAdminFromRealtime(adminKeys);
    else this.admin.invalidate(adminKeys);
    this.notifyCacheSubscribers();
  }

  public async reconcileMetadata(): Promise<void> {
    await this.metadata.reconcileAll();
    this.notifyCacheSubscribers();
  }

  public reconcileResources(): void {
    this.nodes.purge();
    this.entityCaches.forEach((cache) => cache.purge());
    GlobalViewStore.invalidateNamespace('node');
    GlobalViewStore.invalidateNamespacePrefix('entity:');
    GlobalViewStore.invalidateDependency(VIEW_DEPENDENCIES.entityMembership);
    this.notifyCacheSubscribers();
  }

  private entityCaches = new Map<string, KernelEntityCacheClient>();

  /**
   * Retrieves or creates an isolated cache for a specific entity type.
   */
  public getEntityCache(entityTypeKey: string): KernelEntityCacheClient {
    if (!this.entityCaches.has(entityTypeKey)) {
      this.entityCaches.set(entityTypeKey, new KernelEntityCacheClient(this.kernel, entityTypeKey, this.notifyCacheSubscribers));
    }
    return this.entityCaches.get(entityTypeKey)!;
  }

  // --- Mutation Orchestrators ---

  public async createEntity(input: CreateEntityInput): Promise<ClientEntity> {
    const requestEpoch = this.getCacheEpoch();
    try {
      return await this.mutations.run(
        `entity:create:${input.parentNodeId}`,
        async (mutationId) => {
          const result = await createEntityAction({ ...input, mutationId });
          if (!result.success) throw actionError(result.error);
          return result.data;
        },
        (newEntity) => {
          if (this.getCacheEpoch() === requestEpoch) {
            const entityTypeKey = newEntity.entityTypeId;
            this.getEntityCache(entityTypeKey).inject(newEntity.id, newEntity as unknown as ClientEntity, false, 'mutation:createEntity');
            this.applyResourceCacheChange({ resourceType: 'entity', resourceId: newEntity.id, changeType: 'created', entityTypeId: entityTypeKey });
          }
        },
      ) as unknown as ClientEntity;
    } catch (err: unknown) {
      this.handleFetchError(err);
      throw err;
    }
  }

  public async updateEntity(input: UpdateEntityInput): Promise<ClientEntity> {
    const requestEpoch = this.getCacheEpoch();
    try {
      return await this.mutations.run(
        `entity:${input.entityId}`,
        async (mutationId) => {
          const result = await updateEntityAction({ ...input, mutationId });
          if (!result.success) throw actionError(result.error);
          return result.data;
        },
        (updatedEntity) => {
          if (this.getCacheEpoch() === requestEpoch) {
            const entityTypeKey = updatedEntity.entityTypeId;
            this.getEntityCache(entityTypeKey).inject(updatedEntity.id, updatedEntity as unknown as ClientEntity, false, 'mutation:updateEntity');
            this.applyResourceCacheChange({ resourceType: 'entity', resourceId: updatedEntity.id, changeType: 'updated', entityTypeId: entityTypeKey });
          }
        },
      ) as unknown as ClientEntity;
    } catch (err: unknown) {
      this.handleFetchError(err);
      throw err;
    }
  }

  /** Reloads the authoritative entity after an optimistic-concurrency conflict. */
  public async refreshEntity(entityId: string, entityTypeKey: string): Promise<ClientEntity | null> {
    const cache = this.getEntityCache(entityTypeKey);
    cache.invalidate(entityId);
    return cache.fetchIfMissing(entityId, true);
  }

  public async deleteEntity(entityId: string, entityTypeKey?: string, expectedRowVersion?: number): Promise<{ parentNodeId: string; entityTypeId: string }> {
    const requestEpoch = this.getCacheEpoch();
    try {
      return await this.mutations.run(
        `entity:${entityId}`,
        async (mutationId) => {
          const result = await deleteEntityAction({ entityId, expectedRowVersion, mutationId });
          if (!result.success) throw actionError(result.error);
          return result.data;
        },
        (deleted) => {
          if (this.getCacheEpoch() !== requestEpoch) return;
          this.applyResourceCacheChange({
            resourceType: 'entity',
            resourceId: entityId,
            changeType: 'deleted',
            entityTypeId: entityTypeKey ?? deleted.entityTypeId,
          });
        },
      );
    } catch (err: unknown) {
      this.handleFetchError(err);
      throw err;
    }
  }

  // --- NODE MUTATIONS ---

  public async createNode(input: CreateNodeInput) {
    const requestEpoch = this.getCacheEpoch();
    try {
      return await this.mutations.run(
        `node:create:${input.parentNodeId ?? 'root'}`,
        async (mutationId) => {
          const result = await createNodeAction({ ...input, mutationId });
          if (!result.success) throw actionError(result.error);
          return result.data as ClientNode;
        },
        (created) => {
          const clientNode = created as ClientNode;
          if (this.getCacheEpoch() !== requestEpoch) return;
          this.nodes.inject(clientNode.id, clientNode, false, 'mutation:createNode');
          this.applyResourceCacheChange({ resourceType: 'node', resourceId: clientNode.id, changeType: 'created' });
        },
      );
    } catch (err: unknown) {
      this.handleFetchError(err);
      throw err;
    }
  }

  public async updateNode(input: UpdateNodeInput) {
    const requestEpoch = this.getCacheEpoch();
    try {
      return await this.mutations.run(
        `node:${input.nodeId}`,
        async (mutationId) => {
          const result = await updateNodeAction({ ...input, mutationId });
          if (!result.success) throw actionError(result.error);
          return result.data;
        },
        (updated) => {
          const clientNode: ClientNode = updated as unknown as ClientNode;
          if (this.getCacheEpoch() !== requestEpoch) return;
          this.nodes.inject(clientNode.id, clientNode, false, 'mutation:updateNode');
          this.applyResourceCacheChange({ resourceType: 'node', resourceId: clientNode.id, changeType: 'updated' });
        },
      );
    } catch (err: unknown) {
      this.handleFetchError(err);
      throw err;
    }
  }

  /** Reloads the authoritative node after an optimistic-concurrency conflict. */
  public async refreshNode(nodeId: string): Promise<ClientNode | null> {
    this.nodes.invalidate(nodeId);
    return this.nodes.fetchIfMissing(nodeId, true);
  }

  public async moveNode(input: MoveNodeInput) {
    const requestEpoch = this.getCacheEpoch();
    try {
      return await this.mutations.run(
        `node:${input.nodeId}`,
        async (mutationId) => {
          const result = await moveNodeAction({ ...input, mutationId });
          if (!result.success) throw actionError(result.error);
          return result.data as ClientNode | null;
        },
        (moved) => {
          if (!moved || this.getCacheEpoch() !== requestEpoch) return;
          const clientNode = moved as ClientNode;
          this.nodes.inject(clientNode.id, clientNode, false, 'mutation:moveNode');
          this.applyResourceCacheChange({ resourceType: 'node', resourceId: clientNode.id, changeType: 'moved' });
        },
      );
    } catch (err: unknown) {
      this.handleFetchError(err);
      throw err;
    }
  }

  /** Removes a deleted node from local records and invalidates every affected hierarchy projection. */
  public async deleteNode(nodeId: string, expectedRowVersion?: number): Promise<{ parentNodeId: string | null }> {
    const requestEpoch = this.getCacheEpoch();
    try {
      return await this.mutations.run(
        `node:${nodeId}`,
        async (mutationId) => {
          const result = await deleteNodeAction({ nodeId, expectedRowVersion, mutationId });
          if (!result.success) throw actionError(result.error);
          return result.data;
        },
        () => {
          if (this.getCacheEpoch() !== requestEpoch) return;
          this.applyResourceCacheChange({ resourceType: 'node', resourceId: nodeId, changeType: 'deleted' });
        },
      );
    } catch (err: unknown) {
      this.handleFetchError(err);
      throw err;
    }
  }

  /**
   * Spazza via l'intera cache locale (entità e metadati).
   * Viene invocata obbgligatoriamente durante il logout o al rilevamento di una
   * sessione non autorizzata, per impedire che dati dell'utente precedente 
   * (o dati confidenziali) leakino all'utente successivo nella stessa sessione browser.
   */
  public purgeAll(): void {
    this.kernel.purge();
    this.nodes?.purge();
    this.lists.purge();
    this.users.purge();
    this.admin.invalidate();
    
    if (this.entityCaches) {
      this.entityCaches.forEach(cache => cache.purge());
      this.entityCaches.clear();
    }
    GlobalViewStore.purge();
    GlobalPolicyRegistry.purge();
    this.lockStates.clear();
    this.lockSubscribers.clear();
    this.hydratedLockKeys.clear();
    this.pendingLockHydrations.clear();
    this.virtualRootNodeIds.clear();
  }

  /**
   * Intercettore globale per errori di data fetching.
   * Valuta l'errore; se è un 401 Unauthorized (sessione scaduta o invalida),
   * innesca la purga di sicurezza e redirige l'utente al login.
   */
  public handleFetchError(error: unknown): void {
    const errorRecord = typeof error === 'object' && error !== null
      ? error as { code?: unknown; message?: unknown }
      : {};
    const message = typeof errorRecord.message === 'string' ? errorRecord.message : '';
    const isUnauthorized = 
      errorRecord.code === 'AUTH_UNAUTHORIZED' ||
      message.includes('AUTH_UNAUTHORIZED') ||
      message.includes('Authentication credentials are required') ||
      message.includes('Invalid credentials');

    if (isUnauthorized) {
      console.warn('⚠️ CacheService: 401 Unauthorized rilevato. Eseguo purge e redirect.');
      this.purgeAll();
      if (typeof window !== 'undefined') {
        // A full reload removes residual React and NextAuth state after an unauthorized response.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- Security boundary requires a fresh server-authenticated document.
        window.location.href = '/login?error=SessionExpired';
      }
    }
  }
}

export const AppCache = new GlobalCacheClient();
