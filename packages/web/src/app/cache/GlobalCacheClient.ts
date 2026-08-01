import { DomainCacheClient } from './DomainCacheClient';
import { ClientNode, ClientEntity, NodeTypeMeta, EntityTypeMeta } from '../types/models';
import { getNodeByIdAction, createNodeAction, updateNodeAction, moveNodeAction } from '../actions/nodeActions';
import { getEntityByIdAction, createEntityAction, updateEntityAction, deleteEntityAction } from '../actions/entityActions';
import { GlobalViewStore } from './ViewStore';
import { GlobalPolicyRegistry } from './PolicyRegistry';
import { ViewKeyBuilder } from './SemanticViewKey';

export interface CreateNodeInput {
  parentNodeId: string | null;
  nodeTypeKey: string;
  name: string;
  description?: string;
  expectedParentRowVersion?: number;
}

export interface UpdateNodeInput {
  nodeId: string;
  name?: string;
  description?: string;
  expectedRowVersion: number;
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

export class GlobalCacheClient {
  private cacheRevision = 0;
  private cacheSubscribers = new Set<() => void>();

  private notifyCacheSubscribers = () => {
    this.cacheRevision += 1;
    this.cacheSubscribers.forEach((subscriber) => subscriber());
  };

  public getRevision = (): number => this.cacheRevision;

  public subscribe = (subscriber: () => void): (() => void) => {
    this.cacheSubscribers.add(subscriber);
    return () => this.cacheSubscribers.delete(subscriber);
  };

  public nodes = new DomainCacheClient<ClientNode>('nodes', async (id) => {
    try {
      const node = await getNodeByIdAction(id);
      if (!node) throw new Error(`Node ${id} not found`);
      return node as unknown as ClientNode;
    } catch (err: unknown) {
      this.handleFetchError(err);
      throw err;
    }
  }, this.notifyCacheSubscribers);

  public lists = new DomainCacheClient<{ id: string; items: string[] }>('lists', async () => {
    throw new Error('Dynamic full list fetch is currently orchestrated by individual hooks');
  }, this.notifyCacheSubscribers);

  public nodeTypes = new DomainCacheClient<NodeTypeMeta>('node-types', async () => {
    throw new Error('Node types must be fetched via METADATA_LIST semantic view');
  }, this.notifyCacheSubscribers);

  public entityTypes = new DomainCacheClient<EntityTypeMeta>('entity-types', async () => {
    throw new Error('Entity types must be fetched via METADATA_LIST semantic view');
  }, this.notifyCacheSubscribers);

  private entityCaches = new Map<string, DomainCacheClient<ClientEntity>>();

  /**
   * Retrieves or creates an isolated cache for a specific entity type.
   */
  public getEntityCache(entityTypeKey: string): DomainCacheClient<ClientEntity> {
    if (!this.entityCaches.has(entityTypeKey)) {
      this.entityCaches.set(
        entityTypeKey,
        new DomainCacheClient<ClientEntity>(
          `entities_${entityTypeKey}`,
          async (id) => {
            try {
              const entity = await getEntityByIdAction(id);
              if (!entity) throw new Error(`Entity ${id} not found`);
              return entity as unknown as ClientEntity;
            } catch (err: unknown) {
              this.handleFetchError(err);
              throw err;
            }
          },
          this.notifyCacheSubscribers
        )
      );
    }
    return this.entityCaches.get(entityTypeKey)!;
  }

  // --- Mutation Orchestrators ---

  public async createEntity(input: CreateEntityInput): Promise<ClientEntity> {
    try {
      const newEntity = await createEntityAction(input);
      const entityTypeKey = newEntity.entityTypeId;
      // Inietta il nuovo dato nella cache
      this.getEntityCache(entityTypeKey).inject(newEntity.id, newEntity as unknown as ClientEntity, false);
      GlobalViewStore.delete(ViewKeyBuilder.build({
        viewType: 'NODE_ENTITY_COLLECTION',
        baseNodeId: newEntity.parentNodeId,
      }));
      return newEntity as unknown as ClientEntity;
    } catch (err: unknown) {
      this.handleFetchError(err);
      throw err;
    }
  }

  public async updateEntity(input: UpdateEntityInput): Promise<ClientEntity> {
    try {
      const updatedEntity = await updateEntityAction(input);
      const entityTypeKey = updatedEntity.entityTypeId;
      // Inietta il dato aggiornato nella cache
      this.getEntityCache(entityTypeKey).inject(updatedEntity.id, updatedEntity as unknown as ClientEntity, false);
      return updatedEntity as unknown as ClientEntity;
    } catch (err: unknown) {
      this.handleFetchError(err);
      throw err;
    }
  }

  public async deleteEntity(entityId: string, entityTypeKey: string) {
    try {
      await deleteEntityAction({ entityId });
      // Aggiorna lo store
      const cache = this.getEntityCache(entityTypeKey);
      cache.remove(entityId);
    } catch (err: unknown) {
      this.handleFetchError(err);
      throw err;
    }
  }

  // --- NODE MUTATIONS ---

  public async createNode(input: CreateNodeInput) {
    try {
      const created = await createNodeAction(input);
      const clientNode: ClientNode = created as unknown as ClientNode;
      this.nodes.inject(clientNode.id, clientNode, false, 'mutation:createNode');
      return clientNode;
    } catch (err: unknown) {
      this.handleFetchError(err);
      throw err;
    }
  }

  public async updateNode(input: UpdateNodeInput) {
    try {
      const updated = await updateNodeAction(input);
      const clientNode: ClientNode = updated as unknown as ClientNode;
      this.nodes.inject(clientNode.id, clientNode, false, 'mutation:updateNode');
      return clientNode;
    } catch (err: unknown) {
      this.handleFetchError(err);
      throw err;
    }
  }

  public async moveNode(input: MoveNodeInput) {
    try {
      const moved = await moveNodeAction(input);
      if (moved) {
        const clientNode: ClientNode = moved as unknown as ClientNode;
        this.nodes.inject(clientNode.id, clientNode, false, 'mutation:moveNode');
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
    this.nodes?.purge();
    this.lists?.purge();
    this.nodeTypes?.purge();
    this.entityTypes?.purge();
    
    if (this.entityCaches) {
      this.entityCaches.forEach(cache => cache.purge());
      this.entityCaches.clear();
    }
    GlobalViewStore.purge();
    GlobalPolicyRegistry.purge();
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
        window.location.href = '/login?error=SessionExpired';
      }
    }
  }
}

export const AppCache = new GlobalCacheClient();
