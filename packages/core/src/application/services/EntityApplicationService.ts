/** Orchestrates authorized entity lifecycle operations through application ports. */

import { Entity } from '../../domain/models/Entity.js';
import type { EntityRepository } from '../ports/EntityRepository.js';
import type { EntityTypeRepository } from '../ports/EntityTypeRepository.js';
import type { NodeRepository } from '../ports/NodeRepository.js';
import type { EntitySchemaRegistry } from '../ports/EntitySchemaRegistry.js';
import type { AccessControlPort } from '../ports/AccessControlPort.js';
import type { LockService } from './LockService.js';
import type { AuditPort } from '../ports/AuditPort.js';
import type { RevisionPort } from '../ports/RevisionPort.js';
import type { RuntimeConfigurationPort } from '../ports/RuntimeConfigurationPort.js';
import type { IdGeneratorPort } from '../ports/IdGeneratorPort.js';
import type { TransactionPort } from '../ports/TransactionPort.js';
import type { ResourceRelationshipService } from './ResourceRelationshipService.js';
import { entityAuditSnapshot } from './ResourceAuditSnapshot.js';
import { createUserWorkflowEvent } from './WorkflowEventFactory.js';
import type { WorkflowEventPublisher } from '../ports/WorkflowEventPublisher.js';
import type { EventSubject } from '../../domain/events/WorkflowEvent.js';

import type {
  CreateEntityCommand,
  UpdateEntityCommand,
  DeleteEntityCommand,
  RestoreEntityCommand} from '../commands/EntityCommands.js';
import {
  CreateEntityCommandSchema,
  UpdateEntityCommandSchema,
  DeleteEntityCommandSchema,
  RestoreEntityCommandSchema,
} from '../commands/EntityCommands.js';
import { CapabilityDisabledError } from '../../domain/errors/ApplicationErrors.js';
import {
  EntityNotFoundError,
  EntityTypeNotFoundError,
  EntitySchemaValidationError,
  EntityCommandValidationError,
} from '../../domain/errors/EntityErrors.js';
import { NodeNotFoundError, RowVersionMismatchError } from '../../domain/errors/DomainErrors.js';

export class EntityApplicationService {
  constructor(
    private readonly entityRepository: EntityRepository,
    private readonly entityTypeRepository: EntityTypeRepository,
    private readonly nodeRepository: NodeRepository,
    private readonly schemaRegistry: EntitySchemaRegistry,
    private readonly accessControlPort: AccessControlPort,
    private readonly lockService: LockService,
    private readonly auditPort: AuditPort,
    private readonly revisionPort: RevisionPort,
    private readonly runtimeConfigPort: RuntimeConfigurationPort,
    private readonly idGenerator: IdGeneratorPort,
    private readonly transactionPort: TransactionPort,
    private readonly resourceRelationshipService?: ResourceRelationshipService,
    private readonly workflowEventPublisher?: WorkflowEventPublisher,
  ) {}

  async createEntity(cmd: CreateEntityCommand): Promise<Entity> {
    // 1. Validazione strutturale del command al boundary via EntityCommandValidationError
    const parseResult = CreateEntityCommandSchema.safeParse(cmd);
    if (!parseResult.success) {
      const issues: Record<string, string[]> = {};
      for (const issue of parseResult.error.issues) {
        const path = issue.path.join('.') || 'root';
        if (!issues[path]) {
          issues[path] = [];
        }
        issues[path].push(issue.message);
      }
      throw new EntityCommandValidationError('Validation failed for creating entity.', issues);
    }

    const validatedCmd = parseResult.data;

    // 2. Controllo capabilities runtime
    const isEntityEnabled = await this.runtimeConfigPort.isCapabilityEnabled('entities_structure');
    if (!isEntityEnabled) {
      throw new CapabilityDisabledError('entities_structure');
    }

    return await this.transactionPort.runInTransaction(async () => {
      // 3. Risoluzione e validazione del Tipo di Entity (ricerca tramite chiave semantica)
      const entityType = await this.entityTypeRepository.findByKey(validatedCmd.entityTypeKey);
      if (!entityType) {
        throw new EntityTypeNotFoundError(validatedCmd.entityTypeKey, 'key');
      }

      if (!entityType.isActive) {
        throw new EntityCommandValidationError(`Entity type '${validatedCmd.entityTypeKey}' is disabled.`, {
          entityTypeKey: [validatedCmd.entityTypeKey],
        });
      }

      // 4. Risoluzione permessi e scope (Authorization)
      await this.accessControlPort.assertCanCreateEntity(
        validatedCmd.actorUserId,
        validatedCmd.parentNodeId,
        validatedCmd.entityTypeKey
      );

      // 5. Validazione del parent node (deve esistere e controlliamo la row version)
      const parentNode = await this.nodeRepository.findById(validatedCmd.parentNodeId);
      if (!parentNode) {
        throw new NodeNotFoundError(validatedCmd.parentNodeId);
      }

      if (validatedCmd.expectedParentRowVersion !== undefined && parentNode.rowVersion !== validatedCmd.expectedParentRowVersion) {
        throw new RowVersionMismatchError(validatedCmd.expectedParentRowVersion, parentNode.rowVersion);
      }

      // Concurrency locking check sul parent node
      const isLockingEnabled = await this.runtimeConfigPort.isCapabilityEnabled('locking');
      if (isLockingEnabled) {
        await this.lockService.requireOwnedLock({ resourceType: 'node', resourceId: parentNode.id }, validatedCmd.actorUserId, validatedCmd.actorSessionId);
      }

      // 6. Validazione del payload contro lo schema Zod dinamico
      // NOTA: I campi name e description sono attributi canonici top-level gestiti a livello di comando
      // e non fanno parte del payload dinamico.
      const dynamicSchema = await this.schemaRegistry.getSchema(validatedCmd.entityTypeKey);
      if (!dynamicSchema) {
        throw new EntitySchemaValidationError(`No schema found or compiled for entity type: '${validatedCmd.entityTypeKey}'`, {
          entityTypeKey: [validatedCmd.entityTypeKey],
        });
      }

      const payloadParseResult = dynamicSchema.safeParse(validatedCmd.payload);
      if (!payloadParseResult.success) {
        const issues: Record<string, string[]> = {};
        for (const issue of payloadParseResult.error.issues) {
          const path = issue.path.join('.') || 'payload';
          if (!issues[path]) {
            issues[path] = [];
          }
          issues[path].push(issue.message);
        }
        throw new EntitySchemaValidationError('Dynamic schema validation failed for entity payload.', issues);
      }

      const validatedPayload = payloadParseResult.data as Record<string, unknown>;

      // 7. Generazione ID tecnico e costruzione del modello tramite Domain Factory
      const entityId = this.idGenerator.generate();
      const entity = Entity.create(
        entityId,
        entityType.id,
        parentNode.id,
        validatedCmd.name,
        validatedCmd.description ?? '',
        validatedCmd.actorUserId,
        validatedPayload
      );

      // 8. Persistenza, revisione e audit atomico
      await this.entityRepository.create(entity);
      await this.resourceRelationshipService?.synchronize({
        actorUserId: validatedCmd.actorUserId,
        sourceDomain: 'entity',
        sourceResourceId: entity.id,
        sourceTypeKey: entityType.typeKey,
        payload: entity.payload,
      });
      await this.revisionPort.recordEntityRevision(entity, 'created', validatedCmd.actorUserId);
      await this.auditPort.record(
        validatedCmd.actorUserId,
        'entity.create',
        'entity',
        entity.id,
        parentNode.id,
        null,
        entityAuditSnapshot(entity)
      );
      await this.publishWorkflowEvent(
        'record.created',
        { kind: 'entity', id: entity.id, typeKey: entityType.typeKey, scopeId: entity.parentNodeId },
        validatedCmd.actorUserId,
        validatedCmd.actorSessionId,
        `record.created:entity:${entity.id}:${entity.rowVersion}`,
        { parentNodeId: entity.parentNodeId, rowVersion: entity.rowVersion },
      );

      return entity;
    });
  }

  async updateEntity(cmd: UpdateEntityCommand): Promise<Entity> {
    // 1. Validazione strutturale del command (Zod)
    const parseResult = UpdateEntityCommandSchema.safeParse(cmd);
    if (!parseResult.success) {
      const issues: Record<string, string[]> = {};
      for (const issue of parseResult.error.issues) {
        const path = issue.path.join('.') || 'root';
        if (!issues[path]) {
          issues[path] = [];
        }
        issues[path].push(issue.message);
      }
      throw new EntityCommandValidationError('Validation failed for updating entity.', issues);
    }

    const validatedCmd = parseResult.data;

    return await this.transactionPort.runInTransaction(async () => {
      // 2. Caricamento dell'entità reale e controllo di esistenza
      const entity = await this.entityRepository.findById(validatedCmd.entityId);
      if (!entity || entity.deletedAt) {
        throw new EntityNotFoundError(validatedCmd.entityId);
      }

      // Concurrency check (optimistic lock)
      if (entity.rowVersion !== validatedCmd.expectedRowVersion) {
        throw new RowVersionMismatchError(validatedCmd.expectedRowVersion, entity.rowVersion);
      }

      // 3. Risoluzione Tipo Entità (ricerca tramite ID del tipo)
      const entityType = await this.entityTypeRepository.findById(entity.entityTypeId);
      if (!entityType) {
        throw new EntityTypeNotFoundError(entity.entityTypeId, 'id');
      }

      // 4. Autorizzazioni
      await this.accessControlPort.assertCanEditEntity(validatedCmd.actorUserId, entity.id);

      // 5. Editing an existing entity requires the lock on that entity.
      const isLockingEnabled = await this.runtimeConfigPort.isCapabilityEnabled('locking');
      if (isLockingEnabled) {
        await this.lockService.requireOwnedLock({ resourceType: 'entity', resourceId: entity.id }, validatedCmd.actorUserId, validatedCmd.actorSessionId);
      }

      let updatedPayload = entity.payload;

      // 6. Validazione del payload delta contro lo schema parziale dinamico
      // LIMITI DI schema.partial():
      // - Rende tutti i campi opzionali (undefined). Se il client invia un valore mancante, Zod lo ignora.
      // - LIMITAZIONE MERGE-PATCH: Non consente esplicitamente l'invio di null per "cancellare" un campo a meno che
      //   lo schema originario non sia definito come .nullable().
      // - LIMITAZIONE VINCOLI MULTI-CAMPO: Eventuali validazioni incrociate definite a livello di schema generale 
      //   (es. "se X è compilato, allora Y deve essere compilato") vengono saltate poiché Zod convalida solo il delta.
      if (validatedCmd.payloadDelta) {
        const dynamicSchema = await this.schemaRegistry.getSchema(entityType.typeKey);
        if (!dynamicSchema) {
          throw new EntitySchemaValidationError(`No schema found or compiled for entity type: '${entityType.typeKey}'`, {
            entityTypeKey: [entityType.typeKey],
          });
        }

        const partialSchema = dynamicSchema.partial();
        const payloadParseResult = partialSchema.safeParse(validatedCmd.payloadDelta);
        if (!payloadParseResult.success) {
          const issues: Record<string, string[]> = {};
          for (const issue of payloadParseResult.error.issues) {
            const path = issue.path.join('.') || 'payload';
            if (!issues[path]) {
              issues[path] = [];
            }
            issues[path].push(issue.message);
          }
          throw new EntitySchemaValidationError('Dynamic schema validation failed for entity update payload.', issues);
        }

        const validatedDelta = payloadParseResult.data as Record<string, unknown>;
        updatedPayload = { ...entity.payload, ...validatedDelta };

        const completePayloadResult = dynamicSchema.safeParse(updatedPayload);
        if (!completePayloadResult.success) {
          const issues: Record<string, string[]> = {};
          for (const issue of completePayloadResult.error.issues) {
            const path = issue.path.join('.') || 'payload';
            (issues[path] ??= []).push(issue.message);
          }
          throw new EntitySchemaValidationError('Updated entity payload violates the complete dynamic schema.', issues);
        }
        updatedPayload = completePayloadResult.data as Record<string, unknown>;
      }

      // Aggiornamento tramite metodo di dominio (name e description sono controllati top-level)
      const updatedEntity = entity.update(
        validatedCmd.name !== undefined ? validatedCmd.name : entity.name,
        validatedCmd.description !== undefined ? validatedCmd.description : entity.description,
        updatedPayload,
        validatedCmd.actorUserId
      );

      // 7. Persistenza, revisione e audit
      await this.entityRepository.update(updatedEntity);
      await this.resourceRelationshipService?.synchronize({
        actorUserId: validatedCmd.actorUserId,
        sourceDomain: 'entity',
        sourceResourceId: updatedEntity.id,
        sourceTypeKey: entityType.typeKey,
        payload: updatedEntity.payload,
      });
      await this.revisionPort.recordEntityRevision(updatedEntity, 'updated', validatedCmd.actorUserId);
      await this.auditPort.record(
        validatedCmd.actorUserId,
        'entity.update',
        'entity',
        updatedEntity.id,
        updatedEntity.parentNodeId,
        entityAuditSnapshot(entity),
        entityAuditSnapshot(updatedEntity),
      );
      await this.publishWorkflowEvent(
        'record.updated',
        { kind: 'entity', id: updatedEntity.id, typeKey: entityType.typeKey, scopeId: updatedEntity.parentNodeId },
        validatedCmd.actorUserId,
        validatedCmd.actorSessionId,
        `record.updated:entity:${updatedEntity.id}:${updatedEntity.rowVersion}`,
        { parentNodeId: updatedEntity.parentNodeId, rowVersion: updatedEntity.rowVersion },
      );

      return updatedEntity;
    });
  }

  async deleteEntity(cmd: DeleteEntityCommand): Promise<void> {
    const parseResult = DeleteEntityCommandSchema.safeParse(cmd);
    if (!parseResult.success) {
      const issues: Record<string, string[]> = {};
      for (const issue of parseResult.error.issues) {
        const path = issue.path.join('.') || 'root';
        if (!issues[path]) {
          issues[path] = [];
        }
        issues[path].push(issue.message);
      }
      throw new EntityCommandValidationError('Validation failed for deleting entity.', issues);
    }

    const validatedCmd = parseResult.data;

    return await this.transactionPort.runInTransaction(async () => {
      // 2. Caricamento e controllo esistenza
      const entity = await this.entityRepository.findById(validatedCmd.entityId);
      if (!entity || entity.deletedAt) {
        throw new EntityNotFoundError(validatedCmd.entityId);
      }

      // 3. Autorizzazioni
      await this.accessControlPort.assertCanDeleteEntity(
        validatedCmd.actorUserId,
        entity.id
      );

      // 4. Locking
      const isLockingEnabled = await this.runtimeConfigPort.isCapabilityEnabled('locking');
      if (isLockingEnabled) {
        await this.lockService.requireOwnedLock({ resourceType: 'entity', resourceId: entity.id }, validatedCmd.actorUserId, validatedCmd.actorSessionId);
      }

      // 5. Persistenza (Soft Delete)
      await this.entityRepository.softDelete(entity.id, validatedCmd.actorUserId, validatedCmd.expectedRowVersion);

      // Creiamo l'entità nello stato eliminata per revisioni/audit
      const deletedEntity = new Entity(
        entity.id,
        entity.entityTypeId,
        entity.parentNodeId,
        entity.name,
        entity.description,
        entity.rowVersion + 1,
        entity.createdAt,
        new Date(),
        new Date(), // deletedAt
        entity.createdBy,
        validatedCmd.actorUserId,
        entity.payload
      );

      await this.revisionPort.recordEntityRevision(deletedEntity, 'soft_deleted', validatedCmd.actorUserId);
      await this.auditPort.record(
        validatedCmd.actorUserId,
        'entity.delete',
        'entity',
        entity.id,
        entity.parentNodeId,
        entity.payload,
        null
      );
      await this.publishWorkflowEvent(
        'record.deleted',
        { kind: 'entity', id: entity.id, scopeId: entity.parentNodeId },
        validatedCmd.actorUserId,
        validatedCmd.actorSessionId,
        `record.deleted:entity:${entity.id}:${deletedEntity.rowVersion}`,
        { parentNodeId: entity.parentNodeId, rowVersion: deletedEntity.rowVersion },
      );
    });
  }

  async getEntityById(entityId: string, actorUserId: string): Promise<Entity> {
    const entity = await this.entityRepository.findById(entityId);
    if (!entity || entity.deletedAt) {
      throw new EntityNotFoundError(entityId);
    }
    await this.accessControlPort.assertCanReadNode(actorUserId, entity.parentNodeId);
    await this.accessControlPort.assertHasPermission(actorUserId, 'entity.read', entity.parentNodeId);
    const entityType = await this.entityTypeRepository.findById(entity.entityTypeId);
    if (!entityType || !this.resourceRelationshipService) return entity;
    return this.withHydratedRelationships(entity, entityType.typeKey);
  }

  async listDeletedEntities(actorUserId: string, limit?: number, offset?: number) {
    return await this.entityRepository.listDeletedByScope(actorUserId, limit, offset);
  }

  async getDeletedEntityById(entityId: string, actorUserId: string): Promise<Entity> {
    const entity = await this.entityRepository.findDeletedById(entityId);
    if (!entity || !entity.deletedAt) throw new EntityNotFoundError(entityId);
    const assertRestore = this.accessControlPort.assertHasPermissionIncludingDeleted?.bind(this.accessControlPort)
      ?? this.accessControlPort.assertHasPermission.bind(this.accessControlPort);
    await assertRestore(actorUserId, 'entity.restore', entity.parentNodeId);
    return entity;
  }

  async restoreEntity(cmd: RestoreEntityCommand): Promise<void> {
    const parseResult = RestoreEntityCommandSchema.safeParse(cmd);
    if (!parseResult.success) {
      throw new EntityCommandValidationError('Validation failed for restoring entity.', {
        root: parseResult.error.issues.map((issue) => issue.message),
      });
    }
    const validatedCmd = parseResult.data;

    await this.transactionPort.runInTransaction(async () => {
      const entity = await this.entityRepository.findDeletedById(validatedCmd.entityId);
      if (!entity || !entity.deletedAt) throw new EntityNotFoundError(validatedCmd.entityId);
      if (entity.rowVersion !== validatedCmd.expectedRowVersion) {
        throw new RowVersionMismatchError(validatedCmd.expectedRowVersion, entity.rowVersion);
      }

      const assertRestore = this.accessControlPort.assertHasPermissionIncludingDeleted?.bind(this.accessControlPort)
        ?? this.accessControlPort.assertHasPermission.bind(this.accessControlPort);
      await assertRestore(validatedCmd.actorUserId, 'entity.restore', entity.parentNodeId);
      const isLockingEnabled = await this.runtimeConfigPort.isCapabilityEnabled('locking');
      if (isLockingEnabled) {
        await this.lockService.requireOwnedLock({ resourceType: 'entity', resourceId: entity.id }, validatedCmd.actorUserId, validatedCmd.actorSessionId);
      }
      const parentNode = await this.nodeRepository.findById(entity.parentNodeId);
      if (!parentNode) throw new NodeNotFoundError(entity.parentNodeId);
      const entityType = await this.entityTypeRepository.findById(entity.entityTypeId);
      if (!entityType) throw new EntityTypeNotFoundError(entity.entityTypeId, 'id');
      if (!entityType.isActive) {
        throw new EntityCommandValidationError('Cannot restore an entity whose type is disabled.', {
          entityTypeId: [entity.entityTypeId],
        });
      }

      await this.entityRepository.restore(entity.id, validatedCmd.actorUserId, validatedCmd.expectedRowVersion);
      const restored = new Entity(
        entity.id, entity.entityTypeId, entity.parentNodeId, entity.name, entity.description,
        entity.rowVersion + 1, entity.createdAt, new Date(), null, entity.createdBy,
        validatedCmd.actorUserId, entity.payload,
      );
      await this.revisionPort.recordEntityRevision(restored, 'restored', validatedCmd.actorUserId);
      await this.auditPort.record(
        validatedCmd.actorUserId, 'entity.restore', 'entity', entity.id, entity.parentNodeId,
        { deletedAt: entity.deletedAt.toISOString() }, { deletedAt: null },
      );
      await this.publishWorkflowEvent(
        'record.restored',
        { kind: 'entity', id: restored.id, typeKey: entityType.typeKey, scopeId: restored.parentNodeId },
        validatedCmd.actorUserId,
        validatedCmd.actorSessionId,
        `record.restored:entity:${restored.id}:${restored.rowVersion}`,
        { parentNodeId: restored.parentNodeId, rowVersion: restored.rowVersion },
      );
    });
  }

  async listEntitiesByNode(
    parentNodeId: string,
    actorUserId: string,
    limit?: number,
    offset?: number
  ): Promise<Entity[]> {
    const parentNode = await this.nodeRepository.findById(parentNodeId);
    if (!parentNode) {
      throw new NodeNotFoundError(parentNodeId);
    }
    await this.accessControlPort.assertCanReadNode(actorUserId, parentNodeId);
    await this.accessControlPort.assertHasPermission(actorUserId, 'entity.read', parentNodeId);
    const entities = await this.entityRepository.listByNode(parentNodeId, limit, offset);
    if (!this.resourceRelationshipService) return entities;
    return Promise.all(entities.map(async (entity) => {
      const entityType = await this.entityTypeRepository.findById(entity.entityTypeId);
      return entityType ? this.withHydratedRelationships(entity, entityType.typeKey) : entity;
    }));
  }

  async listEntityTypes(): Promise<{ id: string; typeKey: string; name: string; description: string; storageTable: string; currentSchemaVersion: number }[]> {
    const types = await this.entityTypeRepository.listAll();
    return types.map((t) => ({
      id: t.id,
      typeKey: t.typeKey,
      name: t.name,
      description: t.description,
      storageTable: t.storageTable,
      currentSchemaVersion: t.currentSchemaVersion,
    }));
  }

  private async withHydratedRelationships(entity: Entity, typeKey: string): Promise<Entity> {
    const payload = await this.resourceRelationshipService!.hydratePayload(
      'entity',
      entity.id,
      typeKey,
      entity.payload,
    );
    return new Entity(
      entity.id,
      entity.entityTypeId,
      entity.parentNodeId,
      entity.name,
      entity.description,
      entity.rowVersion,
      entity.createdAt,
      entity.updatedAt,
      entity.deletedAt,
      entity.createdBy,
      entity.updatedBy,
      payload,
    );
  }

  private async publishWorkflowEvent(
    eventType: string,
    subject: EventSubject,
    actorUserId: string,
    actorSessionId: string | undefined,
    idempotencyKey: string,
    payload: Readonly<Record<string, unknown>>,
  ): Promise<void> {
    if (!this.workflowEventPublisher) return;
    await this.workflowEventPublisher.publish(createUserWorkflowEvent({
      eventType,
      subject,
      actorUserId,
      ...(actorSessionId ? { actorSessionId } : {}),
      correlationId: actorSessionId ?? actorUserId,
      idempotencyKey,
      payload,
    }));
  }
}
