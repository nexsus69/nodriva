import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TypeAdminApplicationService } from './TypeAdminApplicationService.js';
import type { TypeDefinitionAdminRepository } from '../ports/TypeDefinitionAdminRepository.js';
import type { SchemaInvalidationPort } from '../ports/SchemaInvalidationPort.js';
import type { AuditPort } from '../ports/AuditPort.js';
import type { TransactionPort } from '../ports/TransactionPort.js';
import type { IdGeneratorPort } from '../ports/IdGeneratorPort.js';
import type { StorageTableManagementPort } from '../ports/StorageTableManagementPort.js';
import type { AccessControlPort } from '../ports/AccessControlPort.js';
import { ManagedTypeDefinition } from '../../domain/models/ManagedTypeDefinition.js';
import { ManagedTypeField } from '../../domain/models/ManagedTypeField.js';
import { ManagedTypeFieldConstraint } from '../../domain/models/ManagedTypeFieldConstraint.js';
import type { CreateTypeCommand } from '../commands/TypeAdminCommands.js';
import { RowVersionMismatchError } from '../../domain/errors/DomainErrors.js';
import {
  TypeAdminValidationError,
  TypeKeyAlreadyExistsError,
  TypeFieldKeyAlreadyExistsError,
  TypeFieldColumnNameAlreadyExistsError,
  SystemTypeModificationError,
  SystemFieldModificationError,
  TypeHasInstancesError,
  TypeFieldNotFoundError,
  TypeFieldConstraintNotFoundError,
} from '../../domain/errors/TypeAdminErrors.js';

// ─── Helpers ─────────────────────────────────────────────────────

const ACTOR = '00000000-0000-0000-0000-000000000001';
const TYPE_ID = '00000000-0000-0000-0000-000000000010';
const FIELD_ID = '00000000-0000-0000-0000-000000000020';
const CONSTRAINT_ID = '00000000-0000-0000-0000-000000000030';
const GENERATED_ID = '00000000-0000-0000-0000-000000000099';

function makeType(overrides: Partial<ManagedTypeDefinition> = {}): ManagedTypeDefinition {
  const now = new Date('2024-01-01T00:00:00Z');
  return new ManagedTypeDefinition(
    overrides.id ?? TYPE_ID,
    overrides.typeKey ?? 'device',
    overrides.name ?? 'Device',
    overrides.description ?? 'A device type',
    overrides.storageTable ?? null,
    overrides.placementPolicyId ?? null,
    overrides.currentSchemaVersion ?? 1,
    overrides.isActive ?? true,
    overrides.isSystem ?? false,
    overrides.rowVersion ?? 1,
    overrides.createdAt ?? now,
    overrides.updatedAt ?? now,
    overrides.deletedAt ?? null
  );
}

function makeField(overrides: Partial<ManagedTypeField> = {}): ManagedTypeField {
  const now = new Date('2024-01-01T00:00:00Z');
  return new ManagedTypeField(
    overrides.id ?? FIELD_ID,
    overrides.typeDefinitionId ?? TYPE_ID,
    overrides.fieldKey ?? 'serial_number',
    overrides.label ?? 'Serial Number',
    overrides.columnName ?? 'serial_number',
    overrides.dataType ?? 'string',
    overrides.isRequired ?? true,
    overrides.isUnique ?? false,
    overrides.isIndexed ?? false,
    overrides.defaultValueText ?? null,
    overrides.position ?? 0,
    overrides.isSystem ?? false,
    overrides.createdAt ?? now,
    overrides.updatedAt ?? now
  );
}

// ─── Setup ───────────────────────────────────────────────────────

describe('TypeAdminApplicationService', () => {
  let service: TypeAdminApplicationService;
  let mockRepo: {
    findTypeById: ReturnType<typeof vi.fn>;
    findTypeByKey: ReturnType<typeof vi.fn>;
    createType: ReturnType<typeof vi.fn>;
    updateType: ReturnType<typeof vi.fn>;
    findFieldById: ReturnType<typeof vi.fn>;
    createField: ReturnType<typeof vi.fn>;
    updateField: ReturnType<typeof vi.fn>;
    deleteField: ReturnType<typeof vi.fn>;
    existsFieldByKey: ReturnType<typeof vi.fn>;
    existsFieldByColumnName: ReturnType<typeof vi.fn>;
    findConstraintById: ReturnType<typeof vi.fn>;
    createConstraint: ReturnType<typeof vi.fn>;
    updateConstraint: ReturnType<typeof vi.fn>;
    deleteConstraint: ReturnType<typeof vi.fn>;
    hasInstancesOfType: ReturnType<typeof vi.fn>;
    hasValuesInField: ReturnType<typeof vi.fn>;
    countIncomingRelations: ReturnType<typeof vi.fn>;
  };
  let mockInvalidation: { invalidate: ReturnType<typeof vi.fn> };
  let mockAudit: { record: ReturnType<typeof vi.fn> };
  let mockTransaction: { runInTransaction: ReturnType<typeof vi.fn> };
  let mockIdGen: { generate: ReturnType<typeof vi.fn> };
  let mockStorageTableManager: {
    createStorageTable: ReturnType<typeof vi.fn>;
    addColumn: ReturnType<typeof vi.fn>;
    updateColumnNullability: ReturnType<typeof vi.fn>;
    updateColumnDefault: ReturnType<typeof vi.fn>;
    dropColumn: ReturnType<typeof vi.fn>;
    createUniqueConstraint: ReturnType<typeof vi.fn>;
    dropUniqueConstraint: ReturnType<typeof vi.fn>;
    createIndex: ReturnType<typeof vi.fn>;
    dropIndex: ReturnType<typeof vi.fn>;
  };
  let mockAccessControlPort: {
    assertCanReadNode: ReturnType<typeof vi.fn>;
    assertCanCreateEntity: ReturnType<typeof vi.fn>;
    assertCanEditEntity: ReturnType<typeof vi.fn>;
    assertCanDeleteEntity: ReturnType<typeof vi.fn>;
    assertCanCreateNode: ReturnType<typeof vi.fn>;
    assertCanMoveNode: ReturnType<typeof vi.fn>;
    assertCanMoveEntity: ReturnType<typeof vi.fn>;
    assertHasPermission: ReturnType<typeof vi.fn>;
    assertHasPermissionCoverage: ReturnType<typeof vi.fn>;
    assertHasPermissionCoverageBatch: ReturnType<typeof vi.fn>;
    assertIsSuperAdmin: ReturnType<typeof vi.fn>;
  };

  // Per verificare che l'invalidazione avvenga dopo il commit
  let insideTransaction: boolean;
  let invalidateCalledInsideTransaction: boolean;

  beforeEach(() => {
    insideTransaction = false;
    invalidateCalledInsideTransaction = false;

    mockRepo = {
      findTypeById: vi.fn().mockResolvedValue(null),
      findTypeByKey: vi.fn().mockResolvedValue(null),
      createType: vi.fn().mockResolvedValue(undefined),
      updateType: vi.fn().mockResolvedValue(undefined),
      findFieldById: vi.fn().mockResolvedValue(null),
      createField: vi.fn().mockResolvedValue(undefined),
      updateField: vi.fn().mockResolvedValue(undefined),
      deleteField: vi.fn().mockResolvedValue(undefined),
      existsFieldByKey: vi.fn().mockResolvedValue(false),
      existsFieldByColumnName: vi.fn().mockResolvedValue(false),
      findConstraintById: vi.fn().mockResolvedValue(null),
      createConstraint: vi.fn().mockResolvedValue(undefined),
      updateConstraint: vi.fn().mockResolvedValue(undefined),
      deleteConstraint: vi.fn().mockResolvedValue(undefined),
      hasInstancesOfType: vi.fn().mockResolvedValue(false),
      hasValuesInField: vi.fn().mockResolvedValue(false),
      countIncomingRelations: vi.fn().mockResolvedValue(0),
    };

    mockInvalidation = {
      invalidate: vi.fn().mockImplementation(() => {
        if (insideTransaction) {
          invalidateCalledInsideTransaction = true;
        }
      }),
    };

    mockAudit = { record: vi.fn().mockResolvedValue(undefined) };

    mockTransaction = {
      runInTransaction: vi.fn().mockImplementation(async (work: () => Promise<unknown>) => {
        insideTransaction = true;
        try {
          return await work();
        } finally {
          insideTransaction = false;
        }
      }),
    };

    mockIdGen = { generate: vi.fn().mockReturnValue(GENERATED_ID) };

    mockStorageTableManager = {
      createStorageTable: vi.fn().mockResolvedValue(undefined),
      addColumn: vi.fn().mockResolvedValue(undefined),
      updateColumnNullability: vi.fn().mockResolvedValue(undefined),
      updateColumnDefault: vi.fn().mockResolvedValue(undefined),
      dropColumn: vi.fn().mockResolvedValue(undefined),
      createUniqueConstraint: vi.fn().mockResolvedValue(undefined),
      dropUniqueConstraint: vi.fn().mockResolvedValue(undefined),
      createIndex: vi.fn().mockResolvedValue(undefined),
      dropIndex: vi.fn().mockResolvedValue(undefined),
    };

    mockAccessControlPort = {
      assertCanReadNode: vi.fn(),
      assertCanCreateEntity: vi.fn(),
      assertCanEditEntity: vi.fn(),
      assertCanDeleteEntity: vi.fn(),
      assertCanCreateNode: vi.fn(),
      assertCanMoveNode: vi.fn(),
      assertCanMoveEntity: vi.fn(),
      assertHasPermission: vi.fn().mockResolvedValue(undefined),
      assertHasPermissionCoverage: vi.fn().mockResolvedValue(undefined),
      assertHasPermissionCoverageBatch: vi.fn().mockResolvedValue(undefined),
      assertIsSuperAdmin: vi.fn().mockResolvedValue(undefined),
    };

    service = new TypeAdminApplicationService(
      mockRepo as unknown as TypeDefinitionAdminRepository,
      mockInvalidation as SchemaInvalidationPort,
      mockAudit as AuditPort,
      mockTransaction as TransactionPort,
      mockIdGen as IdGeneratorPort,
      mockStorageTableManager as unknown as StorageTableManagementPort,
      mockAccessControlPort as AccessControlPort
    );
  });

  // ─── createType ──────────────────────────────────────────────

  describe('createType', () => {
    it('should create a node type successfully', async () => {
      const result = await service.createType({
        domain: 'node', typeKey: 'location', name: 'Location',
        actorUserId: ACTOR,
      });

      expect(result.typeKey).toBe('location');
      expect(result.id).toBe(GENERATED_ID);
      expect(result.isActive).toBe(true);
      expect(result.currentSchemaVersion).toBe(1);
      expect(result.storageTable).toBeNull();
      expect(mockRepo.createType).toHaveBeenCalledOnce();
      expect(mockAudit.record).toHaveBeenCalledOnce();
    });

    it('should create an entity type with storageTable', async () => {
      const result = await service.createType({
        domain: 'entity', typeKey: 'sensor', name: 'Sensor',
        storageTable: 'entity_sensor', actorUserId: ACTOR,
      });

      expect(result.storageTable).toBe('entity_sensor');
      expect(mockRepo.createType).toHaveBeenCalledOnce();
    });

    it('should throw if entity type without storageTable', async () => {
      await expect(service.createType({
        domain: 'entity', typeKey: 'sensor', name: 'Sensor', actorUserId: ACTOR,
      })).rejects.toThrow(TypeAdminValidationError);
    });

    it('should throw on duplicate typeKey', async () => {
      mockRepo.findTypeByKey.mockResolvedValue(makeType());

      await expect(service.createType({
        domain: 'node', typeKey: 'device', name: 'Device', actorUserId: ACTOR,
      })).rejects.toThrow(TypeKeyAlreadyExistsError);
    });

    it('should not call invalidation (no schema exists yet)', async () => {
      await service.createType({
        domain: 'node', typeKey: 'location', name: 'Location', actorUserId: ACTOR,
      });

      expect(mockInvalidation.invalidate).not.toHaveBeenCalled();
    });
  });

  // ─── updateType ──────────────────────────────────────────────

  describe('updateType', () => {
    it('should update type name and description', async () => {
      mockRepo.findTypeById.mockResolvedValue(makeType());

      const result = await service.updateType({
        domain: 'node', typeId: TYPE_ID, name: 'Updated Name',
        description: 'Updated', actorUserId: ACTOR,
      });

      expect(result.name).toBe('Updated Name');
      expect(result.rowVersion).toBe(2);
      expect(mockRepo.updateType).toHaveBeenCalledOnce();
    });

    it('should throw on version mismatch', async () => {
      mockRepo.findTypeById.mockResolvedValue(makeType({ rowVersion: 3 }));

      await expect(service.updateType({
        domain: 'node', typeId: TYPE_ID, name: 'X',
        expectedRowVersion: 1, actorUserId: ACTOR,
      })).rejects.toThrow(RowVersionMismatchError);
    });

    it('should throw on system type', async () => {
      mockRepo.findTypeById.mockResolvedValue(makeType({ isSystem: true }));

      await expect(service.updateType({
        domain: 'node', typeId: TYPE_ID, name: 'X', actorUserId: ACTOR,
      })).rejects.toThrow(SystemTypeModificationError);
    });

    it('should not call invalidation (name/description do not affect schema)', async () => {
      mockRepo.findTypeById.mockResolvedValue(makeType());

      await service.updateType({
        domain: 'node', typeId: TYPE_ID, name: 'New', actorUserId: ACTOR,
      });

      expect(mockInvalidation.invalidate).not.toHaveBeenCalled();
    });
  });

  // ─── disableType ─────────────────────────────────────────────

  describe('disableType', () => {
    it('should disable a type without instances', async () => {
      mockRepo.findTypeById.mockResolvedValue(makeType());
      mockRepo.hasInstancesOfType.mockResolvedValue(false);

      await service.disableType({ domain: 'node', typeId: TYPE_ID, expectedRowVersion: 1, actorUserId: ACTOR });

      const updateCall = mockRepo.updateType.mock.calls[0]!;
      expect(updateCall[1].isActive).toBe(false);
    });

    it('should throw if type has instances', async () => {
      mockRepo.findTypeById.mockResolvedValue(makeType());
      mockRepo.hasInstancesOfType.mockResolvedValue(true);

      await expect(service.disableType({
        domain: 'node', typeId: TYPE_ID, expectedRowVersion: 1, actorUserId: ACTOR,
      })).rejects.toThrow(TypeHasInstancesError);
    });

    it('should throw on system type', async () => {
      mockRepo.findTypeById.mockResolvedValue(makeType({ isSystem: true }));

      await expect(service.disableType({
        domain: 'node', typeId: TYPE_ID, expectedRowVersion: 1, actorUserId: ACTOR,
      })).rejects.toThrow(SystemTypeModificationError);
    });

    it('should invalidate after commit', async () => {
      mockRepo.findTypeById.mockResolvedValue(makeType());
      mockRepo.hasInstancesOfType.mockResolvedValue(false);

      await service.disableType({ domain: 'node', typeId: TYPE_ID, expectedRowVersion: 1, actorUserId: ACTOR });

      expect(mockInvalidation.invalidate).toHaveBeenCalledWith('node', 'device');
      expect(invalidateCalledInsideTransaction).toBe(false);
    });
  });

  // ─── addField ────────────────────────────────────────────────

  describe('addField', () => {
    it('should add a field and bump schema version', async () => {
      mockRepo.findTypeById.mockResolvedValue(makeType());

      const result = await service.addField({
        domain: 'node', typeId: TYPE_ID, fieldKey: 'serial_number',
        label: 'Serial Number', columnName: 'serial_number',
        dataType: 'string', isRequired: true, position: 0, actorUserId: ACTOR,
      });

      expect(result.fieldKey).toBe('serial_number');
      expect(mockRepo.createField).toHaveBeenCalledOnce();
      // bumpTypeSchemaVersion chiama updateType
      const updateCall = mockRepo.updateType.mock.calls[0]!;
      expect(updateCall[1].currentSchemaVersion).toBe(2);
      expect(updateCall[1].rowVersion).toBe(2);
    });

    it('should throw on duplicate fieldKey', async () => {
      mockRepo.findTypeById.mockResolvedValue(makeType());
      mockRepo.existsFieldByKey.mockResolvedValue(true);

      await expect(service.addField({
        domain: 'node', typeId: TYPE_ID, fieldKey: 'serial_number',
        label: 'SN', columnName: 'sn', dataType: 'string', position: 0, actorUserId: ACTOR,
      })).rejects.toThrow(TypeFieldKeyAlreadyExistsError);
    });

    it('should throw on duplicate columnName', async () => {
      mockRepo.findTypeById.mockResolvedValue(makeType());
      mockRepo.existsFieldByColumnName.mockResolvedValue(true);

      await expect(service.addField({
        domain: 'node', typeId: TYPE_ID, fieldKey: 'new_field',
        label: 'New', columnName: 'serial_number', dataType: 'string', position: 0, actorUserId: ACTOR,
      })).rejects.toThrow(TypeFieldColumnNameAlreadyExistsError);
    });

    it('should check optimistic concurrency on the type', async () => {
      mockRepo.findTypeById.mockResolvedValue(makeType({ rowVersion: 5 }));

      await expect(service.addField({
        domain: 'node', typeId: TYPE_ID, fieldKey: 'f',
        label: 'F', columnName: 'f', dataType: 'string', position: 0,
        expectedTypeRowVersion: 3, actorUserId: ACTOR,
      })).rejects.toThrow(RowVersionMismatchError);
    });

    it('should invalidate after commit, not during transaction', async () => {
      mockRepo.findTypeById.mockResolvedValue(makeType());

      await service.addField({
        domain: 'entity', typeId: TYPE_ID, fieldKey: 'temp',
        label: 'Temperature', columnName: 'temperature',
        dataType: 'decimal', position: 0, actorUserId: ACTOR,
      });

      expect(mockInvalidation.invalidate).toHaveBeenCalledWith('entity', 'device');
      expect(invalidateCalledInsideTransaction).toBe(false);
    });
  });

  // ─── updateField ─────────────────────────────────────────────

  describe('updateField', () => {
    it('should update a field and bump schema version', async () => {
      mockRepo.findTypeById.mockResolvedValue(makeType());
      mockRepo.findFieldById.mockResolvedValue(makeField());

      const result = await service.updateField({
        domain: 'node', typeId: TYPE_ID, fieldId: FIELD_ID,
        label: 'Updated Label', actorUserId: ACTOR,
      });

      expect(result.label).toBe('Updated Label');
      expect(mockRepo.updateField).toHaveBeenCalledOnce();
      const updateCall = mockRepo.updateType.mock.calls[0]!;
      expect(updateCall[1].currentSchemaVersion).toBe(2);
    });

    it('should throw on system field', async () => {
      mockRepo.findTypeById.mockResolvedValue(makeType());
      mockRepo.findFieldById.mockResolvedValue(makeField({ isSystem: true }));

      await expect(service.updateField({
        domain: 'node', typeId: TYPE_ID, fieldId: FIELD_ID,
        label: 'X', actorUserId: ACTOR,
      })).rejects.toThrow(SystemFieldModificationError);
    });

    it('should throw if field not found', async () => {
      mockRepo.findTypeById.mockResolvedValue(makeType());
      mockRepo.findFieldById.mockResolvedValue(null);

      await expect(service.updateField({
        domain: 'node', typeId: TYPE_ID, fieldId: FIELD_ID,
        label: 'X', actorUserId: ACTOR,
      })).rejects.toThrow(TypeFieldNotFoundError);
    });

    it('should throw if field belongs to different type', async () => {
      mockRepo.findTypeById.mockResolvedValue(makeType());
      mockRepo.findFieldById.mockResolvedValue(makeField({ typeDefinitionId: 'other-type-id' }));

      await expect(service.updateField({
        domain: 'node', typeId: TYPE_ID, fieldId: FIELD_ID,
        label: 'X', actorUserId: ACTOR,
      })).rejects.toThrow(TypeFieldNotFoundError);
    });

    it('should check optimistic concurrency on the type', async () => {
      mockRepo.findTypeById.mockResolvedValue(makeType({ rowVersion: 2 }));
      mockRepo.findFieldById.mockResolvedValue(makeField());

      await expect(service.updateField({
        domain: 'node', typeId: TYPE_ID, fieldId: FIELD_ID,
        label: 'X', expectedTypeRowVersion: 1, actorUserId: ACTOR,
      })).rejects.toThrow(RowVersionMismatchError);
    });

    it('should invalidate after commit', async () => {
      mockRepo.findTypeById.mockResolvedValue(makeType());
      mockRepo.findFieldById.mockResolvedValue(makeField());

      await service.updateField({
        domain: 'node', typeId: TYPE_ID, fieldId: FIELD_ID,
        label: 'X', actorUserId: ACTOR,
      });

      expect(mockInvalidation.invalidate).toHaveBeenCalledWith('node', 'device');
      expect(invalidateCalledInsideTransaction).toBe(false);
    });
  });

  // ─── removeField ─────────────────────────────────────────────

  describe('removeField', () => {
    it('should remove a field without instances', async () => {
      mockRepo.findTypeById.mockResolvedValue(makeType());
      mockRepo.findFieldById.mockResolvedValue(makeField());
      mockRepo.hasInstancesOfType.mockResolvedValue(false);

      await service.removeField({
        domain: 'node', typeId: TYPE_ID, fieldId: FIELD_ID, actorUserId: ACTOR,
      });

      expect(mockRepo.deleteField).toHaveBeenCalledWith('node', FIELD_ID);
    });

    it('should not block a node custom field merely because the type has instances', async () => {
      mockRepo.findTypeById.mockResolvedValue(makeType());
      mockRepo.findFieldById.mockResolvedValue(makeField());
      mockRepo.hasInstancesOfType.mockResolvedValue(true);
      mockRepo.hasValuesInField.mockResolvedValue(false);

      await service.removeField({
        domain: 'node', typeId: TYPE_ID, fieldId: FIELD_ID, actorUserId: ACTOR,
      });
      expect(mockRepo.deleteField).toHaveBeenCalledWith('node', FIELD_ID);
    });

    it('should throw on system field', async () => {
      mockRepo.findTypeById.mockResolvedValue(makeType());
      mockRepo.findFieldById.mockResolvedValue(makeField({ isSystem: true }));

      await expect(service.removeField({
        domain: 'node', typeId: TYPE_ID, fieldId: FIELD_ID, actorUserId: ACTOR,
      })).rejects.toThrow(SystemFieldModificationError);
    });

    it('should invalidate after commit', async () => {
      mockRepo.findTypeById.mockResolvedValue(makeType());
      mockRepo.findFieldById.mockResolvedValue(makeField());
      mockRepo.hasInstancesOfType.mockResolvedValue(false);

      await service.removeField({
        domain: 'node', typeId: TYPE_ID, fieldId: FIELD_ID, actorUserId: ACTOR,
      });

      expect(mockInvalidation.invalidate).toHaveBeenCalledWith('node', 'device');
      expect(invalidateCalledInsideTransaction).toBe(false);
    });
  });

  // ─── addConstraint ───────────────────────────────────────────

  describe('addConstraint', () => {
    it('should accept a syntactically valid and safe regex', async () => {
      mockRepo.findTypeById.mockResolvedValue(makeType());
      mockRepo.findFieldById.mockResolvedValue(makeField());

      await service.addConstraint({
        domain: 'node', typeId: TYPE_ID, fieldId: FIELD_ID,
        constraintType: 'regex', constraintValueText: '^[a-z0-9_]+$', actorUserId: ACTOR,
      });

      expect(mockRepo.createConstraint).toHaveBeenCalledOnce();
    });

    it('should reject a regex with invalid syntax', async () => {
      mockRepo.findTypeById.mockResolvedValue(makeType());
      mockRepo.findFieldById.mockResolvedValue(makeField());

      await expect(service.addConstraint({
        domain: 'node', typeId: TYPE_ID, fieldId: FIELD_ID,
        constraintType: 'regex', constraintValueText: '[a-', actorUserId: ACTOR,
      })).rejects.toThrow(TypeAdminValidationError);
      expect(mockRepo.createConstraint).not.toHaveBeenCalled();
    });

    it('should reject a regex longer than 512 characters', async () => {
      mockRepo.findTypeById.mockResolvedValue(makeType());
      mockRepo.findFieldById.mockResolvedValue(makeField());

      await expect(service.addConstraint({
        domain: 'node', typeId: TYPE_ID, fieldId: FIELD_ID,
        constraintType: 'regex', constraintValueText: `^${'a'.repeat(511)}$`, actorUserId: ACTOR,
      })).rejects.toThrow(TypeAdminValidationError);
      expect(mockRepo.createConstraint).not.toHaveBeenCalled();
    });

    it('should reject a regex with nested quantifiers', async () => {
      mockRepo.findTypeById.mockResolvedValue(makeType());
      mockRepo.findFieldById.mockResolvedValue(makeField());

      await expect(service.addConstraint({
        domain: 'node', typeId: TYPE_ID, fieldId: FIELD_ID,
        constraintType: 'regex', constraintValueText: '^(a+)+$', actorUserId: ACTOR,
      })).rejects.toThrow(TypeAdminValidationError);
      expect(mockRepo.createConstraint).not.toHaveBeenCalled();
    });

    it('should add a constraint and bump schema version', async () => {
      mockRepo.findTypeById.mockResolvedValue(makeType());
      mockRepo.findFieldById.mockResolvedValue(makeField());

      const result = await service.addConstraint({
        domain: 'node', typeId: TYPE_ID, fieldId: FIELD_ID,
        constraintType: 'min_length', constraintValueText: '3', actorUserId: ACTOR,
      });

      expect(result.constraintType).toBe('min_length');
      expect(result.constraintValueText).toBe('3');
      expect(mockRepo.createConstraint).toHaveBeenCalledOnce();
    });

    it('should throw if field not found', async () => {
      mockRepo.findTypeById.mockResolvedValue(makeType());
      mockRepo.findFieldById.mockResolvedValue(null);

      await expect(service.addConstraint({
        domain: 'node', typeId: TYPE_ID, fieldId: FIELD_ID,
        constraintType: 'min', constraintValueText: '0', actorUserId: ACTOR,
      })).rejects.toThrow(TypeFieldNotFoundError);
    });

    it('should invalidate after commit', async () => {
      mockRepo.findTypeById.mockResolvedValue(makeType());
      mockRepo.findFieldById.mockResolvedValue(makeField());

      await service.addConstraint({
        domain: 'entity', typeId: TYPE_ID, fieldId: FIELD_ID,
        constraintType: 'max', constraintValueText: '100', actorUserId: ACTOR,
      });

      expect(mockInvalidation.invalidate).toHaveBeenCalledWith('entity', 'device');
      expect(invalidateCalledInsideTransaction).toBe(false);
    });
  });

  // ─── updateConstraint ────────────────────────────────────────

  describe('updateConstraint', () => {
    it('should validate a regex when updating its value', async () => {
      mockRepo.findTypeById.mockResolvedValue(makeType());
      mockRepo.findConstraintById.mockResolvedValue(
        new ManagedTypeFieldConstraint(CONSTRAINT_ID, FIELD_ID, 'regex', '^[A-Z]+$', new Date())
      );

      await expect(service.updateConstraint({
        domain: 'node', typeId: TYPE_ID, constraintId: CONSTRAINT_ID,
        constraintValueText: '^(a+)+$', actorUserId: ACTOR,
      })).rejects.toThrow(TypeAdminValidationError);
      expect(mockRepo.updateConstraint).not.toHaveBeenCalled();
    });

    it('should update constraint value', async () => {
      mockRepo.findTypeById.mockResolvedValue(makeType());
      mockRepo.findConstraintById.mockResolvedValue(
        new ManagedTypeFieldConstraint(CONSTRAINT_ID, FIELD_ID, 'min_length', '3', new Date())
      );

      const result = await service.updateConstraint({
        domain: 'node', typeId: TYPE_ID, constraintId: CONSTRAINT_ID,
        constraintValueText: '5', actorUserId: ACTOR,
      });

      expect(result.constraintValueText).toBe('5');
      expect(mockRepo.updateConstraint).toHaveBeenCalledOnce();
    });

    it('should throw if constraint not found', async () => {
      mockRepo.findTypeById.mockResolvedValue(makeType());
      mockRepo.findConstraintById.mockResolvedValue(null);

      await expect(service.updateConstraint({
        domain: 'node', typeId: TYPE_ID, constraintId: CONSTRAINT_ID,
        constraintValueText: '5', actorUserId: ACTOR,
      })).rejects.toThrow(TypeFieldConstraintNotFoundError);
    });
  });

  // ─── removeConstraint ────────────────────────────────────────

  describe('removeConstraint', () => {
    it('should remove a constraint and invalidate after commit', async () => {
      mockRepo.findTypeById.mockResolvedValue(makeType());
      mockRepo.findConstraintById.mockResolvedValue(
        new ManagedTypeFieldConstraint(CONSTRAINT_ID, FIELD_ID, 'regex', '^[A-Z]+$', new Date())
      );

      await service.removeConstraint({
        domain: 'node', typeId: TYPE_ID, constraintId: CONSTRAINT_ID, actorUserId: ACTOR,
      });

      expect(mockRepo.deleteConstraint).toHaveBeenCalledWith('node', CONSTRAINT_ID);
      expect(mockInvalidation.invalidate).toHaveBeenCalledWith('node', 'device');
      expect(invalidateCalledInsideTransaction).toBe(false);
    });
  });

  // ─── Command Validation ──────────────────────────────────────

  describe('command validation', () => {
    it('should reject invalid typeKey format', async () => {
      await expect(service.createType({
        domain: 'node', typeKey: 'Invalid-Key!', name: 'X', actorUserId: ACTOR,
      } as CreateTypeCommand)).rejects.toThrow(TypeAdminValidationError);
    });

    it('should reject invalid actorUserId', async () => {
      await expect(service.createType({
        domain: 'node', typeKey: 'valid', name: 'X', actorUserId: 'not-a-uuid',
      } as CreateTypeCommand)).rejects.toThrow(TypeAdminValidationError);
    });
  });

  // ─── DDL Storage Table Operations ────────────────────────────

  describe('DDL integration', () => {
    it('should call createStorageTable when creating an entity type', async () => {
      await service.createType({
        domain: 'entity', typeKey: 'device', name: 'Device',
        storageTable: 'entity_device', actorUserId: ACTOR,
      });

      expect(mockStorageTableManager.createStorageTable).toHaveBeenCalledWith('entity_device');
    });

    it('should NOT call createStorageTable when creating a node type', async () => {
      await service.createType({
        domain: 'node', typeKey: 'location', name: 'Location', actorUserId: ACTOR,
      });

      expect(mockStorageTableManager.createStorageTable).not.toHaveBeenCalled();
    });

    it('should add column and index when adding field to entity type', async () => {
      mockRepo.findTypeById.mockResolvedValue(makeType({ storageTable: 'entity_device' }));

      await service.addField({
        domain: 'entity', typeId: TYPE_ID, fieldKey: 'serial_number',
        label: 'Serial Number', columnName: 'serial_number',
        dataType: 'string', isRequired: true, isUnique: true, isIndexed: true,
        position: 0, actorUserId: ACTOR,
      });

      expect(mockStorageTableManager.addColumn).toHaveBeenCalledWith(
        'entity_device', 'serial_number', 'string', true, true, null
      );
      expect(mockStorageTableManager.createIndex).toHaveBeenCalledWith('entity_device', 'serial_number');
    });

    it('should update column properties on field update', async () => {
      mockRepo.findTypeById.mockResolvedValue(makeType({ storageTable: 'entity_device' }));
      
      const prevField = makeField({ isRequired: false, isUnique: false, isIndexed: false });
      mockRepo.findFieldById.mockResolvedValue(prevField);

      await service.updateField({
        domain: 'entity', typeId: TYPE_ID, fieldId: FIELD_ID,
        isRequired: true, isUnique: true, isIndexed: true, actorUserId: ACTOR,
      });

      expect(mockStorageTableManager.updateColumnNullability).toHaveBeenCalledWith('entity_device', 'serial_number', true);
      expect(mockStorageTableManager.createUniqueConstraint).toHaveBeenCalledWith('entity_device', 'serial_number');
      expect(mockStorageTableManager.createIndex).toHaveBeenCalledWith('entity_device', 'serial_number');
    });

    it('should drop constraints and indexes when flags change to false', async () => {
      mockRepo.findTypeById.mockResolvedValue(makeType({ storageTable: 'entity_device' }));
      
      const prevField = makeField({ isRequired: true, isUnique: true, isIndexed: true });
      mockRepo.findFieldById.mockResolvedValue(prevField);

      await service.updateField({
        domain: 'entity', typeId: TYPE_ID, fieldId: FIELD_ID,
        isRequired: false, isUnique: false, isIndexed: false, actorUserId: ACTOR,
      });

      expect(mockStorageTableManager.updateColumnNullability).toHaveBeenCalledWith('entity_device', 'serial_number', false);
      expect(mockStorageTableManager.dropUniqueConstraint).toHaveBeenCalledWith('entity_device', 'serial_number');
      expect(mockStorageTableManager.dropIndex).toHaveBeenCalledWith('entity_device', 'serial_number');
    });

    it('should drop column when removing field from entity type', async () => {
      mockRepo.findTypeById.mockResolvedValue(makeType({ storageTable: 'entity_device' }));
      mockRepo.findFieldById.mockResolvedValue(makeField({ columnName: 'serial_number' }));

      await service.removeField({
        domain: 'entity', typeId: TYPE_ID, fieldId: FIELD_ID, actorUserId: ACTOR,
      });

      expect(mockStorageTableManager.dropColumn).toHaveBeenCalledWith('entity_device', 'serial_number');
    });

    it('should rollback transaction if DDL fails', async () => {
      mockRepo.findTypeById.mockResolvedValue(makeType({ storageTable: 'entity_device' }));
      mockStorageTableManager.addColumn.mockRejectedValue(new Error('DDL Syntax Error'));

      await expect(service.addField({
        domain: 'entity', typeId: TYPE_ID, fieldKey: 'serial_number',
        label: 'Serial Number', columnName: 'serial_number',
        dataType: 'string', isRequired: true, position: 0, actorUserId: ACTOR,
      })).rejects.toThrow('DDL Syntax Error');

      // Verifichiamo che l'errore si propaghi, causando il rollback automatico
      // della transazione che racchiude sia le scritture a repo sia a DDL
      expect(mockInvalidation.invalidate).not.toHaveBeenCalled();
    });
  });
});
