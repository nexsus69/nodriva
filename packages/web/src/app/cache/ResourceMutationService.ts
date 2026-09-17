/** Owns node and entity mutation workflows and their authoritative cache effects. */
import { ClientEntity, ClientNode } from '../types/models';
import { createNodeAction, updateNodeAction, moveNodeAction, deleteNodeAction } from '../actions/nodeActions';
import { createEntityAction, updateEntityAction, deleteEntityAction } from '../actions/entityActions';
import type { KernelEntityCacheClient } from './KernelEntityCacheClient';
import type { KernelNodeCacheClient } from './KernelNodeCacheClient';
import type { ResourceCacheChange } from './ResourceCacheInvalidationCoordinator';
import { ResourceMutationCoordinator } from './ResourceMutationCoordinator';

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

export interface ResourceMutationServicePorts {
  getCacheEpoch(): number;
  nodes: KernelNodeCacheClient;
  getEntityCache(entityTypeId: string): KernelEntityCacheClient;
  applyResourceCacheChange(change: ResourceCacheChange): void;
  invalidateAdmin(keys: readonly string[]): void;
  reconcileAdminEntityUpdate(entity: ClientEntity): void;
  handleError(error: unknown): void;
}

function actionError(error: { code: string; message: string; details?: unknown }): Error {
  return Object.assign(new Error(error.message), error);
}

/**
 * Executes server mutations once and commits their cache consequences only if
 * the browser cache generation is still the one that initiated the request.
 */
export class ResourceMutationService {
  public constructor(
    private readonly coordinator: ResourceMutationCoordinator,
    private readonly ports: ResourceMutationServicePorts,
  ) {}

  public async createEntity(input: CreateEntityInput): Promise<ClientEntity> {
    const requestEpoch = this.ports.getCacheEpoch();
    try {
      return await this.coordinator.run(
        `entity:create:${input.parentNodeId}`,
        async (mutationId) => {
          const result = await createEntityAction({ ...input, mutationId });
          if (!result.success) throw actionError(result.error);
          return result.data;
        },
        (created) => {
          if (this.ports.getCacheEpoch() !== requestEpoch) return;
          const entity = created as ClientEntity;
          this.ports.getEntityCache(entity.entityTypeId).inject(entity.id, entity, false, 'mutation:createEntity');
          this.ports.applyResourceCacheChange({ resourceType: 'entity', resourceId: entity.id, changeType: 'created', entityTypeId: entity.entityTypeId });
          this.ports.invalidateAdmin(['admin-entities-page']);
        },
      ) as ClientEntity;
    } catch (error) {
      this.ports.handleError(error);
      throw error;
    }
  }

  public async updateEntity(input: UpdateEntityInput): Promise<ClientEntity> {
    const requestEpoch = this.ports.getCacheEpoch();
    try {
      return await this.coordinator.run(
        `entity:${input.entityId}`,
        async (mutationId) => {
          const result = await updateEntityAction({ ...input, mutationId });
          if (!result.success) throw actionError(result.error);
          return result.data;
        },
        (updated) => {
          if (this.ports.getCacheEpoch() !== requestEpoch) return;
          const entity = updated as ClientEntity;
          this.ports.getEntityCache(entity.entityTypeId).inject(entity.id, entity, false, 'mutation:updateEntity');
          this.ports.applyResourceCacheChange({ resourceType: 'entity', resourceId: entity.id, changeType: 'updated', entityTypeId: entity.entityTypeId });
          this.ports.reconcileAdminEntityUpdate(entity);
        },
      ) as ClientEntity;
    } catch (error) {
      this.ports.handleError(error);
      throw error;
    }
  }

  public async refreshEntity(entityId: string, entityTypeId: string): Promise<ClientEntity | null> {
    const cache = this.ports.getEntityCache(entityTypeId);
    cache.invalidate(entityId);
    return cache.fetchIfMissing(entityId, true);
  }

  public async deleteEntity(entityId: string, entityTypeId?: string, expectedRowVersion?: number): Promise<{ parentNodeId: string; entityTypeId: string }> {
    const requestEpoch = this.ports.getCacheEpoch();
    try {
      return await this.coordinator.run(
        `entity:${entityId}`,
        async (mutationId) => {
          const result = await deleteEntityAction({ entityId, expectedRowVersion, mutationId });
          if (!result.success) throw actionError(result.error);
          return result.data;
        },
        (deleted) => {
          if (this.ports.getCacheEpoch() !== requestEpoch) return;
          this.ports.applyResourceCacheChange({ resourceType: 'entity', resourceId: entityId, changeType: 'deleted', entityTypeId: entityTypeId ?? deleted.entityTypeId });
          this.ports.invalidateAdmin(['admin-entities-page']);
        },
      );
    } catch (error) {
      this.ports.handleError(error);
      throw error;
    }
  }

  public async createNode(input: CreateNodeInput): Promise<ClientNode> {
    const requestEpoch = this.ports.getCacheEpoch();
    try {
      return await this.coordinator.run(
        `node:create:${input.parentNodeId ?? 'root'}`,
        async (mutationId) => {
          const result = await createNodeAction({ ...input, mutationId });
          if (!result.success) throw actionError(result.error);
          return result.data as ClientNode;
        },
        (created) => {
          if (this.ports.getCacheEpoch() !== requestEpoch) return;
          this.ports.nodes.inject(created.id, created, false, 'mutation:createNode');
          this.ports.applyResourceCacheChange({ resourceType: 'node', resourceId: created.id, changeType: 'created' });
          this.ports.invalidateAdmin(['admin-nodes-page', 'admin-entities-page']);
        },
      );
    } catch (error) {
      this.ports.handleError(error);
      throw error;
    }
  }

  public async updateNode(input: UpdateNodeInput): Promise<ClientNode> {
    const requestEpoch = this.ports.getCacheEpoch();
    try {
      return await this.coordinator.run(
        `node:${input.nodeId}`,
        async (mutationId) => {
          const result = await updateNodeAction({ ...input, mutationId });
          if (!result.success) throw actionError(result.error);
          return result.data as ClientNode;
        },
        (updated) => {
          if (this.ports.getCacheEpoch() !== requestEpoch) return;
          this.ports.nodes.inject(updated.id, updated, false, 'mutation:updateNode');
          this.ports.applyResourceCacheChange({ resourceType: 'node', resourceId: updated.id, changeType: 'updated' });
          this.ports.invalidateAdmin(['admin-nodes-page', 'admin-entities-page']);
        },
      );
    } catch (error) {
      this.ports.handleError(error);
      throw error;
    }
  }

  public async refreshNode(nodeId: string): Promise<ClientNode | null> {
    this.ports.nodes.invalidate(nodeId);
    return this.ports.nodes.fetchIfMissing(nodeId, true);
  }

  public async moveNode(input: MoveNodeInput): Promise<ClientNode | null> {
    const requestEpoch = this.ports.getCacheEpoch();
    try {
      return await this.coordinator.run(
        `node:${input.nodeId}`,
        async (mutationId) => {
          const result = await moveNodeAction({ ...input, mutationId });
          if (!result.success) throw actionError(result.error);
          return result.data as ClientNode | null;
        },
        (moved) => {
          if (!moved || this.ports.getCacheEpoch() !== requestEpoch) return;
          this.ports.nodes.inject(moved.id, moved, false, 'mutation:moveNode');
          this.ports.applyResourceCacheChange({ resourceType: 'node', resourceId: moved.id, changeType: 'moved' });
          this.ports.invalidateAdmin(['admin-nodes-page', 'admin-entities-page']);
        },
      );
    } catch (error) {
      this.ports.handleError(error);
      throw error;
    }
  }

  public async deleteNode(nodeId: string, expectedRowVersion?: number): Promise<{ parentNodeId: string | null }> {
    const requestEpoch = this.ports.getCacheEpoch();
    try {
      return await this.coordinator.run(
        `node:${nodeId}`,
        async (mutationId) => {
          const result = await deleteNodeAction({ nodeId, expectedRowVersion, mutationId });
          if (!result.success) throw actionError(result.error);
          return result.data;
        },
        () => {
          if (this.ports.getCacheEpoch() !== requestEpoch) return;
          this.ports.applyResourceCacheChange({ resourceType: 'node', resourceId: nodeId, changeType: 'deleted' });
          this.ports.invalidateAdmin(['admin-nodes-page', 'admin-entities-page']);
        },
      );
    } catch (error) {
      this.ports.handleError(error);
      throw error;
    }
  }
}
