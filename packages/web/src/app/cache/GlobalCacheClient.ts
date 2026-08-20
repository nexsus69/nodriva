import { DomainCacheClient } from './DomainCacheClient';
import { ClientNode, ClientEntity, NodeTypeMeta, EntityTypeMeta } from '../types/models';
import { createNodeAction, updateNodeAction, moveNodeAction } from '../actions/nodeActions';
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
import { reconcileMetadataBestEffort } from './metadataReconciliation';

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
  expectedParentRowVersion?: number;
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

export class GlobalCacheClient {
  private cacheRevision = 0;
  private cacheSubscribers = new Set<() => void>();
  private readonly lockStates = new Map<string, CachedLockState>();
  private readonly lockSubscribers = new Map<string, Set<(state: CachedLockState) => void>>();
  private readonly hydratedLockKeys = new Set<string>();
  private readonly pendingLockHydrations = new Map<string, Promise<void>>();
  private realtimeDebugEvents: RealtimeDebugEvent[] = [];
  private readonly realtimeDebugSubscribers = new Set<(events: RealtimeDebugEvent[]) => void>();
  private realtimeConnectionState: RealtimeConnectionState = 'initialized';
  private realtimeCapabilityEnabled = true;
  private readonly realtimeStateSubscribers = new Set<() => void>();
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

  /**
   * Entity mutations can invalidate more than the collection of the direct
   * parent node: subtree views and entity-detail views may contain the same
   * entity as well. Removing the affected read models keeps the next read
   * authoritative without trying to patch paginated windows locally.
   */
  private invalidateEntityViews(): void {
    GlobalViewStore.invalidateDependency(VIEW_DEPENDENCIES.entityMembership);
  }

  private invalidateNodeHierarchyViews(): void {
    GlobalViewStore.invalidateDependency(VIEW_DEPENDENCIES.nodeHierarchy);
  }

  private invalidateNodeChildrenViews(): void {
    GlobalViewStore.invalidateDependency(VIEW_DEPENDENCIES.nodeChildren);
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
    const metadataCache = reference.namespace === 'node-type' ? this.nodeTypes : this.entityTypes;
    if (!metadataCache.get(reference.id)) return 'missing';
    return metadataCache.needsFetch(reference.id, reference.completeness === 'full')
      ? 'incomplete'
      : 'satisfied';
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
    // Metadata semantic views are loaded as catalogues. If one catalogue row
    // is missing, the authoritative operation is to reload the whole view.
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

  public subscribeRealtimeState = (subscriber: () => void): (() => void) => {
    this.realtimeStateSubscribers.add(subscriber);
    return () => this.realtimeStateSubscribers.delete(subscriber);
  };

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
    if (event.metadataKind) {
      this.invalidateMetadata(event.metadataKind);
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
          break;
        case 'role':
          this.admin.invalidate(['roles', 'role']);
          break;
        case 'scope':
          this.admin.invalidate(['scope-assignments']);
          break;
        case 'audit':
          this.admin.invalidate(['audit']);
          break;
        case 'system':
          this.admin.invalidate(['capabilities', 'settings']);
          break;
        case 'placement_policy':
          this.admin.invalidate(['placement-policies', 'placement-policy']);
          break;
        case 'node_type':
          this.invalidateMetadata('node');
          break;
        case 'entity_type':
          this.invalidateMetadata('entity');
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
      } else if (entityTypeId && event.changeType === 'deleted') {
        this.getEntityCache(entityTypeId).remove(event.resourceId);
        GlobalViewStore.invalidateReference({
          namespace: `entity:${entityTypeId}`,
          id: event.resourceId,
        });
      }
      // An update patches the normalized entity and must not evict every
      // paginated/windowed collection. Membership changes have their own
      // change types and are the only entity events that require a reload.
      if (event.changeType !== 'updated') this.invalidateEntityViews();
    } else {
      const ids = event.affectedResourceIds?.length ? event.affectedResourceIds : [event.resourceId];
      if (event.changeType === 'deleted') {
        this.nodes.remove(event.resourceId);
        GlobalViewStore.invalidateReference({ namespace: 'node', id: event.resourceId });
      } else if (event.data) {
        this.nodes.inject(event.resourceId, event.data as ClientNode, false, 'realtime:data-changed');
      }
      for (const id of ids) {
        if (id !== event.resourceId) this.nodes.invalidate(id);
      }
      this.nodes.invalidateChildren();
      this.invalidateNodeChildrenViews();
      if (
        event.changeType === 'moved' ||
        event.changeType === 'updated' ||
        event.changeType === 'deleted' ||
        event.changeType === 'restored'
      ) {
        this.invalidateNodeHierarchyViews();
      }
      if (ids.length > 1) this.invalidateEntityViews();
    }
  }

  private readonly kernel = new CacheKernel();

  public nodes = new KernelNodeCacheClient(this.kernel, this.notifyCacheSubscribers);

  public lists = new DomainCacheClient<{ id: string; items: string[] }>('lists', async () => {
    throw new Error('Dynamic full list fetch is currently orchestrated by individual hooks');
  }, this.notifyCacheSubscribers);

  public nodeTypes = new DomainCacheClient<NodeTypeMeta>('node-types', async () => {
    throw new Error('Node types must be fetched via METADATA_LIST semantic view');
  }, this.notifyCacheSubscribers);

  public entityTypes = new DomainCacheClient<EntityTypeMeta>('entity-types', async () => {
    throw new Error('Entity types must be fetched via METADATA_LIST semantic view');
  }, this.notifyCacheSubscribers);

  public readonly metadata = new MetadataCacheClient(this.kernel);
  public readonly users = new UserCacheClient(this.notifyCacheSubscribers);
  public readonly admin = new AdminCacheClient((kind, typeKey) => this.invalidateMetadata(kind, typeKey));

  /**
   * Invalidates every client-side projection affected by a type mutation.
   * Metadata views are persistent, so invalidating only AdminCacheClient would
   * leave forms reading the previous type list indefinitely.
   */
  public invalidateMetadata(kind: 'node' | 'entity', typeKey?: string): void {
    this.metadata.invalidate(kind);
    const viewKey = ViewKeyBuilder.build({ viewType: 'METADATA_LIST', metadataType: kind });
    GlobalViewStore.invalidateDependency(
      kind === 'node' ? VIEW_DEPENDENCIES.nodeMetadata : VIEW_DEPENDENCIES.entityMetadata,
    );
    // Compatibility for a loading state created before the first catalogue
    // response has registered its dependency token.
    GlobalViewStore.delete(viewKey);
    if (kind === 'node') this.nodeTypes.purge();
    else this.entityTypes.purge();
    this.admin.invalidate([
      'types',
      ...(typeKey ? [`type-detail:${kind}:${typeKey}`, `type-definition:${kind}:${typeKey}`] : ['type-detail', 'type-definition']),
    ]);
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
    this.invalidateEntityViews();
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
      const result = await createEntityAction(input);
      if (!result.success) throw actionError(result.error);
      const newEntity = result.data;
      if (this.getCacheEpoch() !== requestEpoch) return newEntity as unknown as ClientEntity;
      const entityTypeKey = newEntity.entityTypeId;
      // Inietta il nuovo dato nella cache
      this.getEntityCache(entityTypeKey).inject(newEntity.id, newEntity as unknown as ClientEntity, false);
      this.invalidateEntityViews();
      return newEntity as unknown as ClientEntity;
    } catch (err: unknown) {
      this.handleFetchError(err);
      throw err;
    }
  }

  public async updateEntity(input: UpdateEntityInput): Promise<ClientEntity> {
    const requestEpoch = this.getCacheEpoch();
    try {
      const result = await updateEntityAction(input);
      if (!result.success) throw actionError(result.error);
      const updatedEntity = result.data;
      if (this.getCacheEpoch() !== requestEpoch) return updatedEntity as unknown as ClientEntity;
      const entityTypeKey = updatedEntity.entityTypeId;
      // Inietta il dato aggiornato nella cache
      this.getEntityCache(entityTypeKey).inject(updatedEntity.id, updatedEntity as unknown as ClientEntity, false);
      // The detail reads the updated canonical record, while list membership,
      // ordering and filters must be recomputed by the authoritative query.
      this.invalidateEntityViews();
      return updatedEntity as unknown as ClientEntity;
    } catch (err: unknown) {
      this.handleFetchError(err);
      throw err;
    }
  }

  public async deleteEntity(entityId: string, entityTypeKey: string, expectedRowVersion: number) {
    const requestEpoch = this.getCacheEpoch();
    try {
      const result = await deleteEntityAction({ entityId, expectedRowVersion });
      if (!result.success) throw actionError(result.error);
      if (this.getCacheEpoch() !== requestEpoch) return;
      // Aggiorna lo store
      const cache = this.getEntityCache(entityTypeKey);
      cache.remove(entityId);
      GlobalViewStore.invalidateReference({ namespace: `entity:${entityTypeKey}`, id: entityId });
      this.invalidateEntityViews();
    } catch (err: unknown) {
      this.handleFetchError(err);
      throw err;
    }
  }

  // --- NODE MUTATIONS ---

  public async createNode(input: CreateNodeInput) {
    const requestEpoch = this.getCacheEpoch();
    try {
      const created = await createNodeAction(input);
      const clientNode: ClientNode = created as unknown as ClientNode;
      if (this.getCacheEpoch() !== requestEpoch) return clientNode;
      this.nodes.inject(clientNode.id, clientNode, false, 'mutation:createNode');
      this.nodes.invalidateChildren();
      this.invalidateNodeChildrenViews();
      return clientNode;
    } catch (err: unknown) {
      this.handleFetchError(err);
      throw err;
    }
  }

  public async updateNode(input: UpdateNodeInput) {
    const requestEpoch = this.getCacheEpoch();
    try {
      const updated = await updateNodeAction(input);
      const clientNode: ClientNode = updated as unknown as ClientNode;
      if (this.getCacheEpoch() !== requestEpoch) return clientNode;
      this.nodes.inject(clientNode.id, clientNode, false, 'mutation:updateNode');
      this.nodes.invalidateChildren();
      this.invalidateNodeChildrenViews();
      this.invalidateNodeHierarchyViews();
      return clientNode;
    } catch (err: unknown) {
      this.handleFetchError(err);
      throw err;
    }
  }

  public async moveNode(input: MoveNodeInput) {
    const requestEpoch = this.getCacheEpoch();
    try {
      const moved = await moveNodeAction(input);
      if (moved) {
        const clientNode: ClientNode = moved as unknown as ClientNode;
        if (this.getCacheEpoch() !== requestEpoch) return clientNode;
        this.nodes.inject(clientNode.id, clientNode, false, 'mutation:moveNode');
        this.nodes.invalidateChildren();
        this.invalidateNodeChildrenViews();
        this.invalidateNodeHierarchyViews();
        return clientNode;
      }
      return null;
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
    this.lists?.purge();
    this.nodeTypes?.purge();
    this.entityTypes?.purge();
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
