import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NodeApplicationService } from './NodeApplicationService.js';
import { NodeRepository } from '../ports/NodeRepository.js';
import { NodeTypeRepository } from '../ports/NodeTypeRepository.js';
import { AccessControlPort } from '../ports/AccessControlPort.js';
import { LockService } from './LockService.js';
import { AuditPort } from '../ports/AuditPort.js';
import { RevisionPort } from '../ports/RevisionPort.js';
import { RuntimeConfigurationPort } from '../ports/RuntimeConfigurationPort.js';
import { IdGeneratorPort } from '../ports/IdGeneratorPort.js';
import { TransactionPort } from '../ports/TransactionPort.js';
import { LtreeNodePathPolicy } from '../../domain/policies/LtreeNodePathPolicy.js';

import { CreateNodeCommand, MoveNodeCommand } from '../commands/NodeCommands.js';
import { ValidationError, CapabilityDisabledError } from '../../domain/errors/ApplicationErrors.js';
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
  const pathPolicy = new LtreeNodePathPolicy();

  beforeEach(() => {
    mockNodeRepository = {
      findById: vi.fn(),
      listChildren: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      moveSubtree: vi.fn(),
      existsByParentAndPathLabel: vi.fn().mockResolvedValue(false),
      listAncestorIds: vi.fn().mockResolvedValue([]),
      isDescendantOf: vi.fn().mockResolvedValue(false),
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
      assertCanMoveEntity: vi.fn(),
      assertHasPermission: vi.fn(),
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
      mockTransactionPort
    );
  });

  describe('createNode', () => {
    it('should successfully create a node and log audit/revision inside a transaction', async () => {
      const cmd: CreateNodeCommand = {
        actorUserId: '00000000-0000-0000-0000-000000000000',
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
    });

    it('should fail validation if name is empty', async () => {
      const cmd: CreateNodeCommand = {
        actorUserId: '00000000-0000-0000-0000-000000000000',
        parentNodeId: null,
        nodeTypeKey: 'folder',
        name: '',
      };

      await expect(service.createNode(cmd)).rejects.toThrow(ValidationError);
    });

    it('requires the parent node lock when creating a child', async () => {
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
        parentNodeId: parent.id,
        nodeTypeKey: 'folder',
        name: 'Child',
      });

      expect(mockLockService.requireOwnedLock).toHaveBeenCalledWith(
        'node',
        parent.id,
        '00000000-0000-0000-0000-000000000000'
      );
    });

    it('should fail if runtime capability is disabled', async () => {
      mockRuntimeConfigPort.isCapabilityEnabled = vi.fn().mockImplementation(async (key) => {
        if (key === 'hierarchical_structure') return false;
        return true;
      });

      const cmd: CreateNodeCommand = {
        actorUserId: '00000000-0000-0000-0000-000000000000',
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
        parentNodeId: null,
        nodeTypeKey: 'folder',
        name: 'Duplicate Node',
      };

      await expect(service.createNode(cmd)).rejects.toThrow(NodePathCollisionError);
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

      const cmd: MoveNodeCommand = {
        actorUserId: '00000000-0000-0000-0000-000000000000',
        nodeId: childNode.id,
        newParentNodeId: siblingNode.id,
      };

      await service.moveNode(cmd);

      expect(mockNodeRepository.moveSubtree).toHaveBeenCalledWith(
        childNode.id,
        siblingNode.id,
        cmd.actorUserId
      );
      expect(mockAuditPort.record).toHaveBeenCalled();
      expect(mockRevisionPort.recordNodeRevision).toHaveBeenCalled();
    });

    it('should throw NodeCyclicMoveError when moving a node under itself', async () => {
      mockNodeRepository.findById = vi.fn().mockResolvedValue(childNode);

      const cmd: MoveNodeCommand = {
        actorUserId: '00000000-0000-0000-0000-000000000000',
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
        nodeId: childNode.id,
        newParentNodeId: siblingNode.id,
      };

      await expect(service.moveNode(cmd)).rejects.toThrow(NodePathCollisionError);
      expect(mockNodeRepository.moveSubtree).not.toHaveBeenCalled();
    });
  });
});
