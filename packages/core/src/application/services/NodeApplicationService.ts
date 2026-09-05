/** Orchestrates authorized hierarchical node lifecycle operations through application ports. */

import { Node } from '../../domain/models/Node.js';
import type { NodeRepository } from '../ports/NodeRepository.js';
import type { NodeTypeRepository } from '../ports/NodeTypeRepository.js';
import type { AccessControlPort } from '../ports/AccessControlPort.js';
import type { LockService } from './LockService.js';
import type { AuditPort } from '../ports/AuditPort.js';
import type { RevisionPort } from '../ports/RevisionPort.js';
import type { RuntimeConfigurationPort } from '../ports/RuntimeConfigurationPort.js';
import type { IdGeneratorPort } from '../ports/IdGeneratorPort.js';
import type { TransactionPort } from '../ports/TransactionPort.js';
import type { SchemaRegistry } from '../ports/SchemaRegistry.js';
import type { NodePathPolicy } from '../../domain/policies/NodePathPolicy.js';
import type { ResourceRelationshipService } from './ResourceRelationshipService.js';
import type { ResourceDeletionPolicyService } from './ResourceDeletionPolicyService.js';
import { nodeAuditSnapshot } from './ResourceAuditSnapshot.js';
import { createUserWorkflowEvent } from './WorkflowEventFactory.js';
import type { WorkflowEventPublisher } from '../ports/WorkflowEventPublisher.js';
import type { EventSubject } from '../../domain/events/WorkflowEvent.js';

import type { CreateNodeCommand, UpdateNodeCommand, MoveNodeCommand, DeleteNodeCommand, RestoreNodeCommand} from '../commands/NodeCommands.js';
import { CreateNodeCommandSchema, UpdateNodeCommandSchema, MoveNodeCommandSchema, DeleteNodeCommandSchema, RestoreNodeCommandSchema } from '../commands/NodeCommands.js';
import { ForbiddenError, ValidationError, CapabilityDisabledError } from '../../domain/errors/ApplicationErrors.js';
import { NodeNotFoundError, RowVersionMismatchError, NodeTypeNotFoundError, NodePathCollisionError, NodeCyclicMoveError } from '../../domain/errors/DomainErrors.js';

export class NodeApplicationService {
  constructor(
    private readonly nodeRepository: NodeRepository,
    private readonly nodeTypeRepository: NodeTypeRepository,
    private readonly accessControlPort: AccessControlPort,
    private readonly lockService: LockService,
    private readonly auditPort: AuditPort,
    private readonly revisionPort: RevisionPort,
    private readonly runtimeConfigPort: RuntimeConfigurationPort,
    private readonly idGenerator: IdGeneratorPort,
    private readonly pathPolicy: NodePathPolicy,
    private readonly transactionPort: TransactionPort,
    private readonly schemaRegistry?: SchemaRegistry,
    private readonly resourceRelationshipService?: ResourceRelationshipService,
    private readonly workflowEventPublisher?: WorkflowEventPublisher,
    private readonly resourceDeletionPolicyService?: ResourceDeletionPolicyService,
  ) {}

  async createNode(cmd: CreateNodeCommand): Promise<Node> {
    // 1. Validazione input strutturale al boundary (Zod)
    const parseResult = CreateNodeCommandSchema.safeParse(cmd);
    if (!parseResult.success) {
      const issues: Record<string, string[]> = {};
      for (const issue of parseResult.error.issues) {
        const path = issue.path.join('.') || 'root';
        if (!issues[path]) {
          issues[path] = [];
        }
        issues[path].push(issue.message);
      }
      throw new ValidationError('Validation failed for creating node.', issues);
    }

    const validatedCmd = parseResult.data;

    // 2. Controllo capabilities runtime (non-transazionale)
    const isHierarchicalEnabled = await this.runtimeConfigPort.isCapabilityEnabled('hierarchical_structure');
    if (!isHierarchicalEnabled) {
      throw new CapabilityDisabledError('hierarchical_structure');
    }

    // Esecuzione atomica all'interno del boundary transazionale
    return await this.transactionPort.runInTransaction(async () => {
      // 3. Risoluzione e validazione del Node Type
      const nodeType = await this.nodeTypeRepository.findByKey(validatedCmd.nodeTypeKey);
      if (!nodeType) {
        throw new NodeTypeNotFoundError(validatedCmd.nodeTypeKey);
      }

      // 4. Risoluzione dei permessi e scope (Authorization)
      await this.accessControlPort.assertCanCreateNode(
        validatedCmd.actorUserId,
        validatedCmd.parentNodeId,
        validatedCmd.nodeTypeKey
      );

      // 5. The parent supplies placement only: creation never mutates or locks it.
      let parentNode: Node | null = null;
      if (validatedCmd.parentNodeId) {
        parentNode = await this.nodeRepository.findById(validatedCmd.parentNodeId);
        if (!parentNode) {
          throw new NodeNotFoundError(validatedCmd.parentNodeId);
        }
      }

      // 6. Generazione ID tecnico e costruzione del modello tramite Domain Factory
      const nodeId = this.idGenerator.generate();
      const payload = validatedCmd.payload ?? {};
      if (this.schemaRegistry) {
        const dynamicSchema = await this.schemaRegistry.getSchema('node', validatedCmd.nodeTypeKey);
        if (dynamicSchema) {
          const payloadResult = dynamicSchema.safeParse(payload);
          if (!payloadResult.success) {
            const issues: Record<string, string[]> = {};
            for (const issue of payloadResult.error.issues) {
              const path = issue.path.join('.') || 'payload';
              (issues[path] ??= []).push(issue.message);
            }
            throw new ValidationError('Dynamic schema validation failed for node payload.', issues);
          }
        }
      }
      const node = Node.create(
        nodeId,
        parentNode,
        nodeType,
        validatedCmd.name,
        validatedCmd.description ?? '',
        validatedCmd.actorUserId,
        this.pathPolicy,
        payload
      );

      // 7. Controllo collisione pathLabel tra sibling
      const exists = await this.nodeRepository.existsByParentAndPathLabel(node.parentId, node.pathLabel);
      if (exists) {
        throw new NodePathCollisionError(node.parentId, node.pathLabel);
      }

      // 8. Persistenza, revisione e audit
      await this.nodeRepository.create(node);
      await this.resourceRelationshipService?.synchronize({
        actorUserId: validatedCmd.actorUserId,
        sourceDomain: 'node',
        sourceResourceId: node.id,
        sourceTypeKey: nodeType.typeKey,
        payload: node.payload,
      });
      await this.revisionPort.recordNodeRevision(node, 'created', validatedCmd.actorUserId);
      await this.auditPort.record(
        validatedCmd.actorUserId,
        'node.create',
        'node',
        node.id,
        node.id,
        null,
        nodeAuditSnapshot(node)
      );
      await this.publishWorkflowEvent(
        'record.created',
        { kind: 'node', id: node.id, typeKey: nodeType.typeKey, scopeId: node.parentId },
        validatedCmd.actorUserId,
        validatedCmd.actorSessionId,
        `record.created:node:${node.id}:${node.rowVersion}`,
        { parentNodeId: node.parentId, rowVersion: node.rowVersion },
      );

      return node;
    });
  }

  async moveNode(cmd: MoveNodeCommand): Promise<string[]> {
    // 1. Validazione strutturale del command
    const parseResult = MoveNodeCommandSchema.safeParse(cmd);
    if (!parseResult.success) {
      const issues: Record<string, string[]> = {};
      for (const issue of parseResult.error.issues) {
        const path = issue.path.join('.') || 'root';
        if (!issues[path]) {
          issues[path] = [];
        }
        issues[path].push(issue.message);
      }
      throw new ValidationError('Validation failed for moving node.', issues);
    }

    const validatedCmd = parseResult.data;

    // 2. Controllo capabilities runtime
    const isHierarchicalEnabled = await this.runtimeConfigPort.isCapabilityEnabled('hierarchical_structure');
    if (!isHierarchicalEnabled) {
      throw new CapabilityDisabledError('hierarchical_structure');
    }

    return await this.transactionPort.runInTransaction(async () => {
      // 3. Caricamento del nodo da spostare
      const node = await this.nodeRepository.findById(validatedCmd.nodeId);
      if (!node) {
        throw new NodeNotFoundError(validatedCmd.nodeId);
      }

      // 4. Early concurrency check for precise error reporting. The repository
      // repeats it in the write statement, where it is authoritative.
      if (node.rowVersion !== validatedCmd.expectedNodeRowVersion) {
        throw new RowVersionMismatchError(validatedCmd.expectedNodeRowVersion, node.rowVersion);
      }

      // 5. Controllo anti-ciclo: impedisci spostamento sotto sé stesso o sotto un discendente
      const isLockingEnabled = await this.runtimeConfigPort.isCapabilityEnabled('locking');
      if (isLockingEnabled) {
        await this.lockService.requireOwnedLock({ resourceType: 'node', resourceId: node.id }, validatedCmd.actorUserId, validatedCmd.actorSessionId);
      }

      if (validatedCmd.newParentNodeId !== null) {
        // 5a. Self-move check
        if (validatedCmd.nodeId === validatedCmd.newParentNodeId) {
          throw new NodeCyclicMoveError(validatedCmd.nodeId, validatedCmd.newParentNodeId);
        }

        // 5b. Descendant check — il nuovo parent non deve essere un discendente del nodo spostato
        const isDescendant = await this.nodeRepository.isDescendantOf(
          validatedCmd.newParentNodeId,
          validatedCmd.nodeId
        );
        if (isDescendant) {
          throw new NodeCyclicMoveError(validatedCmd.nodeId, validatedCmd.newParentNodeId);
        }

        // 5c. Verifica che il nuovo parent esista
        const newParent = await this.nodeRepository.findById(validatedCmd.newParentNodeId);
        if (!newParent) {
          throw new NodeNotFoundError(validatedCmd.newParentNodeId);
        }

        // 5d. Locking sul nuovo parent
        if (isLockingEnabled) {
          await this.lockService.requireOwnedLock({ resourceType: 'node', resourceId: newParent.id }, validatedCmd.actorUserId, validatedCmd.actorSessionId);
        }

        // 5e. Verifica collisione pathLabel nel nuovo parent
        const collision = await this.nodeRepository.existsByParentAndPathLabel(
          validatedCmd.newParentNodeId,
          node.pathLabel
        );
        if (collision) {
          throw new NodePathCollisionError(validatedCmd.newParentNodeId, node.pathLabel);
        }
      }

      // 6. Authorization
      await this.accessControlPort.assertCanMoveNode(
        validatedCmd.actorUserId,
        validatedCmd.nodeId,
        validatedCmd.newParentNodeId
      );

      // 7. Persistenza: spostamento atomico del sottoalbero
      await this.nodeRepository.moveSubtree(
        validatedCmd.nodeId,
        validatedCmd.newParentNodeId,
        validatedCmd.actorUserId,
        validatedCmd.expectedNodeRowVersion,
      );

      // 8. Revisione e audit
      // Ricarichiamo il nodo aggiornato per la revisione
      const movedNode = await this.nodeRepository.findById(validatedCmd.nodeId);
      const movedSubtree = await this.nodeRepository.listSubtree(validatedCmd.nodeId);
      for (const subtreeNode of movedSubtree) {
        await this.revisionPort.recordNodeRevision(subtreeNode, 'moved', validatedCmd.actorUserId);
      }
      await this.auditPort.record(
        validatedCmd.actorUserId,
        'node.move',
        'node',
        validatedCmd.nodeId,
        validatedCmd.nodeId,
        { parentId: node.parentId, path: node.path },
        { parentId: validatedCmd.newParentNodeId, path: movedNode?.path ?? null }
      );
      await this.publishWorkflowEvent(
        'hierarchy.moved',
        { kind: 'node', id: node.id, scopeId: validatedCmd.newParentNodeId },
        validatedCmd.actorUserId,
        validatedCmd.actorSessionId,
        `hierarchy.moved:node:${node.id}:${movedNode?.rowVersion ?? node.rowVersion}`,
        {
          previousParentNodeId: node.parentId,
          parentNodeId: validatedCmd.newParentNodeId,
          movedNodeIds: movedSubtree.map((subtreeNode) => subtreeNode.id),
          rowVersion: movedNode?.rowVersion ?? node.rowVersion,
        },
      );
      return movedSubtree.map((subtreeNode) => subtreeNode.id);
    });
  }

  async updateNode(cmd: UpdateNodeCommand): Promise<Node> {
    const parseResult = UpdateNodeCommandSchema.safeParse(cmd);
    if (!parseResult.success) {
      const issues: Record<string, string[]> = {};
      for (const issue of parseResult.error.issues) {
        const path = issue.path.join('.') || 'root';
        if (!issues[path]) {
          issues[path] = [];
        }
        issues[path].push(issue.message);
      }
      throw new ValidationError('Validation failed for updating node.', issues);
    }

    const validatedCmd = parseResult.data;

    const isHierarchicalEnabled = await this.runtimeConfigPort.isCapabilityEnabled('hierarchical_structure');
    if (!isHierarchicalEnabled) {
      throw new CapabilityDisabledError('hierarchical_structure');
    }

    return await this.transactionPort.runInTransaction(async () => {
      const node = await this.nodeRepository.findById(validatedCmd.nodeId);
      if (!node) {
        throw new NodeNotFoundError(validatedCmd.nodeId);
      }

      if (node.rowVersion !== validatedCmd.expectedRowVersion) {
        throw new RowVersionMismatchError(validatedCmd.expectedRowVersion, node.rowVersion);
      }

      await this.accessControlPort.assertHasPermission(
        validatedCmd.actorUserId,
        'node.edit',
        node.id
      );

      const isLockingEnabled = await this.runtimeConfigPort.isCapabilityEnabled('locking');
      if (isLockingEnabled) {
        await this.lockService.requireOwnedLock({ resourceType: 'node', resourceId: node.id }, validatedCmd.actorUserId, validatedCmd.actorSessionId);
      }

      const updatedPayload = validatedCmd.payloadDelta
        ? { ...node.payload, ...validatedCmd.payloadDelta }
        : node.payload;
      const nodeType = await this.nodeTypeRepository.findById(node.nodeTypeId);
      if (this.schemaRegistry && validatedCmd.payloadDelta) {
        const dynamicSchema = nodeType
          ? await this.schemaRegistry.getSchema('node', nodeType.typeKey)
          : null;
        if (dynamicSchema) {
          const payloadResult = dynamicSchema.safeParse(updatedPayload);
          if (!payloadResult.success) {
            const issues: Record<string, string[]> = {};
            for (const issue of payloadResult.error.issues) {
              const path = issue.path.join('.') || 'payload';
              (issues[path] ??= []).push(issue.message);
            }
            throw new ValidationError('Dynamic schema validation failed for node payload.', issues);
          }
        }
      }
      const updatedWithPayload = node.update(
        validatedCmd.name !== undefined ? validatedCmd.name : node.name,
        validatedCmd.description !== undefined ? validatedCmd.description : node.description,
        validatedCmd.actorUserId,
        updatedPayload,
      );

      await this.nodeRepository.update(updatedWithPayload);
      if (nodeType) {
        await this.resourceRelationshipService?.synchronize({
          actorUserId: validatedCmd.actorUserId,
          sourceDomain: 'node',
          sourceResourceId: updatedWithPayload.id,
          sourceTypeKey: nodeType.typeKey,
          payload: updatedWithPayload.payload,
        });
      }
      await this.revisionPort.recordNodeRevision(updatedWithPayload, 'updated', validatedCmd.actorUserId);
      await this.auditPort.record(
        validatedCmd.actorUserId,
        'node.update',
        'node',
        node.id,
        node.id,
        nodeAuditSnapshot(node),
        nodeAuditSnapshot(updatedWithPayload)
      );
      await this.publishWorkflowEvent(
        'record.updated',
        {
          kind: 'node',
          id: updatedWithPayload.id,
          scopeId: updatedWithPayload.parentId,
          ...(nodeType ? { typeKey: nodeType.typeKey } : {}),
        },
        validatedCmd.actorUserId,
        validatedCmd.actorSessionId,
        `record.updated:node:${updatedWithPayload.id}:${updatedWithPayload.rowVersion}`,
        { parentNodeId: updatedWithPayload.parentId, rowVersion: updatedWithPayload.rowVersion },
      );

      return updatedWithPayload;
    });
  }

  async deleteNode(cmd: DeleteNodeCommand): Promise<void> {
    const parseResult = DeleteNodeCommandSchema.safeParse(cmd);
    if (!parseResult.success) throw new ValidationError('Validation failed for deleting node.', { root: parseResult.error.issues.map((issue) => issue.message) });
    const validatedCmd = parseResult.data;
    await this.transactionPort.runInTransaction(async () => {
      const node = await this.nodeRepository.findById(validatedCmd.nodeId);
      if (!node) throw new NodeNotFoundError(validatedCmd.nodeId);
      if (node.rowVersion !== validatedCmd.expectedRowVersion) throw new RowVersionMismatchError(validatedCmd.expectedRowVersion, node.rowVersion);
      await this.accessControlPort.assertHasPermission(validatedCmd.actorUserId, 'node.delete', node.id);
      if (await this.runtimeConfigPort.isCapabilityEnabled('locking')) {
        await this.lockService.requireOwnedLock({ resourceType: 'node', resourceId: node.id }, validatedCmd.actorUserId, validatedCmd.actorSessionId);
        await this.nodeRepository.assertSubtreeUnlocked(node.id, validatedCmd.actorUserId, validatedCmd.actorSessionId);
      }
      const batchId = this.idGenerator.generate();
      const deletionResources = this.resourceDeletionPolicyService
        ? await this.resourceDeletionPolicyService.resourcesForSubtree(node.id)
        : [{ domain: 'node' as const, resourceId: node.id }];
      await this.resourceDeletionPolicyService?.assertRestrictAndSuspend(validatedCmd.actorUserId, deletionResources, batchId);
      const affectedIds = await this.nodeRepository.softDeleteSubtree(node.id, validatedCmd.actorUserId, validatedCmd.expectedRowVersion, batchId);
      // A subtree delete is one user intention. Its descendants are persisted
      // consequences, not independent audit or workflow causes.
      await this.auditPort.record(
        validatedCmd.actorUserId,
        'node.delete',
        'node',
        node.id,
        node.id,
        null,
        { deletionBatchId: batchId, affectedNodeCount: affectedIds.length },
      );
      await this.publishWorkflowEvent(
        'record.deleted',
        { kind: 'node', id: node.id, scopeId: node.parentId },
        validatedCmd.actorUserId,
        validatedCmd.actorSessionId,
        `record.deleted:node:${node.id}:${batchId}`,
        { deletionBatchId: batchId, rootNodeId: node.id, affectedNodeCount: affectedIds.length },
      );
    });
  }

  async listDeletedNodes(actorUserId: string, limit?: number, offset?: number) {
    return await this.nodeRepository.listDeletedByScope(actorUserId, limit, offset);
  }

  async getDeletedNodeById(nodeId: string, actorUserId: string): Promise<Node> {
    const node = await this.nodeRepository.findDeletedById(nodeId);
    if (!node || !node.deletedAt) throw new NodeNotFoundError(nodeId);
    const assertRestore = this.accessControlPort.assertHasPermissionIncludingDeleted?.bind(this.accessControlPort)
      ?? this.accessControlPort.assertHasPermission.bind(this.accessControlPort);
    await assertRestore(actorUserId, 'node.restore', node.id);
    return node;
  }

  async restoreNode(cmd: RestoreNodeCommand): Promise<void> {
    const parseResult = RestoreNodeCommandSchema.safeParse(cmd);
    if (!parseResult.success) throw new ValidationError('Validation failed for restoring node.', { root: parseResult.error.issues.map((issue) => issue.message) });
    const validatedCmd = parseResult.data;
    await this.transactionPort.runInTransaction(async () => {
      const node = await this.nodeRepository.findDeletedById(validatedCmd.nodeId);
      if (!node || !node.deletedAt) throw new NodeNotFoundError(validatedCmd.nodeId);
      if (node.rowVersion !== validatedCmd.expectedRowVersion) throw new RowVersionMismatchError(validatedCmd.expectedRowVersion, node.rowVersion);
      const assertRestore = this.accessControlPort.assertHasPermissionIncludingDeleted?.bind(this.accessControlPort)
        ?? this.accessControlPort.assertHasPermission.bind(this.accessControlPort);
      await assertRestore(validatedCmd.actorUserId, 'node.restore', node.id);
      if (node.parentId && !(await this.nodeRepository.findById(node.parentId))) {
        throw new NodeNotFoundError(node.parentId);
      }
      if (await this.runtimeConfigPort.isCapabilityEnabled('locking')) {
        await this.lockService.requireOwnedLock({ resourceType: 'node', resourceId: node.id }, validatedCmd.actorUserId, validatedCmd.actorSessionId);
      }
      const batchId = await this.nodeRepository.getDeletionBatchId(node.id);
      if (!batchId) throw new ValidationError('The node has no subtree deletion batch.', { nodeId: ['Missing deletion batch.'] });
      const restoreResources = this.resourceDeletionPolicyService
        ? await this.resourceDeletionPolicyService.resourcesForDeletedBatch(batchId, [])
        : [];
      const restoredIds = await this.nodeRepository.restoreSubtree(node.id, validatedCmd.actorUserId, validatedCmd.expectedRowVersion, batchId);
      const restoredResources = this.resourceDeletionPolicyService
        ? [...restoreResources, ...restoredIds.map((resourceId) => ({ domain: 'node' as const, resourceId }))]
        : restoredIds.map((resourceId) => ({ domain: 'node' as const, resourceId }));
      await this.resourceDeletionPolicyService?.restoreOutgoing(restoredResources, batchId);
      await this.auditPort.record(
        validatedCmd.actorUserId,
        'node.restore',
        'node',
        node.id,
        node.id,
        { deletionBatchId: batchId },
        { deletionBatchId: batchId, restoredNodeCount: restoredIds.length },
      );
      await this.publishWorkflowEvent(
        'record.restored',
        { kind: 'node', id: node.id, scopeId: node.parentId },
        validatedCmd.actorUserId,
        validatedCmd.actorSessionId,
        `record.restored:node:${node.id}:${batchId}`,
        { deletionBatchId: batchId, rootNodeId: node.id, restoredNodeCount: restoredIds.length },
      );
    });
  }

  // ─── Query / Read Operations ───────────────────────────────────

  async listChildren(parentId: string | null, actorUserId: string): Promise<Node[]> {
    // Root is not an ACL scope itself. Load its direct children and apply the
    // effective node.read policy to each returned node. The same filtering is
    // required below a readable parent because a descendant may be explicitly
    // denied.
    if (parentId) {
      await this.accessControlPort.assertCanReadNode(actorUserId, parentId);
    }
    if (this.nodeRepository.listReadableChildren) {
      const children = await this.nodeRepository.listReadableChildren(parentId, actorUserId);
      return this.hydrateRelationshipNodes(children, actorUserId);
    }
    const children = await this.nodeRepository.listChildren(parentId);
    const visibleChildren: Node[] = [];
    for (const child of children) {
      try {
        await this.accessControlPort.assertCanReadNode(actorUserId, child.id);
        visibleChildren.push(child);
      } catch (error) {
        if (!(error instanceof ForbiddenError)) throw error;
      }
    }
    return this.hydrateRelationshipNodes(visibleChildren, actorUserId);
  }

  async getNodeById(id: string, actorUserId: string): Promise<Node | null> {
    await this.accessControlPort.assertCanReadNode(actorUserId, id);
    const node = await this.nodeRepository.findById(id);
    return node ? this.withHydratedRelationships(node, actorUserId) : null;
  }

  async listBreadcrumb(nodeId: string, actorUserId: string): Promise<Node[]> {
    await this.accessControlPort.assertCanReadNode(actorUserId, nodeId);
    const ancestorIds = await this.nodeRepository.listAncestorIds(nodeId);
    if (ancestorIds.length === 0) throw new NodeNotFoundError(nodeId);

    const nearestFirst: Node[] = [];
    for (const [index, ancestorId] of ancestorIds.entries()) {
      if (index > 0) {
        try {
          await this.accessControlPort.assertCanReadNode(actorUserId, ancestorId);
        } catch (error) {
          if (error instanceof ForbiddenError) break;
          throw error;
        }
      }
      const ancestor = await this.nodeRepository.findById(ancestorId);
      if (!ancestor) break;
      nearestFirst.push(ancestor);
    }

    if (nearestFirst[0]?.id !== nodeId) throw new NodeNotFoundError(nodeId);
    return nearestFirst.reverse();
  }

  private async hydrateRelationshipNodes(nodes: readonly Node[], actorUserId: string): Promise<Node[]> {
    if (!this.resourceRelationshipService) return [...nodes];
    return Promise.all(nodes.map((node) => this.withHydratedRelationships(node, actorUserId)));
  }

  private async withHydratedRelationships(node: Node, actorUserId: string): Promise<Node> {
    if (!this.resourceRelationshipService) return node;
    const nodeType = await this.nodeTypeRepository.findById(node.nodeTypeId);
    if (!nodeType) return node;
    const payload = await this.resourceRelationshipService.hydratePayload(
      actorUserId, 'node',
      node.id,
      nodeType.typeKey,
      node.payload,
    );
    return new Node(
      node.id,
      node.parentId,
      node.path,
      node.pathLabel,
      node.depth,
      node.nodeTypeId,
      node.name,
      node.description,
      node.rowVersion,
      node.createdAt,
      node.updatedAt,
      node.deletedAt,
      node.createdBy,
      node.updatedBy,
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

  async listNodeTypes(): Promise<{ id: string; typeKey: string; name: string; description: string; currentSchemaVersion: number }[]> {
    const types = (await this.nodeTypeRepository.listAll()).filter((type) => type.isActive);
    return types.map((t) => ({
      id: t.id,
      typeKey: t.typeKey,
      name: t.name,
      description: t.description,
      currentSchemaVersion: t.currentSchemaVersion,
    }));
  }
}
