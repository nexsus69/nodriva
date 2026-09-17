/** Coordinates browser-side canonical caches, view invalidation and mutations. */
import { ClientNode, ClientEntity } from '../types/models';
import { createNodeAction, updateNodeAction, moveNodeAction, deleteNodeAction } from '../actions/nodeActions';
import { createEntityAction, updateEntityAction, deleteEntityAction } from '../actions/entityActions';
import { getLockStateAction } from '../actions/lockActions';
import { LockStateStore, type CachedLockState } from './LockStateStore';
import {
  RealtimeReadModelCoordinator,
  type RealtimeReadModelState,
} from './RealtimeReadModelCoordinator';
import { RealtimeEventApplier } from './RealtimeEventApplier';
import {
  RealtimeAccessSynchronizer,
  type RealtimeAccessLoadResult,
} from './RealtimeAccessSynchronizer';
import { VirtualRootStore } from './VirtualRootStore';
import { AdminRealtimeInvalidationBus } from './AdminRealtimeInvalidationBus';
import { CacheRevisionStore } from './CacheRevisionStore';
import { RealtimeDebugStore } from './RealtimeDebugStore';
import {
  AttachmentCollectionStore,
  type AttachmentCollectionTarget,
  type AttachmentResourceTarget,
} from './AttachmentCollectionStore';
import { GlobalViewStore, VIEW_DEPENDENCIES, type CacheRecordReference } from './ViewStore';
import { ViewKeyBuilder } from './SemanticViewKey';
import { GlobalPolicyRegistry } from './PolicyRegistry';
import { RealtimeCacheBridge } from './RealtimeCacheBridge';
import type { RealtimeDataChangedEvent, ResourceKind } from '@dashboard/core';
import type {
  LockChannelEvent,
  RealtimeDebugEvent,
  RealtimeChannelCheckpoint,
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
import type { AttachmentCollectionState } from '../attachments/attachmentCollectionModel';
export type { CachedLockState } from './LockStateStore';
export type { AttachmentCollectionTarget, AttachmentResourceTarget } from './AttachmentCollectionStore';

export type { RealtimeReadModelState } from './RealtimeReadModelCoordinator';

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
  public readonly mutations = new ResourceMutationCoordinator();
  private readonly realtimeBridge = new RealtimeCacheBridge(
    (event) => this.realtimeEventApplier.applyDataChanged(event),
    (eventName, event) => this.realtimeEventApplier.applyLock(eventName, event),
    (event) => this.recordRealtimeDebugEvent(event),
    (state: RealtimeConnectionState) => {
      this.realtimeReadModel.observeConnection(state);
      if (state === 'connected') {
        reconcileMetadataBestEffort(() => this.reconcileMetadata(), 'realtime connection');
      }
    },
    () => this.realtimeReadModel.markContinuityUnknown(),
  );

  private recordRealtimeDebugEvent(event: RealtimeDebugEvent): void {
    this.realtimeDebugStore.append(event);
  }

  private notifyCacheSubscribers = () => {
    this.cacheRevisionStore.notifyChanged();
  };

  private readonly cacheRevisionStore = new CacheRevisionStore();
  private readonly realtimeDebugStore = new RealtimeDebugStore();
  private readonly lockStore = new LockStateStore({
    load: (resourceType, resourceId) => getLockStateAction(resourceType, resourceId),
    onChanged: this.notifyCacheSubscribers,
  });

  private readonly attachmentCollectionStore = new AttachmentCollectionStore();
  private readonly virtualRootStore = new VirtualRootStore();
  private readonly adminRealtimeInvalidationBus = new AdminRealtimeInvalidationBus();

  private readonly realtimeReadModel = new RealtimeReadModelCoordinator({
    invalidateReadModel: () => this.invalidateReadModel(),
    setReadModelTrusted: (trusted) => this.kernel.setReadModelTrusted(trusted),
  });

  private readonly realtimeAccessSynchronizer = new RealtimeAccessSynchronizer({
    load: () => this.loadRealtimeAccess(),
    onUnauthorized: () => this.purgeAll(),
    onContinuityUnknown: () => this.markRealtimeContinuityUnknown(),
    setRealtimeEnabled: (enabled) => this.setRealtimeEnabled(enabled),
    observeChannels: (channels) => this.observeRealtimeChannels(channels),
    observeCheckpoints: (checkpoints) => this.observeRealtimeCheckpoints(checkpoints),
    retainChannels: (dataChannels, lockChannels) => this.retainRealtimeChannels(dataChannels, lockChannels),
    setVirtualRootNodeIds: (nodeIds) => this.setVirtualRootNodeIds(nodeIds),
    isReadModelLive: () => this.realtimeReadModel.getReadModelState() === 'live',
  });

  public getRevision = (): number => this.cacheRevisionStore.getRevision();

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

  public subscribe = (subscriber: () => void): (() => void) => this.cacheRevisionStore.subscribe(subscriber);

  public retainRealtimeChannels = (dataChannels: string[], lockChannels: string[]): (() => void) =>
    this.realtimeBridge.retainPolicyChannels(dataChannels, lockChannels);

  public getRealtimeConnectionState = (): RealtimeConnectionState => this.realtimeReadModel.getConnectionState();

  public getRealtimeCapabilityEnabled = (): boolean => this.realtimeReadModel.isCapabilityEnabled();

  public getRealtimeReadModelState = (): RealtimeReadModelState => this.realtimeReadModel.getReadModelState();

  public setRealtimeOriginSession = (sessionId: string | null | undefined): void => {
    this.mutations.setOriginSessionId(sessionId);
  };

  public subscribeRealtimeState = (subscriber: () => void): (() => void) => this.realtimeReadModel.subscribe(subscriber);

  /** Lets active admin collections reload only after an authorized realtime invalidation. */
  public subscribeAdminRealtimeInvalidations = (
    subscriber: (keys: readonly string[]) => void,
  ): (() => void) => this.adminRealtimeInvalidationBus.subscribe(subscriber);

  /** Subscribes a UI surface to the shared attachment snapshot for one resource. */
  public subscribeAttachmentCollection = (
    target: AttachmentCollectionTarget,
    subscriber: () => void,
  ): (() => void) => this.attachmentCollectionStore.subscribeCollection(target, subscriber);

  public getAttachmentCollection = (target: AttachmentCollectionTarget) =>
    this.attachmentCollectionStore.getCollection(target);

  public setAttachmentCollection = (
    target: AttachmentCollectionTarget,
    state: AttachmentCollectionState,
  ): void => this.attachmentCollectionStore.setCollection(target, state);

  /** Signals that an authoritative reread is required after a local or realtime mutation. */
  public subscribeAttachmentCollectionInvalidation = (
    target: AttachmentResourceTarget,
    subscriber: () => void,
  ): (() => void) => this.attachmentCollectionStore.subscribeInvalidation(target, subscriber);

  public notifyAttachmentCollectionChanged = (target: AttachmentResourceTarget): void => {
    this.attachmentCollectionStore.notifyResourceChanged(target);
  };

  private invalidateAdminFromRealtime(keys: readonly string[]): void {
    this.admin.invalidate([...keys]);
    this.adminRealtimeInvalidationBus.publish(keys);
  }

  /** Verifies the server stream heads before a cached logical read is reused. */
  public ensureReadModelContinuityForCacheHit = (): Promise<boolean> => {
    if (this.realtimeReadModel.getReadModelState() !== 'live') return Promise.resolve(false);
    return this.synchronizeRealtimeAccess();
  };

  /** Synchronizes the authenticated channel policy and stream checkpoints once for all callers. */
  public synchronizeRealtimeAccess = (): Promise<boolean> => this.realtimeAccessSynchronizer.synchronize();

  private async loadRealtimeAccess(): Promise<RealtimeAccessLoadResult> {
    const response = await fetch('/api/sync/access', { method: 'GET', cache: 'no-store' });
    if (response.status === 401 || (response.redirected && new URL(response.url).pathname === '/login')) {
      return { kind: 'unauthorized' };
    }
    if (!response.ok) throw new Error(`Realtime access synchronization failed: ${response.status}`);
    return { kind: 'authorized', snapshot: await response.json() as {
      dataChannels: string[];
      lockChannels: string[];
      virtualRootNodeIds: string[];
      realtimeEnabled: boolean;
      realtimeCheckpoints: RealtimeChannelCheckpoint[];
    } };
  }

  public setRealtimeEnabled = (enabled: boolean): void => {
    this.realtimeReadModel.setCapabilityEnabled(enabled);
  };

  /**
   * Applies the authenticated server view of the browser's authorized channels.
   * A policy change can revoke data already present in the read model, so a
   * changed channel set is a global cache boundary rather than a local refresh.
   */
  public observeRealtimeChannels = (dataChannels: readonly string[]): void => {
    this.realtimeReadModel.observeAuthorizedChannels(dataChannels);
  };

  /** Confirms continuity only when server and browser agree on every channel head. */
  public observeRealtimeCheckpoints = (checkpoints: readonly RealtimeChannelCheckpoint[]): void => {
    if (!this.realtimeReadModel.isCapabilityEnabled()) return;
    const continuous = this.realtimeBridge.reconcileChannelCheckpoints(checkpoints);
    this.realtimeReadModel.observeContinuity(continuous);
  };

  /** A failed authenticated continuity probe means cached authorization and data are no longer trusted. */
  public markRealtimeContinuityUnknown = (): void => {
    this.realtimeReadModel.markContinuityUnknown();
  };

  /** Invalidates all data-derived projections but preserves UI subscriptions and unsaved form drafts. */
  private invalidateReadModel(): void {
    this.kernel.purge();
    this.kernel.setReadModelTrusted(false);
    this.entityCaches.clear();
    this.nodes.purge();
    this.lists.purge();
    this.users.purge();
    this.admin.invalidate();
    GlobalViewStore.purge();
    GlobalPolicyRegistry.purge();
    this.lockStore.clearReadModel();
    this.attachmentCollectionStore.clearReadModel();
    this.virtualRootStore.clear();
    this.notifyCacheSubscribers();
  }

  public setVirtualRootNodeIds = (nodeIds: string[]): void => {
    this.virtualRootStore.replace(nodeIds);
    this.notifyCacheSubscribers();
  };

  public isVirtualRootNode = (nodeId: string): boolean => this.virtualRootStore.has(nodeId);

  public getRealtimeDebugEvents = (): RealtimeDebugEvent[] => this.realtimeDebugStore.getEvents();

  public subscribeRealtimeDebug = (subscriber: (events: RealtimeDebugEvent[]) => void): (() => void) =>
    this.realtimeDebugStore.subscribe(subscriber);

  public clearRealtimeDebugEvents = (): void => {
    this.realtimeDebugStore.clear();
  };

  public getLockState(resourceType: ResourceKind, resourceId: string): CachedLockState {
    return this.lockStore.get(resourceType, resourceId);
  }

  public hydrateLockState = (resourceType: ResourceKind, resourceId: string): Promise<void> => {
    return this.lockStore.hydrate(resourceType, resourceId);
  };

  public subscribeLock(
    resourceType: ResourceKind,
    resourceId: string,
    subscriber: (state: CachedLockState) => void
  ): () => void {
    return this.lockStore.subscribe(resourceType, resourceId, subscriber);
  }

  public setLockState(
    resourceType: ResourceKind,
    resourceId: string,
    state: CachedLockState
  ): void {
    this.lockStore.set(resourceType, resourceId, state);
  }

  private readonly kernel = new CacheKernel({
    verifyCacheHit: () => this.ensureReadModelContinuityForCacheHit(),
  });

  public nodes = new KernelNodeCacheClient(this.kernel, this.notifyCacheSubscribers);

  public lists = new KernelListCacheClient(this.kernel, this.notifyCacheSubscribers);

  public readonly metadata = new MetadataCacheClient(this.kernel);
  public readonly users = new UserCacheClient(this.kernel, this.notifyCacheSubscribers);
  public readonly admin = new AdminCacheClient(
    (kind, typeKey) => this.invalidateMetadata(kind, typeKey),
    () => this.ensureReadModelContinuityForCacheHit(),
  );
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

  private readonly realtimeEventApplier = new RealtimeEventApplier({
    isLocalEvent: (event) => this.mutations.isLocalEvent(event),
    invalidateMetadata: (kind) => this.invalidateMetadata(kind, undefined, true),
    notifyAttachmentResourceChanged: (target) => this.notifyAttachmentCollectionChanged(target),
    invalidateNode: (resourceId) => this.nodes.invalidate(resourceId),
    invalidateEntityReference: (entityTypeId, resourceId) => GlobalViewStore.invalidateReference({
      namespace: `entity:${entityTypeId}`, id: resourceId,
    }),
    notifyCacheChanged: this.notifyCacheSubscribers,
    purgeUsers: () => this.users.purge(),
    invalidateAdmin: (keys) => this.invalidateAdminFromRealtime(keys),
    injectEntity: (entityTypeId, resourceId, data) => this.getEntityCache(entityTypeId).inject(
      resourceId, data as ClientEntity, false, 'realtime:data-changed',
    ),
    injectNode: (resourceId, data) => this.nodes.inject(
      resourceId, data as ClientNode, false, 'realtime:data-changed',
    ),
    applyResourceChange: (change) => this.applyResourceCacheChange(change),
    getLock: (resourceType, resourceId) => this.getLockState(resourceType, resourceId),
    setLock: (resourceType, resourceId, state) => this.setLockState(resourceType, resourceId, state),
  });

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
            this.invalidateAdminFromRealtime(['admin-entities-page']);
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
            this.invalidateAdminFromRealtime(['admin-entities-page']);
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
          this.invalidateAdminFromRealtime(['admin-entities-page']);
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
          this.invalidateAdminFromRealtime(['admin-nodes-page', 'admin-entities-page']);
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
          this.invalidateAdminFromRealtime(['admin-nodes-page', 'admin-entities-page']);
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
          this.invalidateAdminFromRealtime(['admin-nodes-page', 'admin-entities-page']);
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
          this.invalidateAdminFromRealtime(['admin-nodes-page', 'admin-entities-page']);
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
    this.realtimeAccessSynchronizer.purgeSession();
    this.realtimeReadModel.clearSession();
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
    this.lockStore.purge();
    this.virtualRootStore.clear();
    this.attachmentCollectionStore.purgeSession();
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
