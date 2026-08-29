/** Verifies node use-case invariants and generic workflow event publication. */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NodeApplicationService } from './NodeApplicationService.js';
import type { NodeRepository } from '../ports/NodeRepository.js';
import type { NodeTypeRepository } from '../ports/NodeTypeRepository.js';
import type { AccessControlPort } from '../ports/AccessControlPort.js';
import type { LockService } from './LockService.js';
import type { AuditPort } from '../ports/AuditPort.js';
import type { RevisionPort } from '../ports/RevisionPort.js';
import type { RuntimeConfigurationPort } from '../ports/RuntimeConfigurationPort.js';
import type { IdGeneratorPort } from '../ports/IdGeneratorPort.js';
import type { TransactionPort } from '../ports/TransactionPort.js';
import type { WorkflowEventPublisher } from '../ports/WorkflowEventPublisher.js';
import { LtreeNodePathPolicy } from '../../domain/policies/LtreeNodePathPolicy.js';

import type { CreateNodeCommand, MoveNodeCommand } from '../commands/NodeCommands.js';
import { ForbiddenError, ValidationError, CapabilityDisabledError } from '../../domain/errors/ApplicationErrors.js';
import { NodePathCollisionError, NodeCyclicMoveError, NodeNotFoundError } from '../../domain/errors/DomainErrors.js';
import { NodeType } from '../../domain/models/NodeType.js';
import { Node } from '../../domain/models/Node.js';

describe('NodeApplicationService', () => {
  let service: NodeApplicationService;
  let mockNodeRepository: NodeRepository;
  let mockNodeTypeRepository: NodeTypeRepository;
  let mockAccessControlPort: AccessControlPort;
  let mockLockService: LockService;
  let mockAuditPort: AuditPort;
  let mockRevisionPort: RevisionPort;
  let mockRuntimeConfigPort: RuntimeConfigurationPort;
  let mockIdGenerator: IdGeneratorPort;
  let mockTransactionPort: TransactionPort;
  let mockWorkflowEventPublisher: WorkflowEventPublisher;
  const pathPolicy = new LtreeNodePathPolicy();

  beforeEach(() => {
    mockNodeRepository = {
      findById: vi.fn(),
      findDeletedById: vi.fn(),
      listDeletedByScope: vi.fn(),
      listChildren: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      moveSubtree: vi.fn(),
      listSubtree: vi.fn().mockResolvedValue([]),
      existsByParentAndPathLabel: vi.fn().mockResolvedValue(false),
      listAncestorIds: vi.fn().mockResolvedValue([]),
      isDescendantOf: vi.fn().mockResolvedValue(false),
      softDeleteSubtree: vi.fn().mockResolvedValue([]),
      assertSubtreeUnlocked: vi.fn(),
      getDeletionBatchId: vi.fn().mockResolvedValue(null),
      restoreSubtree: vi.fn().mockResolvedValue([]),
    };

    mockNodeTypeRepository = {
      findByKey: vi.fn().mockResolvedValue(new NodeType('type-123', 'folder', 'Folder', 'Folder node type')),
      findById: vi.fn(),
      listAll: vi.fn().mockResolvedValue([]),
    };

    mockAccessControlPort = {
      assertCanCreateNode: vi.fn(),
      assertCanMoveNode: vi.fn(),
      assertCanReadNode: vi.fn(),
      assertCanCreateEntity: vi.fn(),
      assertCanEditEntity: vi.fn(),
      assertCanDeleteEntity: vi.fn(),
      assertCanMoveEntity: vi.fn(),
      assertHasPermission: vi.fn(),
      assertHasPermissionCoverage: vi.fn(),
      assertHasPermissionCoverageBatch: vi.fn(),
      assertIsSuperAdmin: vi.fn(),
    };

    mockLockService = {
      requireLockIfNeeded: vi.fn(),
      requireOwnedLock: vi.fn(),
      lock: vi.fn(),
      refresh: vi.fn(),
      unlock: vi.fn(),
      forceUnlock: vi.fn(),
      isLocked: vi.fn().mockResolvedValue({ locked: false }),
    } as unknown as LockService;

    mockAuditPort = {
      record: vi.fn(),
    };

    mockRevisionPort = {
      recordNodeRevision: vi.fn(),
      recordEntityRevision: vi.fn(),
    };

    mockRuntimeConfigPort = {
      isCapabilityEnabled: vi.fn().mockResolvedValue(true),
      getSetting: vi.fn(),
    };

    mockIdGenerator = {
      generate: vi.fn().mockReturnValue('generated-uuid-789'),
    };

    mockTransactionPort = {
      runInTransaction: vi.fn().mockImplementation(async (work) => await work()),
    };
    mockWorkflowEventPublisher = { publish: vi.fn() };

    service = new NodeApplicationService(
      mockNodeRepository,
      mockNodeTypeRepository,
      mockAccessControlPort,
      mockLockService,
      mockAuditPort,
      mockRevisionPort,
      mockRuntimeConfigPort,
      mockIdGenerator,
      pathPolicy,
      mockTransactionPort,
      undefined,
      undefined,
      mockWorkflowEventPublisher,
    );
  });

  describe('createNode', () => {
    it('should successfully create a node and log audit/revision inside a transaction', async () => {
      const cmd: CreateNodeCommand = {
        actorUserId: '00000000-0000-0000-0000-000000000000',
        actorSessionId: '00000000-0000-7000-8000-000000000001',
        parentNodeId: null,
        nodeTypeKey: 'folder',
        name: 'My New Node',
        description: 'A test node description',
      };

      const node = await service.createNode(cmd);

      expect(node).toBeInstanceOf(Node);
      expect(node.id).toBe('generated-uuid-789');
      expect(node.name).toBe('My New Node');
      expect(node.path).toBe('My_New_Node');
      expect(node.pathLabel).toBe('My_New_Node');
      expect(node.depth).toBe(0);

      expect(mockTransactionPort.runInTransaction).toHaveBeenCalled();
      expect(mockNodeRepository.create).toHaveBeenCalledWith(node);
      expect(mockRevisionPort.recordNodeRevision).toHaveBeenCalledWith(node, 'created', cmd.actorUserId);
      expect(mockAuditPort.record).toHaveBeenCalled();
      expect(mockWorkflowEventPublisher.publish).toHaveBeenCalledWith(expect.objectContaining({
        eventType: 'record.created',
        subject: { kind: 'node', id: node.id, typeKey: 'folder', scopeId: null },
        idempotencyKey: `record.created:node:${node.id}:1`,
      }));
    });

    it('should fail validation if name is empty', async () => {
      const cmd: CreateNodeCommand = {
        actorUserId: '00000000-0000-0000-0000-000000000000',
        actorSessionId: '00000000-0000-7000-8000-000000000001',
        parentNodeId: null,
        nodeTypeKey: 'folder',
        name: '',
      };

      await expect(service.createNode(cmd)).rejects.toThrow(ValidationError);
    });

    it('creates a child without locking or versioning its parent', async () => {
      const parent = new Node(
        '00000000-0000-0000-0000-000000000001',
        null,
        'parent',
        'parent',
        0,
        'type-123',
        'Parent',
        '',
        1,
        new Date(),
        new Date(),
        null,
        null,
        null
      );
      vi.mocked(mockNodeRepository.findById).mockResolvedValue(parent);

      await service.createNode({
        actorUserId: '00000000-0000-0000-0000-000000000000',
        actorSessionId: '00000000-0000-7000-8000-000000000001',
        parentNodeId: parent.id,
        nodeTypeKey: 'folder',
        name: 'Child',
      });

      expect(mockLockService.requireOwnedLock).not.toHaveBeenCalled();
      expect(mockRuntimeConfigPort.isCapabilityEnabled).not.toHaveBeenCalledWith('locking');
    });

    it('should fail if runtime capability is disabled', async () => {
      mockRuntimeConfigPort.isCapabilityEnabled = vi.fn().mockImplementation(async (key) => {
        if (key === 'hierarchical_structure') return false;
        return true;
      });

      const cmd: CreateNodeCommand = {
        actorUserId: '00000000-0000-0000-0000-000000000000',
        actorSessionId: '00000000-0000-7000-8000-000000000001',
        parentNodeId: null,
        nodeTypeKey: 'folder',
        name: 'Folder Name',
      };

      await expect(service.createNode(cmd)).rejects.toThrow(CapabilityDisabledError);
    });

    it('should fail if sibling pathLabel collision exists', async () => {
      mockNodeRepository.existsByParentAndPathLabel = vi.fn().mockResolvedValue(true);

      const cmd: CreateNodeCommand = {
        actorUserId: '00000000-0000-0000-0000-000000000000',
        actorSessionId: '00000000-0000-7000-8000-000000000001',
        parentNodeId: null,
        nodeTypeKey: 'folder',
        name: 'Duplicate Node',
      };

      await expect(service.createNode(cmd)).rejects.toThrow(NodePathCollisionError);
    });
  });

  describe('listChildren', () => {
    it('lists only readable root children for a scoped user', async () => {
      const visible = new Node('node-visible', null, 'visible', 'visible', 0, 'type-123', 'Visible', '', 1, new Date(), new Date(), null, 'user-1', 'user-1');
      const hidden = new Node('node-hidden', null, 'hidden', 'hidden', 0, 'type-123', 'Hidden', '', 1, new Date(), new Date(), null, 'user-1', 'user-1');
      mockNodeRepository.listChildren = vi.fn().mockResolvedValue([visible, hidden]);
      mockAccessControlPort.assertCanReadNode = vi.fn().mockImplementation(async (_userId: string, nodeId: string | null) => {
        if (nodeId === hidden.id) throw new ForbiddenError();
      });

      await expect(service.listChildren(null, 'user-1')).resolves.toEqual([visible]);
      expect(mockAccessControlPort.assertCanReadNode).toHaveBeenCalledWith('user-1', visible.id);
      expect(mockAccessControlPort.assertCanReadNode).toHaveBeenCalledWith('user-1', hidden.id);
    });
  });

  describe('listBreadcrumb', () => {
    const root = new Node('root', null, 'root', 'root', 0, 'type-123', 'Root', '', 1, new Date(), new Date(), null, 'user-1', 'user-1');
    const branch = new Node('branch', root.id, 'root.branch', 'branch', 1, 'type-123', 'Branch', '', 1, new Date(), new Date(), null, 'user-1', 'user-1');
    const leaf = new Node('leaf', branch.id, 'root.branch.leaf', 'leaf', 2, 'type-123', 'Leaf', '', 1, new Date(), new Date(), null, 'user-1', 'user-1');

    beforeEach(() => {
      mockNodeRepository.listAncestorIds = vi.fn().mockResolvedValue([leaf.id, branch.id, root.id]);
      mockNodeRepository.findById = vi.fn().mockImplementation(async (id: string) =>
        [root, branch, leaf].find((node) => node.id === id) ?? null);
    });

    it('returns the readable contiguous chain from root to current node', async () => {
      await expect(service.listBreadcrumb(leaf.id, 'user-1')).resolves.toEqual([root, branch, leaf]);
      expect(mockAccessControlPort.assertCanReadNode).toHaveBeenCalledWith('user-1', leaf.id);
      expect(mockAccessControlPort.assertCanReadNode).toHaveBeenCalledWith('user-1', root.id);
    });

    it('stops before an unreadable ancestor without probing higher levels', async () => {
      mockAccessControlPort.assertCanReadNode = vi.fn().mockImplementation(async (_userId: string, nodeId: string | null) => {
        if (nodeId === branch.id) throw new ForbiddenError();
      });

      await expect(service.listBreadcrumb(leaf.id, 'user-1')).resolves.toEqual([leaf]);
      expect(mockAccessControlPort.assertCanReadNode).not.toHaveBeenCalledWith('user-1', root.id);
      expect(mockNodeRepository.findById).not.toHaveBeenCalledWith(branch.id);
    });

    it('propagates infrastructure failures while checking an ancestor', async () => {
      mockAccessControlPort.assertCanReadNode = vi.fn().mockImplementation(async (_userId: string, nodeId: string | null) => {
        if (nodeId === branch.id) throw new Error('database unavailable');
      });

      await expect(service.listBreadcrumb(leaf.id, 'user-1')).rejects.toThrow('database unavailable');
    });
  });

  describe('moveNode', () => {
    const rootNode = new Node(
      '00000000-0000-0000-0000-000000000001',
      null,
      'root',
      'root',
      0,
      'type-123',
      'Root',
      '',
      1,
      new Date(),
      new Date(),
      null,
      'user-1',
      'user-1'
    );

    const childNode = new Node(
      '00000000-0000-0000-0000-000000000002',
      rootNode.id,
      'root.child',
      'child',
      1,
      'type-123',
      'Child',
      '',
      1,
      new Date(),
      new Date(),
      null,
      'user-1',
      'user-1'
    );

    const grandchildNode = new Node(
      '00000000-0000-0000-0000-000000000003',
      childNode.id,
      'root.child.grandchild',
      'grandchild',
      2,
      'type-123',
      'Grandchild',
      '',
      1,
      new Date(),
      new Date(),
      null,
      'user-1',
      'user-1'
    );

    const siblingNode = new Node(
      '00000000-0000-0000-0000-000000000004',
      rootNode.id,
      'root.sibling',
      'sibling',
      1,
      'type-123',
      'Sibling',
      '',
      1,
      new Date(),
      new Date(),
      null,
      'user-1',
      'user-1'
    );

    it('should successfully move a node to a valid new parent', async () => {
      // Sposta childNode sotto siblingNode (entrambi sono fratelli sotto root, nessun ciclo)
      mockNodeRepository.findById = vi.fn()
        .mockResolvedValueOnce(childNode)      // carica il nodo da spostare
        .mockResolvedValueOnce(siblingNode)     // carica il nuovo parent
        .mockResolvedValueOnce(                 // ricarica dopo la move per la revisione
          new Node(childNode.id, siblingNode.id, 'root.sibling.child', 'child', 2, 'type-123', 'Child', '', 2, new Date(), new Date(), null, 'user-1', 'user-1')
        );

      mockNodeRepository.isDescendantOf = vi.fn().mockResolvedValue(false);
      mockNodeRepository.listSubtree = vi.fn().mockResolvedValue([
        new Node(childNode.id, siblingNode.id, 'root.sibling.child', 'child', 2, 'type-123', 'Child', '', 2, new Date(), new Date(), null, 'user-1', 'user-1'),
      ]);

      const cmd: MoveNodeCommand = {
        actorUserId: '00000000-0000-0000-0000-000000000000',
        actorSessionId: '00000000-0000-7000-8000-000000000001',
        nodeId: childNode.id,
        newParentNodeId: siblingNode.id,
      };

      await service.moveNode(cmd);

      expect(mockNodeRepository.moveSubtree).toHaveBeenCalledWith(
        childNode.id,
        siblingNode.id,
        cmd.actorUserId
      );
      expect(mockAuditPort.record).toHaveBeenCalledTimes(1);
      expect(mockRevisionPort.recordNodeRevision).toHaveBeenCalled();
      expect(mockWorkflowEventPublisher.publish).toHaveBeenCalledTimes(1);
    });

    it('should throw NodeCyclicMoveError when moving a node under itself', async () => {
      mockNodeRepository.findById = vi.fn().mockResolvedValue(childNode);

      const cmd: MoveNodeCommand = {
        actorUserId: '00000000-0000-0000-0000-000000000000',
        actorSessionId: '00000000-0000-7000-8000-000000000001',
        nodeId: childNode.id,
        newParentNodeId: childNode.id, // stesso nodo!
      };

      await expect(service.moveNode(cmd)).rejects.toThrow(NodeCyclicMoveError);
      expect(mockNodeRepository.moveSubtree).not.toHaveBeenCalled();
    });

    it('should throw NodeCyclicMoveError when moving a node under its own descendant', async () => {
      // Scenario: root -> child -> grandchild. Proviamo a spostare child sotto grandchild.
      mockNodeRepository.findById = vi.fn()
        .mockResolvedValueOnce(childNode); // carica il nodo da spostare

      // grandchild IS a descendant of child
      mockNodeRepository.isDescendantOf = vi.fn().mockResolvedValue(true);

      const cmd: MoveNodeCommand = {
        actorUserId: '00000000-0000-0000-0000-000000000000',
        actorSessionId: '00000000-0000-7000-8000-000000000001',
        nodeId: childNode.id,
        newParentNodeId: grandchildNode.id,
      };

      await expect(service.moveNode(cmd)).rejects.toThrow(NodeCyclicMoveError);
      expect(mockNodeRepository.isDescendantOf).toHaveBeenCalledWith(
        grandchildNode.id,  // il nuovo parent proposto
        childNode.id        // il nodo che stiamo spostando (potenziale antenato)
      );
      expect(mockNodeRepository.moveSubtree).not.toHaveBeenCalled();
    });

    it('should throw NodeNotFoundError when the node to move does not exist', async () => {
      mockNodeRepository.findById = vi.fn().mockResolvedValue(null);

      const cmd: MoveNodeCommand = {
        actorUserId: '00000000-0000-0000-0000-000000000000',
        actorSessionId: '00000000-0000-7000-8000-000000000001',
        nodeId: '00000000-0000-0000-0000-000000000099',
        newParentNodeId: rootNode.id,
      };

      await expect(service.moveNode(cmd)).rejects.toThrow(NodeNotFoundError);
    });

    it('should throw NodePathCollisionError when pathLabel collides in new parent', async () => {
      mockNodeRepository.findById = vi.fn()
        .mockResolvedValueOnce(childNode)   // carica il nodo da spostare
        .mockResolvedValueOnce(siblingNode); // carica il nuovo parent

      mockNodeRepository.existsByParentAndPathLabel = vi.fn().mockResolvedValue(true);

      const cmd: MoveNodeCommand = {
        actorUserId: '00000000-0000-0000-0000-000000000000',
        actorSessionId: '00000000-0000-7000-8000-000000000001',
        nodeId: childNode.id,
        newParentNodeId: siblingNode.id,
      };

      await expect(service.moveNode(cmd)).rejects.toThrow(NodePathCollisionError);
      expect(mockNodeRepository.moveSubtree).not.toHaveBeenCalled();
    });

    it('soft-deletes a node subtree using one deletion batch', async () => {
      const node = new Node('00000000-0000-0000-0000-000000000010', null, 'root', 'root', 0, 'type-123', 'Root', '', 3, new Date(), new Date(), null, 'user-1', 'user-1', {});
      mockNodeRepository.findById = vi.fn().mockResolvedValue(node);
      mockNodeRepository.softDeleteSubtree = vi.fn().mockResolvedValue([node.id, '00000000-0000-0000-0000-000000000011']);

      await service.deleteNode({ actorUserId: '00000000-0000-0000-0000-000000000001', actorSessionId: '00000000-0000-7000-8000-000000000001', nodeId: node.id, expectedRowVersion: 3 });

      expect(mockAccessControlPort.assertHasPermission).toHaveBeenCalledWith('00000000-0000-0000-0000-000000000001', 'node.delete', node.id);
      expect(mockNodeRepository.softDeleteSubtree).toHaveBeenCalledWith(node.id, '00000000-0000-0000-0000-000000000001', 3, expect.any(String));
      expect(mockAuditPort.record).toHaveBeenCalledTimes(1);
      expect(mockAuditPort.record).toHaveBeenCalledWith(
        '00000000-0000-0000-0000-000000000001',
        'node.delete',
        'node',
        node.id,
        node.id,
        null,
        { deletionBatchId: 'generated-uuid-789', affectedNodeCount: 2 },
      );
      expect(mockWorkflowEventPublisher.publish).toHaveBeenCalledTimes(1);
      expect(mockWorkflowEventPublisher.publish).toHaveBeenCalledWith(expect.objectContaining({
        eventType: 'record.deleted',
        subject: { kind: 'node', id: node.id, scopeId: null },
        idempotencyKey: `record.deleted:node:${node.id}:generated-uuid-789`,
        payload: { deletionBatchId: 'generated-uuid-789', rootNodeId: node.id, affectedNodeCount: 2 },
      }));
    });

    it('restores only the recorded deletion batch', async () => {
      const deleted = new Node('00000000-0000-0000-0000-000000000010', null, 'root', 'root', 0, 'type-123', 'Root', '', 4, new Date(), new Date(), new Date(), 'user-1', 'user-1', {});
      mockNodeRepository.findDeletedById = vi.fn().mockResolvedValue(deleted);
      mockNodeRepository.getDeletionBatchId = vi.fn().mockResolvedValue('00000000-0000-0000-0000-000000000099');
      mockNodeRepository.restoreSubtree = vi.fn().mockResolvedValue([deleted.id, '00000000-0000-0000-0000-000000000011']);

      await service.restoreNode({ actorUserId: '00000000-0000-0000-0000-000000000001', actorSessionId: '00000000-0000-7000-8000-000000000001', nodeId: deleted.id, expectedRowVersion: 4 });

      expect(mockAccessControlPort.assertHasPermission).toHaveBeenCalledWith('00000000-0000-0000-0000-000000000001', 'node.restore', deleted.id);
      expect(mockNodeRepository.restoreSubtree).toHaveBeenCalledWith(deleted.id, '00000000-0000-0000-0000-000000000001', 4, '00000000-0000-0000-0000-000000000099');
      expect(mockAuditPort.record).toHaveBeenCalledWith(
        '00000000-0000-0000-0000-000000000001',
        'node.restore',
        'node',
        deleted.id,
        deleted.id,
        { deletionBatchId: '00000000-0000-0000-0000-000000000099' },
        { deletionBatchId: '00000000-0000-0000-0000-000000000099', restoredNodeCount: 2 },
      );
      expect(mockWorkflowEventPublisher.publish).toHaveBeenCalledTimes(1);
      expect(mockWorkflowEventPublisher.publish).toHaveBeenCalledWith(expect.objectContaining({
        eventType: 'record.restored',
        subject: { kind: 'node', id: deleted.id, scopeId: null },
        idempotencyKey: `record.restored:node:${deleted.id}:00000000-0000-0000-0000-000000000099`,
        payload: { deletionBatchId: '00000000-0000-0000-0000-000000000099', rootNodeId: deleted.id, restoredNodeCount: 2 },
      }));
    });

    it('loads a deleted node only through the restore permission boundary', async () => {
      const deleted = new Node('00000000-0000-0000-0000-000000000010', null, 'root', 'root', 0, 'type-123', 'Root', '', 4, new Date(), new Date(), new Date(), 'user-1', 'user-1', {});
      mockNodeRepository.findDeletedById = vi.fn().mockResolvedValue(deleted);

      await expect(service.getDeletedNodeById(deleted.id, 'actor-1')).resolves.toBe(deleted);

      expect(mockAccessControlPort.assertHasPermission).toHaveBeenCalledWith('actor-1', 'node.restore', deleted.id);
    });
  });
});
