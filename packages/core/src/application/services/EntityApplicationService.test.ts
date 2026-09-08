/** Verifies entity use-case invariants independently from persistence adapters. */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import { EntityApplicationService } from './EntityApplicationService.js';
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
import type { WorkflowEventPublisher } from '../ports/WorkflowEventPublisher.js';

import type { CreateEntityCommand, UpdateEntityCommand, DeleteEntityCommand } from '../commands/EntityCommands.js';
import {
  EntityTypeNotFoundError,
  EntitySchemaValidationError,
  EntityCommandValidationError,
} from '../../domain/errors/EntityErrors.js';
import { EntityType } from '../../domain/models/EntityType.js';
import { Entity } from '../../domain/models/Entity.js';
import { Node } from '../../domain/models/Node.js';

describe('EntityApplicationService', () => {
  let service: EntityApplicationService;
  let mockEntityRepository: EntityRepository;
  let mockEntityTypeRepository: EntityTypeRepository;
  let mockNodeRepository: NodeRepository;
  let mockSchemaRegistry: EntitySchemaRegistry;
  let mockAccessControlPort: AccessControlPort;
  let mockLockService: LockService;
  let mockAuditPort: AuditPort;
  let mockRevisionPort: RevisionPort;
  let mockRuntimeConfigPort: RuntimeConfigurationPort;
  let mockIdGenerator: IdGeneratorPort;
  let mockTransactionPort: TransactionPort;
  let mockWorkflowEventPublisher: WorkflowEventPublisher;

  // Lo schema dinamico dei campi custom del device (esclude name/description in quanto attributi canonici)
  const mockDeviceSchema = z.object({
    serialNumber: z.string().min(3),
    voltage: z.number().positive(),
  });

  beforeEach(() => {
    mockEntityRepository = {
      findById: vi.fn(),
      findDeletedById: vi.fn(),
      listDeletedByScope: vi.fn(),
      listByNode: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      softDelete: vi.fn(),
      restore: vi.fn(),
      listActiveIdsByNodeIds: vi.fn().mockResolvedValue([]),
      listActiveIds: vi.fn().mockResolvedValue([]),
      listDeletedIdsByBatch: vi.fn().mockResolvedValue([]),
      getDeletionBatchId: vi.fn().mockResolvedValue('00000000-0000-0000-0000-000000000003'),
    };

    mockEntityTypeRepository = {
      findByKey: vi.fn().mockResolvedValue(new EntityType('type-id-1', 'device', 'Device Type', 'Device metadata', 'entity_device', 1, true)),
      findById: vi.fn().mockResolvedValue(new EntityType('type-id-1', 'device', 'Device Type', 'Device metadata', 'entity_device', 1, true)),
      listAll: vi.fn().mockResolvedValue([]),
    };

    mockNodeRepository = {
      findById: vi.fn().mockResolvedValue(new Node('parent-uuid', null, 'root', 'root', 0, 'folder-type', 'Root Node', '', 1, new Date(), new Date(), null, null, null)),
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
      listActiveIds: vi.fn().mockResolvedValue([]),
    };

    mockSchemaRegistry = {
      getSchema: vi.fn().mockImplementation(async (typeKey) => {
        if (typeKey === 'device') {
          return mockDeviceSchema;
        }
        return null;
      }),
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
      generate: vi.fn().mockReturnValue('00000000-0000-0000-0000-000000000003'),
    };

    mockTransactionPort = {
      runInTransaction: vi.fn().mockImplementation(async (work) => await work()),
      runInAuthorizationMutation: vi.fn().mockImplementation(async (work) => await work()),
    };
    mockWorkflowEventPublisher = { publish: vi.fn() };

    service = new EntityApplicationService(
      mockEntityRepository,
      mockEntityTypeRepository,
      mockNodeRepository,
      mockSchemaRegistry,
      mockAccessControlPort,
      mockLockService,
      mockAuditPort,
      mockRevisionPort,
      mockRuntimeConfigPort,
      mockIdGenerator,
      mockTransactionPort,
      undefined,
      mockWorkflowEventPublisher,
    );
  });

  describe('createEntity', () => {
    it('should successfully create an entity with valid dynamic payload and record audit', async () => {
      const cmd: CreateEntityCommand = {
        actorUserId: '00000000-0000-0000-0000-000000000000',
        actorSessionId: '00000000-0000-7000-8000-000000000001',
        parentNodeId: '00000000-0000-0000-0000-000000000001',
        entityTypeKey: 'device',
        name: 'Oscilloscope',
        description: 'High frequency oscilloscope',
        payload: {
          serialNumber: 'OSC-12345',
          voltage: 220,
        },
      };

      const entity = await service.createEntity(cmd);

      expect(entity).toBeInstanceOf(Entity);
      expect(entity.id).toBe('00000000-0000-0000-0000-000000000003');
      expect(entity.name).toBe('Oscilloscope');
      expect(entity.description).toBe('High frequency oscilloscope');
      expect(entity.payload).toEqual(cmd.payload);

      expect(mockTransactionPort.runInTransaction).toHaveBeenCalled();
      expect(mockEntityRepository.create).toHaveBeenCalledWith(entity);
      expect(mockRevisionPort.recordEntityRevision).toHaveBeenCalledWith(entity, 'created', cmd.actorUserId);
      expect(mockAuditPort.record).toHaveBeenCalled();
      expect(mockLockService.requireOwnedLock).not.toHaveBeenCalled();
      expect(mockWorkflowEventPublisher.publish).toHaveBeenCalledWith(expect.objectContaining({
        eventType: 'record.created',
        subject: { kind: 'entity', id: entity.id, typeKey: 'device', scopeId: entity.parentNodeId },
        idempotencyKey: `record.created:entity:${entity.id}:1`,
      }));
    });

    it('should fail structural command validation if actorUserId is not a uuid', async () => {
      const cmd: CreateEntityCommand = {
        actorUserId: 'invalid-uuid',
        actorSessionId: '00000000-0000-7000-8000-000000000001',
        parentNodeId: '00000000-0000-0000-0000-000000000001',
        entityTypeKey: 'device',
        name: 'Oscilloscope',
        payload: {
          serialNumber: 'OSC-12345',
          voltage: 220,
        },
      };

      await expect(service.createEntity(cmd)).rejects.toThrow(EntityCommandValidationError);
    });

    it('should fail if dynamic schema validation fails (missing required field)', async () => {
      const cmd: CreateEntityCommand = {
        actorUserId: '00000000-0000-0000-0000-000000000000',
        actorSessionId: '00000000-0000-7000-8000-000000000001',
        parentNodeId: '00000000-0000-0000-0000-000000000001',
        entityTypeKey: 'device',
        name: 'Oscilloscope',
        payload: {
          // serialNumber is missing
          voltage: 220,
        },
      };

      await expect(service.createEntity(cmd)).rejects.toThrow(EntitySchemaValidationError);
    });

    it('should fail if entity type key is not registered', async () => {
      mockEntityTypeRepository.findByKey = vi.fn().mockResolvedValue(null);

      const cmd: CreateEntityCommand = {
        actorUserId: '00000000-0000-0000-0000-000000000000',
        actorSessionId: '00000000-0000-7000-8000-000000000001',
        parentNodeId: '00000000-0000-0000-0000-000000000001',
        entityTypeKey: 'unknown-key',
        name: 'Oscilloscope',
        payload: {},
      };

      await expect(service.createEntity(cmd)).rejects.toThrow(EntityTypeNotFoundError);
    });

    it('creates under a parent without requiring its lock or rowVersion', async () => {
      vi.mocked(mockLockService.requireOwnedLock).mockRejectedValue(new Error('The parent is locked by another session.'));
      const cmd: CreateEntityCommand = {
        actorUserId: '00000000-0000-0000-0000-000000000000',
        actorSessionId: '00000000-0000-7000-8000-000000000001',
        parentNodeId: '00000000-0000-0000-0000-000000000001',
        entityTypeKey: 'device',
        name: 'Oscilloscope',
        payload: {
          serialNumber: 'OSC-123',
          voltage: 220,
        },
      };

      await expect(service.createEntity(cmd)).resolves.toBeInstanceOf(Entity);
      expect(mockLockService.requireOwnedLock).not.toHaveBeenCalled();
    });
  });

  describe('updateEntity', () => {
    it('should successfully update entity with partial payload delta and canonical fields', async () => {
      const existingEntity = new Entity(
        '00000000-0000-0000-0000-000000000002',
        'type-id-1',
        'parent-uuid',
        'Old Name',
        'Old Desc',
        1,
        new Date(),
        new Date(),
        null,
        'user-1',
        'user-1',
        { serialNumber: 'OSC-000', voltage: 110 }
      );

      mockEntityRepository.findById = vi.fn().mockResolvedValue(existingEntity);

      const cmd: UpdateEntityCommand = {
        actorUserId: '00000000-0000-0000-0000-000000000000',
        actorSessionId: '00000000-0000-7000-8000-000000000001',
        entityId: '00000000-0000-0000-0000-000000000002',
        name: 'New Name',
        payloadDelta: {
          voltage: 220,
        },
        expectedRowVersion: 1,
      };

      const updated = await service.updateEntity(cmd);

      expect(updated.rowVersion).toBe(2);
      expect(updated.name).toBe('New Name');
      expect(updated.description).toBe('Old Desc'); // Left unchanged
      expect(updated.payload).toEqual({
        serialNumber: 'OSC-000',
        voltage: 220,
      });
      expect(mockEntityRepository.update).toHaveBeenCalledWith(updated);
      expect(mockRevisionPort.recordEntityRevision).toHaveBeenCalledWith(updated, 'updated', cmd.actorUserId);
      expect(mockAuditPort.record).toHaveBeenCalledWith(
        cmd.actorUserId,
        'entity.update',
        'entity',
        existingEntity.id,
        existingEntity.parentNodeId,
        expect.objectContaining({
          name: existingEntity.name,
          payload: existingEntity.payload,
        }),
        expect.objectContaining({
          name: updated.name,
          payload: updated.payload,
        }),
      );
      expect(mockLockService.requireOwnedLock).toHaveBeenCalledWith(
        { resourceType: 'entity', resourceId: existingEntity.id },
        cmd.actorUserId,
        cmd.actorSessionId
      );
    });
  });

  describe('deleteEntity', () => {
    it('should perform soft delete and log event', async () => {
      const existingEntity = new Entity(
        '00000000-0000-0000-0000-000000000002',
        'type-id-1',
        'parent-uuid',
        'To Delete',
        '',
        1,
        new Date(),
        new Date(),
        null,
        'user-1',
        'user-1',
        {}
      );

      mockEntityRepository.findById = vi.fn().mockResolvedValue(existingEntity);

      const cmd: DeleteEntityCommand = {
        actorUserId: '00000000-0000-0000-0000-000000000000',
        actorSessionId: '00000000-0000-7000-8000-000000000001',
        entityId: '00000000-0000-0000-0000-000000000002',
        expectedRowVersion: 1,
      };

      await service.deleteEntity(cmd);

      expect(mockAccessControlPort.assertCanDeleteEntity).toHaveBeenCalledWith(cmd.actorUserId, existingEntity.id);
      expect(mockEntityRepository.softDelete).toHaveBeenCalledWith('00000000-0000-0000-0000-000000000002', cmd.actorUserId, cmd.expectedRowVersion, expect.any(String));
      expect(mockRevisionPort.recordEntityRevision).toHaveBeenCalled();
      expect(mockAuditPort.record).toHaveBeenCalled();
      expect(mockLockService.requireOwnedLock).toHaveBeenCalledWith(
        { resourceType: 'entity', resourceId: existingEntity.id },
        cmd.actorUserId,
        cmd.actorSessionId
      );
    });
  });

  describe('authorized reads', () => {
    it('lists deleted entities through the repository scope boundary', async () => {
      const deleted = [{ id: 'deleted-1', entityTypeName: 'Device', parentNodeName: 'Operations' }];
      mockEntityRepository.listDeletedByScope = vi.fn().mockResolvedValue(deleted);

      await expect(service.listDeletedEntities('actor-1', 50, 10)).resolves.toEqual(deleted);
      expect(mockEntityRepository.listDeletedByScope).toHaveBeenCalledWith('actor-1', 50, 10);
    });

    it('restores a scoped entity only when its type is active and audits the transition', async () => {
      const entity = new Entity(
        '00000000-0000-0000-0000-000000000002', 'type-id-1', 'parent-uuid', 'Deleted', '', 4,
        new Date(), new Date(), new Date(), 'user-1', 'user-1', { serialNumber: 'OSC-000', voltage: 220 },
      );
      mockEntityRepository.findDeletedById = vi.fn().mockResolvedValue(entity);

      await service.restoreEntity({
        actorUserId: '00000000-0000-0000-0000-000000000000',
        actorSessionId: '00000000-0000-7000-8000-000000000001',
        entityId: entity.id,
        expectedRowVersion: 4,
      });

      expect(mockAccessControlPort.assertHasPermission).toHaveBeenCalledWith(
        '00000000-0000-0000-0000-000000000000', 'entity.restore', 'parent-uuid',
      );
      expect(mockEntityRepository.restore).toHaveBeenCalledWith(entity.id, '00000000-0000-0000-0000-000000000000', 4);
      expect(mockRevisionPort.recordEntityRevision).toHaveBeenCalledWith(expect.objectContaining({ deletedAt: null }), 'restored', expect.any(String));
      expect(mockAuditPort.record).toHaveBeenCalledWith(expect.any(String), 'entity.restore', 'entity', entity.id, 'parent-uuid', expect.any(Object), { deletedAt: null });
    });

    it('checks node read permission before returning an entity', async () => {
      const entity = new Entity(
        '00000000-0000-0000-0000-000000000002',
        'type-id-1',
        'parent-uuid',
        'Visible Entity',
        '',
        1,
        new Date(),
        new Date(),
        null,
        'user-1',
        'user-1',
        {}
      );
      mockEntityRepository.findById = vi.fn().mockResolvedValue(entity);

      await expect(service.getEntityById(entity.id, 'actor-1')).resolves.toBe(entity);
      expect(mockAccessControlPort.assertCanReadNode).toHaveBeenCalledWith('actor-1', 'parent-uuid');
    });

    it('checks node read permission before listing direct entities', async () => {
      mockEntityRepository.listByNode = vi.fn().mockResolvedValue([]);

      await expect(service.listEntitiesByNode('parent-uuid', 'actor-1')).resolves.toEqual([]);
      expect(mockAccessControlPort.assertCanReadNode).toHaveBeenCalledWith('actor-1', 'parent-uuid');
      expect(mockEntityRepository.listByNode).toHaveBeenCalledWith('parent-uuid', undefined, undefined);
    });
  });
});
