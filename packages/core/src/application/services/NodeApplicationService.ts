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
    private readonly schemaRegistry?: SchemaRegistry
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

      // 5. Caricamento del parent reale e controlli concorrenza/lock
      let parentNode: Node | null = null;
      if (validatedCmd.parentNodeId) {
        parentNode = await this.nodeRepository.findById(validatedCmd.parentNodeId);
        if (!parentNode) {
          throw new NodeNotFoundError(validatedCmd.parentNodeId);
        }

        // Optimistic concurrency check
        if (validatedCmd.expectedParentRowVersion !== undefined && parentNode.rowVersion !== validatedCmd.expectedParentRowVersion) {
          throw new RowVersionMismatchError(validatedCmd.expectedParentRowVersion, parentNode.rowVersion);
        }

        // Concurrency locking check basato su runtime capability ed eseguito esplicitamente sul parent
        const isLockingEnabled = await this.runtimeConfigPort.isCapabilityEnabled('locking');
        if (isLockingEnabled) {
          await this.lockService.requireOwnedLock({ resourceType: 'node', resourceId: parentNode.id }, validatedCmd.actorUserId, validatedCmd.actorSessionId);
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
      await this.revisionPort.recordNodeRevision(node, 'created', validatedCmd.actorUserId);
      await this.auditPort.record(
        validatedCmd.actorUserId,
        'node.create',
        'node',
        node.id,
        node.id,
        null,
        {
          id: node.id,
          name: node.name,
          nodeTypeId: node.nodeTypeId,
          nodeTypeKey: validatedCmd.nodeTypeKey,
          parentId: node.parentId,
          path: node.path,
          pathLabel: node.pathLabel,
          depth: node.depth,
        }
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

      // 4. Optimistic concurrency check sul nodo
      if (validatedCmd.expectedNodeRowVersion !== undefined && node.rowVersion !== validatedCmd.expectedNodeRowVersion) {
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
        validatedCmd.actorUserId
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

      const updated = node.update(
        validatedCmd.name !== undefined ? validatedCmd.name : node.name,
        validatedCmd.description !== undefined ? validatedCmd.description : node.description,
        validatedCmd.actorUserId
      );

      const updatedPayload = validatedCmd.payloadDelta
        ? { ...node.payload, ...validatedCmd.payloadDelta }
        : node.payload;
      if (this.schemaRegistry && validatedCmd.payloadDelta) {
        const nodeType = await this.nodeTypeRepository.findById(node.nodeTypeId);
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
      const updatedWithPayload = new Node(
        updated.id, updated.parentId, updated.path, updated.pathLabel, updated.depth,
        updated.nodeTypeId, updated.name, updated.description, updated.rowVersion,
        updated.createdAt, updated.updatedAt, updated.deletedAt, updated.createdBy,
        updated.updatedBy, updatedPayload
      );

      await this.nodeRepository.update(updatedWithPayload);
      await this.revisionPort.recordNodeRevision(updatedWithPayload, 'updated', validatedCmd.actorUserId);
      await this.auditPort.record(
        validatedCmd.actorUserId,
        'node.update',
        'node',
        node.id,
        node.id,
        { name: node.name, description: node.description },
        { name: updated.name, description: updated.description }
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
        await this.nodeRepository.assertSubtreeUnlocked(node.id, validatedCmd.actorUserId);
      }
      const batchId = this.idGenerator.generate();
      const affectedIds = await this.nodeRepository.softDeleteSubtree(node.id, validatedCmd.actorUserId, validatedCmd.expectedRowVersion, batchId);
      for (const affectedId of affectedIds) await this.auditPort.record(validatedCmd.actorUserId, 'node.delete', 'node', affectedId, node.id, null, { deletionBatchId: batchId });
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
      const restoredIds = await this.nodeRepository.restoreSubtree(node.id, validatedCmd.actorUserId, validatedCmd.expectedRowVersion, batchId);
      await this.auditPort.record(validatedCmd.actorUserId, 'node.restore', 'node', node.id, node.id, { deletionBatchId: batchId }, { restoredNodeIds: restoredIds });
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
      return this.nodeRepository.listReadableChildren(parentId, actorUserId);
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
    return visibleChildren;
  }

  async getNodeById(id: string, actorUserId: string): Promise<Node | null> {
    await this.accessControlPort.assertCanReadNode(actorUserId, id);
    return await this.nodeRepository.findById(id);
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
