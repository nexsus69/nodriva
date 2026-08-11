import { z } from 'zod';
import { TypeDomain } from '../../application/dto/TypeFieldDefinition.js';
import { ManagedTypeDefinition } from '../../domain/models/ManagedTypeDefinition.js';
import { ManagedTypeField } from '../../domain/models/ManagedTypeField.js';
import { ManagedTypeFieldConstraint } from '../../domain/models/ManagedTypeFieldConstraint.js';
import { ManagedEnumOption } from '../../domain/models/ManagedEnumOption.js';
import { TypeDefinitionAdminRepository } from '../ports/TypeDefinitionAdminRepository.js';
import { SchemaInvalidationPort } from '../ports/SchemaInvalidationPort.js';
import { StorageTableManagementPort } from '../ports/StorageTableManagementPort.js';
import { AuditPort } from '../ports/AuditPort.js';
import { TransactionPort } from '../ports/TransactionPort.js';
import { IdGeneratorPort } from '../ports/IdGeneratorPort.js';
import { AccessControlPort } from '../ports/AccessControlPort.js';
import { RowVersionMismatchError } from '../../domain/errors/DomainErrors.js';
import {
  TypeAdminValidationError,
  TypeDefinitionNotFoundError,
  TypeFieldNotFoundError,
  TypeFieldConstraintNotFoundError,
  TypeKeyAlreadyExistsError,
  TypeFieldKeyAlreadyExistsError,
  TypeFieldColumnNameAlreadyExistsError,
  SystemTypeModificationError,
  SystemFieldModificationError,
  TypeHasInstancesError,
  TypeFieldHasValuesError,
} from '../../domain/errors/TypeAdminErrors.js';
import {
  CreateTypeCommand, CreateTypeCommandSchema,
  UpdateTypeCommand, UpdateTypeCommandSchema,
  DisableTypeCommand, DisableTypeCommandSchema,
  EnableTypeCommand, EnableTypeCommandSchema,
  AddFieldCommand, AddFieldCommandSchema,
  UpdateFieldCommand, UpdateFieldCommandSchema,
  RemoveFieldCommand, RemoveFieldCommandSchema,
  AddConstraintCommand, AddConstraintCommandSchema,
  AddEnumOptionCommand, AddEnumOptionCommandSchema,
  UpdateConstraintCommand, UpdateConstraintCommandSchema,
  RemoveConstraintCommand, RemoveConstraintCommandSchema,
} from '../commands/TypeAdminCommands.js';

import { TypeListItemDto, TypeDetailDto, TypeSchemaImpactDto } from '../dto/AdminContractDtos.js';
import type { ConfigService } from './ConfigService.js';

export class TypeAdminApplicationService {
  constructor(
    private readonly adminRepository: TypeDefinitionAdminRepository,
    private readonly schemaInvalidation: SchemaInvalidationPort,
    private readonly auditPort: AuditPort,
    private readonly transactionPort: TransactionPort,
    private readonly idGenerator: IdGeneratorPort,
    private readonly storageTableManager: StorageTableManagementPort,
    private readonly accessControlPort: AccessControlPort,
    private readonly configService?: ConfigService
  ) {}

  private permission(domain: TypeDomain, action: 'create' | 'update' | 'delete' | 'read'): string {
    return `${domain === 'node' ? 'node' : 'entity'}_type.${action}`;
  }

  // ─── Query Operations ──────────────────────────────────────────

  async listTypes(actorUserId: string, domain: TypeDomain): Promise<TypeListItemDto[]> {
    await this.accessControlPort.assertHasPermission(
      actorUserId,
      this.permission(domain, 'read'),
      null
    );
    return await this.adminRepository.listTypes(domain);
  }

  async getTypeDetail(actorUserId: string, domain: TypeDomain, typeKey: string): Promise<TypeDetailDto | null> {
    await this.accessControlPort.assertHasPermission(
      actorUserId,
      this.permission(domain, 'read'),
      null
    );
    return await this.adminRepository.getTypeDetail(domain, typeKey);
  }

  async getSchemaChangeImpact(
    actorUserId: string,
    domain: TypeDomain,
    typeKey: string,
    operation: TypeSchemaImpactDto['operation'],
    fieldId?: string,
  ): Promise<TypeSchemaImpactDto | null> {
    await this.accessControlPort.assertHasPermission(actorUserId, this.permission(domain, 'read'), null);
    const detail = await this.adminRepository.getTypeDetail(domain, typeKey);
    if (!detail) return null;

    const field = fieldId ? await this.adminRepository.findFieldById(domain, fieldId) : null;
    const fieldBelongsToType = field ? field.typeDefinitionId === detail.id : !fieldId;
    const fieldHasValues = field && fieldBelongsToType
      ? await this.adminRepository.hasValuesInField(domain, detail.id, field.fieldKey, field.columnName)
      : null;
    const incomingRelationCount = await this.adminRepository.countIncomingRelations(domain, detail.typeKey);
    const blockingReasons: string[] = [];
    const warnings: string[] = [];

    if (fieldId && (!field || !fieldBelongsToType)) blockingReasons.push('Il campo selezionato non appartiene al tipo.');
    if (operation === 'remove_field' && field?.isSystem) blockingReasons.push('I campi di sistema non possono essere rimossi.');
    if (operation === 'remove_field' && fieldHasValues) blockingReasons.push('Il campo contiene valori o allegati e non può essere rimosso.');
    if (detail.instanceCount > 0) warnings.push(`La modifica verrà applicata a ${detail.instanceCount} istanze attive.`);
    if (incomingRelationCount > 0) warnings.push(`Esistono ${incomingRelationCount} campi di relazione che puntano a questo tipo.`);
    if (!detail.isActive && operation !== 'enable_type') warnings.push('Il tipo è disabilitato.');

    return {
      operation,
      currentSchemaVersion: detail.currentSchemaVersion,
      nextSchemaVersion: operation === 'disable_type' || operation === 'enable_type' ? detail.currentSchemaVersion : detail.currentSchemaVersion + 1,
      instanceCount: detail.instanceCount,
      fieldCount: detail.fields.length,
      isActive: detail.isActive,
      fieldKey: field?.fieldKey ?? null,
      fieldHasValues,
      incomingRelationCount,
      blockingReasons,
      warnings,
    };
  }

  async rollbackTypeMetadata(cmd: {
    actorUserId: string;
    domain: TypeDomain;
    typeId: string;
    name: string;
    description: string;
    expectedRowVersion: number;
    sourceAuditId: string;
  }): Promise<void> {
    await this.accessControlPort.assertHasPermission(cmd.actorUserId, this.permission(cmd.domain, 'update'), null);
    await this.transactionPort.runInTransaction(async () => {
      const type = await this.loadAndGuardType(cmd.domain, cmd.typeId, cmd.expectedRowVersion);
      const now = new Date();
      const restored = new ManagedTypeDefinition(
        type.id, type.typeKey, cmd.name, cmd.description, type.storageTable, type.placementPolicyId,
        type.currentSchemaVersion, type.isActive, type.isSystem, type.rowVersion + 1,
        type.createdAt, now, type.deletedAt,
      );
      await this.adminRepository.updateType(cmd.domain, restored);
      await this.auditPort.record(
        cmd.actorUserId,
        'type_admin.rollback_metadata',
        cmd.domain === 'entity' ? 'entity_type' : 'node_type',
        type.id,
        null,
        { name: type.name, description: type.description, sourceAuditId: cmd.sourceAuditId },
        { name: restored.name, description: restored.description, sourceAuditId: cmd.sourceAuditId },
      );
    });
  }

  // ─── Type Operations ───────────────────────────────────────────

  async createType(cmd: CreateTypeCommand): Promise<ManagedTypeDefinition> {
    const v = this.validateCommand(CreateTypeCommandSchema, cmd, 'creating type');
    await this.accessControlPort.assertHasPermission(v.actorUserId, this.permission(v.domain, 'create'), null);

    if (v.domain === 'entity' && !v.storageTable) {
      throw new TypeAdminValidationError('storageTable is required for entity types.', {
        storageTable: ['Required for domain "entity"'],
      });
    }

    const typeDef = await this.transactionPort.runInTransaction(async () => {
      const existing = await this.adminRepository.findTypeByKey(v.domain, v.typeKey);
      if (existing) {
        throw new TypeKeyAlreadyExistsError(v.typeKey, v.domain);
      }

      const now = new Date();
      const created = new ManagedTypeDefinition(
        this.idGenerator.generate(),
        v.typeKey,
        v.name,
        v.description ?? '',
        v.domain === 'entity' ? (v.storageTable ?? null) : null,
        v.domain === 'entity' ? (v.placementPolicyId ?? null) : null,
        1,     // currentSchemaVersion
        true,  // isActive
        false, // isSystem
        1,     // rowVersion
        now,
        now,
        null   // deletedAt
      );

      await this.adminRepository.createType(v.domain, created);
      if (v.domain === 'entity' && created.storageTable) {
        await this.storageTableManager.createStorageTable(created.storageTable);
      }
      await this.auditPort.record(v.actorUserId, 'type_admin.create_type', v.domain === 'entity' ? 'entity_type' : 'node_type', created.id, null, null, {
        domain: v.domain, typeKey: created.typeKey, name: created.name,
      });

      return created;
    });

    // Nessuna invalidazione: il tipo appena creato non ha schema in cache.
    return typeDef;
  }

  async updateType(cmd: UpdateTypeCommand): Promise<ManagedTypeDefinition> {
    const v = this.validateCommand(UpdateTypeCommandSchema, cmd, 'updating type');
    await this.accessControlPort.assertHasPermission(v.actorUserId, this.permission(v.domain, 'update'), null);

    const updated = await this.transactionPort.runInTransaction(async () => {
      const type = await this.loadAndGuardType(v.domain, v.typeId, v.expectedRowVersion);

      const now = new Date();
      const result = new ManagedTypeDefinition(
        type.id,
        type.typeKey,
        v.name ?? type.name,
        v.description ?? type.description,
        type.storageTable,
        type.placementPolicyId,
        type.currentSchemaVersion,
        type.isActive,
        type.isSystem,
        type.rowVersion + 1,
        type.createdAt,
        now,
        type.deletedAt
      );

      await this.adminRepository.updateType(v.domain, result);
      await this.auditPort.record(v.actorUserId, 'type_admin.update_type', v.domain === 'entity' ? 'entity_type' : 'node_type', type.id, null,
        { name: type.name, description: type.description },
        { name: result.name, description: result.description }
      );

      return result;
    });

    // name/description non influiscono sullo schema Zod: nessuna invalidazione.
    return updated;
  }

  async disableType(cmd: DisableTypeCommand): Promise<void> {
    const v = this.validateCommand(DisableTypeCommandSchema, cmd, 'disabling type');
    await this.accessControlPort.assertHasPermission(v.actorUserId, this.permission(v.domain, 'delete'), null);

    const typeKey = await this.transactionPort.runInTransaction(async () => {
      const type = await this.loadAndGuardType(v.domain, v.typeId, v.expectedRowVersion);

      const hasInstances = await this.adminRepository.hasInstancesOfType(v.domain, type.id);
      if (hasInstances) {
        throw new TypeHasInstancesError(type.id, v.domain, 'disable');
      }

      const now = new Date();
      const disabled = new ManagedTypeDefinition(
        type.id, type.typeKey, type.name, type.description,
        type.storageTable, type.placementPolicyId, type.currentSchemaVersion,
        false, // isActive
        type.isSystem, type.rowVersion + 1, type.createdAt, now, type.deletedAt
      );

      await this.adminRepository.updateType(v.domain, disabled);
      await this.auditPort.record(v.actorUserId, 'type_admin.disable_type', v.domain === 'entity' ? 'entity_type' : 'node_type', type.id, null,
        { isActive: true }, { isActive: false }
      );

      return type.typeKey;
    });

    this.schemaInvalidation.invalidate(v.domain, typeKey);
  }

  async enableType(cmd: EnableTypeCommand): Promise<void> {
    const v = this.validateCommand(EnableTypeCommandSchema, cmd, 'enabling type');
    await this.accessControlPort.assertHasPermission(v.actorUserId, this.permission(v.domain, 'update'), null);
    const typeKey = await this.transactionPort.runInTransaction(async () => {
      const type = await this.adminRepository.findTypeById(v.domain, v.typeId);
      if (!type || type.deletedAt) throw new TypeDefinitionNotFoundError(v.typeId, v.domain);
      if (type.isSystem) throw new SystemTypeModificationError(type.typeKey, v.domain);
      if (type.rowVersion !== v.expectedRowVersion) throw new RowVersionMismatchError(v.expectedRowVersion, type.rowVersion);
      if (type.isActive) return type.typeKey;
      const enabled = new ManagedTypeDefinition(
        type.id, type.typeKey, type.name, type.description, type.storageTable, type.placementPolicyId,
        type.currentSchemaVersion, true, type.isSystem, type.rowVersion + 1, type.createdAt, new Date(), type.deletedAt,
      );
      await this.adminRepository.updateType(v.domain, enabled);
      await this.auditPort.record(v.actorUserId, 'type_admin.enable_type', v.domain === 'entity' ? 'entity_type' : 'node_type', type.id, null, { isActive: false }, { isActive: true });
      return type.typeKey;
    });
    this.schemaInvalidation.invalidate(v.domain, typeKey);
  }

  // ─── Field Operations ──────────────────────────────────────────

  async addField(cmd: AddFieldCommand): Promise<ManagedTypeField> {
    const v = this.validateCommand(AddFieldCommandSchema, cmd, 'adding field');
    await this.accessControlPort.assertHasPermission(v.actorUserId, this.permission(v.domain, 'update'), null);
    if (v.encryptionMode === 'encrypted' && this.configService && !(await this.configService.get<boolean>('data.fieldsEncryptionEnabled'))) {
      throw new TypeAdminValidationError('Field encryption is globally disabled.', { encryptionMode: ['Enable data.fieldsEncryptionEnabled before selecting encrypted.'] });
    }

    const { field, typeKey } = await this.transactionPort.runInTransaction(async () => {
      const type = await this.loadAndGuardType(v.domain, v.typeId, v.expectedTypeRowVersion);

      if (await this.adminRepository.existsFieldByKey(v.domain, type.id, v.fieldKey)) {
        throw new TypeFieldKeyAlreadyExistsError(v.fieldKey, type.id, v.domain);
      }
      if (await this.adminRepository.existsFieldByColumnName(v.domain, type.id, v.columnName)) {
        throw new TypeFieldColumnNameAlreadyExistsError(v.columnName, type.id, v.domain);
      }

      if (v.dataType === 'relation') {
        const target = await this.adminRepository.findTypeByKey(
          v.relationTargetDomain!,
          v.relationTargetTypeKey!
        );
        if (!target || !target.isActive) {
          throw new TypeDefinitionNotFoundError(v.relationTargetTypeKey!, v.relationTargetDomain!);
        }
      }

      if (['file', 'image'].includes(v.dataType) && (v.isRequired || v.isUnique || v.isIndexed || v.defaultValueText !== undefined && v.defaultValueText !== null)) {
        throw new TypeAdminValidationError('Attachment fields cannot be required, unique, indexed, or have a database default.', {
          dataType: ['File and image fields are stored in the attachment store.'],
        });
      }

      const now = new Date();
      const newField = new ManagedTypeField(
        this.idGenerator.generate(), type.id, v.fieldKey, v.label, v.columnName,
        v.dataType, v.isRequired ?? false, v.isUnique ?? false, v.isIndexed ?? false,
        v.defaultValueText ?? null, v.position, false, now, now,
        v.relationTargetDomain ?? null, v.relationTargetTypeKey ?? null
        , v.enumMode ?? 'static', v.encryptionMode ?? 'plaintext'
      );

      await this.adminRepository.createField(v.domain, newField);
      if (v.domain === 'entity' && type.storageTable && !['file', 'image'].includes(newField.dataType.toLowerCase())) {
        await this.storageTableManager.addColumn(
          type.storageTable,
          newField.columnName,
          newField.dataType,
          newField.isRequired,
          newField.isUnique,
          newField.defaultValueText
        );
        if (newField.isIndexed) {
          await this.storageTableManager.createIndex(type.storageTable, newField.columnName);
        }
      }
      await this.bumpTypeSchemaVersion(v.domain, type);
      await this.auditPort.record(v.actorUserId, 'type_admin.add_field', v.domain === 'entity' ? 'entity_type' : 'node_type', type.id, null, null, {
        fieldId: newField.id, fieldKey: newField.fieldKey, dataType: newField.dataType,
      });

      return { field: newField, typeKey: type.typeKey };
    });

    this.schemaInvalidation.invalidate(v.domain, typeKey);
    return field;
  }

  async updateField(cmd: UpdateFieldCommand): Promise<ManagedTypeField> {
    const v = this.validateCommand(UpdateFieldCommandSchema, cmd, 'updating field');
    await this.accessControlPort.assertHasPermission(v.actorUserId, this.permission(v.domain, 'update'), null);
    if (v.encryptionMode === 'encrypted' && this.configService && !(await this.configService.get<boolean>('data.fieldsEncryptionEnabled'))) {
      throw new TypeAdminValidationError('Field encryption is globally disabled.', { encryptionMode: ['Enable data.fieldsEncryptionEnabled before selecting encrypted.'] });
    }

    const { field, typeKey } = await this.transactionPort.runInTransaction(async () => {
      const type = await this.loadAndGuardType(v.domain, v.typeId, v.expectedTypeRowVersion);

      const existing = await this.adminRepository.findFieldById(v.domain, v.fieldId);
      if (!existing || existing.typeDefinitionId !== type.id) {
        throw new TypeFieldNotFoundError(v.fieldId, v.domain);
      }
      if (existing.isSystem) {
        throw new SystemFieldModificationError(v.fieldId, v.domain);
      }

      if (['file', 'image'].includes(existing.dataType.toLowerCase()) && (v.isRequired || v.isUnique || v.isIndexed || v.defaultValueText !== undefined && v.defaultValueText !== null)) {
        throw new TypeAdminValidationError('Attachment fields cannot be required, unique, indexed, or have a database default.', {
          fieldId: ['File and image fields are stored in the attachment store.'],
        });
      }

      const now = new Date();
      const updated = new ManagedTypeField(
        existing.id, existing.typeDefinitionId, existing.fieldKey,
        v.label ?? existing.label, existing.columnName, existing.dataType,
        v.isRequired ?? existing.isRequired,
        v.isUnique ?? existing.isUnique,
        v.isIndexed ?? existing.isIndexed,
        v.defaultValueText !== undefined ? v.defaultValueText : existing.defaultValueText,
        v.position ?? existing.position,
        existing.isSystem, existing.createdAt, now,
        existing.relationTargetDomain, existing.relationTargetTypeKey, existing.enumMode, v.encryptionMode ?? existing.encryptionMode
      );

      await this.adminRepository.updateField(v.domain, updated);
      if (v.domain === 'entity' && type.storageTable && !['file', 'image'].includes(existing.dataType.toLowerCase())) {
        if (existing.isRequired !== updated.isRequired) {
          await this.storageTableManager.updateColumnNullability(type.storageTable, updated.columnName, updated.isRequired);
        }
        if (existing.defaultValueText !== updated.defaultValueText) {
          await this.storageTableManager.updateColumnDefault(type.storageTable, updated.columnName, updated.defaultValueText);
        }
        if (existing.isUnique !== updated.isUnique) {
          if (updated.isUnique) {
            await this.storageTableManager.createUniqueConstraint(type.storageTable, updated.columnName);
          } else {
            await this.storageTableManager.dropUniqueConstraint(type.storageTable, updated.columnName);
          }
        }
        if (existing.isIndexed !== updated.isIndexed) {
          if (updated.isIndexed) {
            await this.storageTableManager.createIndex(type.storageTable, updated.columnName);
          } else {
            await this.storageTableManager.dropIndex(type.storageTable, updated.columnName);
          }
        }
      }
      await this.bumpTypeSchemaVersion(v.domain, type);
      await this.auditPort.record(v.actorUserId, 'type_admin.update_field', v.domain === 'entity' ? 'entity_type' : 'node_type', type.id, null,
        { fieldId: existing.id, label: existing.label, isRequired: existing.isRequired },
        { fieldId: updated.id, label: updated.label, isRequired: updated.isRequired }
      );

      return { field: updated, typeKey: type.typeKey };
    });

    this.schemaInvalidation.invalidate(v.domain, typeKey);
    return field;
  }

  async removeField(cmd: RemoveFieldCommand): Promise<void> {
    const v = this.validateCommand(RemoveFieldCommandSchema, cmd, 'removing field');
    await this.accessControlPort.assertHasPermission(v.actorUserId, this.permission(v.domain, 'update'), null);

    const typeKey = await this.transactionPort.runInTransaction(async () => {
      const type = await this.loadAndGuardType(v.domain, v.typeId, v.expectedTypeRowVersion);

      const existing = await this.adminRepository.findFieldById(v.domain, v.fieldId);
      if (!existing || existing.typeDefinitionId !== type.id) {
        throw new TypeFieldNotFoundError(v.fieldId, v.domain);
      }
      if (existing.isSystem) {
        throw new SystemFieldModificationError(v.fieldId, v.domain);
      }

      const isAttachmentField = ['file', 'image'].includes(existing.dataType.toLowerCase());
      const hasFieldValues = await this.adminRepository.hasValuesInField(v.domain, type.id, existing.fieldKey, existing.columnName);
      if (hasFieldValues) {
        throw new TypeFieldHasValuesError(existing.id, existing.fieldKey, v.domain);
      }

      if (v.domain === 'entity' && type.storageTable && !isAttachmentField) {
        await this.storageTableManager.dropColumn(type.storageTable, existing.columnName);
      }
      await this.adminRepository.deleteField(v.domain, v.fieldId);
      await this.bumpTypeSchemaVersion(v.domain, type);
      await this.auditPort.record(v.actorUserId, 'type_admin.remove_field', v.domain === 'entity' ? 'entity_type' : 'node_type', type.id, null,
        { fieldId: existing.id, fieldKey: existing.fieldKey }, null
      );

      return type.typeKey;
    });

    this.schemaInvalidation.invalidate(v.domain, typeKey);
  }

  async reorderFields(cmd: {
    domain: TypeDomain;
    typeId: string;
    orderedFieldIds: string[];
    expectedTypeRowVersion?: number;
    actorUserId: string;
  }): Promise<void> {
    await this.accessControlPort.assertHasPermission(cmd.actorUserId, this.permission(cmd.domain, 'update'), null);

    const typeKey = await this.transactionPort.runInTransaction(async () => {
      const type = await this.loadAndGuardType(cmd.domain, cmd.typeId, cmd.expectedTypeRowVersion);

      for (let i = 0; i < cmd.orderedFieldIds.length; i++) {
        const fieldId = cmd.orderedFieldIds[i];
        if (!fieldId) continue;
        const existing = await this.adminRepository.findFieldById(cmd.domain, fieldId);
        if (!existing || existing.typeDefinitionId !== type.id) {
          throw new TypeFieldNotFoundError(fieldId, cmd.domain);
        }
        const updated = new ManagedTypeField(
          existing.id,
          existing.typeDefinitionId,
          existing.fieldKey,
          existing.label,
          existing.columnName,
          existing.dataType,
          existing.isRequired,
          existing.isUnique,
          existing.isIndexed,
          existing.defaultValueText,
          i,
          existing.isSystem,
          existing.createdAt,
          new Date()
        );
        await this.adminRepository.updateField(cmd.domain, updated);
      }

      await this.bumpTypeSchemaVersion(cmd.domain, type);
      await this.auditPort.record(cmd.actorUserId, 'type_admin.reorder_fields', cmd.domain === 'entity' ? 'entity_type' : 'node_type', type.id, null, null, {
        orderedFieldIds: cmd.orderedFieldIds,
      });

      return type.typeKey;
    });

    this.schemaInvalidation.invalidate(cmd.domain, typeKey);
  }

  // ─── Constraint Operations ─────────────────────────────────────

  async addEnumOption(cmd: AddEnumOptionCommand): Promise<ManagedEnumOption> {
    const v = this.validateCommand(AddEnumOptionCommandSchema, cmd, 'adding enum option');
    await this.accessControlPort.assertHasPermission(v.actorUserId, this.permission(v.domain, 'update'), null);

    const { option, typeKey } = await this.transactionPort.runInTransaction(async () => {
      const type = await this.loadAndGuardType(v.domain, v.typeId, v.expectedTypeRowVersion);
      const field = await this.adminRepository.findFieldById(v.domain, v.fieldId);
      if (!field || field.typeDefinitionId !== type.id) throw new TypeFieldNotFoundError(v.fieldId, v.domain);
      if (field.dataType.toLowerCase() !== 'enum') {
        throw new TypeAdminValidationError('Enum options can only be added to enum fields.', { fieldId: ['Field is not enum.'] });
      }
      if (field.enumMode !== 'managed') {
        throw new TypeAdminValidationError('This enum is static and cannot be extended from the frontend.', { fieldId: ['Enum mode is static.'] });
      }
      if (await this.adminRepository.existsEnumOption(v.domain, field.id, v.value)) {
        throw new TypeAdminValidationError('The enum option value already exists.', { value: ['Value already exists for this field.'] });
      }
      const now = new Date();
      const option = new ManagedEnumOption(this.idGenerator.generate(), field.id, v.value, v.label, v.position ?? 0, true, now, now);
      await this.adminRepository.createEnumOption(v.domain, option);
      await this.bumpTypeSchemaVersion(v.domain, type);
      await this.auditPort.record(v.actorUserId, 'type_admin.add_enum_option', v.domain === 'entity' ? 'entity_type' : 'node_type', type.id, null, null, {
        fieldId: field.id, value: option.value, label: option.label,
      });
      return { option, typeKey: type.typeKey };
    });
    this.schemaInvalidation.invalidate(v.domain, typeKey);
    return option;
  }

  async addConstraint(cmd: AddConstraintCommand): Promise<ManagedTypeFieldConstraint> {
    const v = this.validateCommand(AddConstraintCommandSchema, cmd, 'adding constraint');
    await this.accessControlPort.assertHasPermission(v.actorUserId, this.permission(v.domain, 'update'), null);

    const { constraint, typeKey } = await this.transactionPort.runInTransaction(async () => {
      const type = await this.loadAndGuardType(v.domain, v.typeId, v.expectedTypeRowVersion);

      const field = await this.adminRepository.findFieldById(v.domain, v.fieldId);
      if (!field || field.typeDefinitionId !== type.id) {
        throw new TypeFieldNotFoundError(v.fieldId, v.domain);
      }

      const now = new Date();
      const newConstraint = new ManagedTypeFieldConstraint(
        this.idGenerator.generate(), v.fieldId, v.constraintType, v.constraintValueText, now
      );

      await this.adminRepository.createConstraint(v.domain, newConstraint);
      await this.bumpTypeSchemaVersion(v.domain, type);
      await this.auditPort.record(v.actorUserId, 'type_admin.add_constraint', v.domain === 'entity' ? 'entity_type' : 'node_type', type.id, null, null, {
        constraintId: newConstraint.id, fieldId: v.fieldId, constraintType: v.constraintType,
      });

      return { constraint: newConstraint, typeKey: type.typeKey };
    });

    this.schemaInvalidation.invalidate(v.domain, typeKey);
    return constraint;
  }

  async updateConstraint(cmd: UpdateConstraintCommand): Promise<ManagedTypeFieldConstraint> {
    const v = this.validateCommand(UpdateConstraintCommandSchema, cmd, 'updating constraint');
    await this.accessControlPort.assertHasPermission(v.actorUserId, this.permission(v.domain, 'update'), null);

    const { constraint, typeKey } = await this.transactionPort.runInTransaction(async () => {
      const type = await this.loadAndGuardType(v.domain, v.typeId, v.expectedTypeRowVersion);

      const existing = await this.adminRepository.findConstraintById(v.domain, v.constraintId);
      if (!existing) {
        throw new TypeFieldConstraintNotFoundError(v.constraintId, v.domain);
      }

      const updated = new ManagedTypeFieldConstraint(
        existing.id, existing.fieldId, existing.constraintType, v.constraintValueText, existing.createdAt
      );

      await this.adminRepository.updateConstraint(v.domain, updated);
      await this.bumpTypeSchemaVersion(v.domain, type);
      await this.auditPort.record(v.actorUserId, 'type_admin.update_constraint', v.domain === 'entity' ? 'entity_type' : 'node_type', type.id, null,
        { constraintId: existing.id, value: existing.constraintValueText },
        { constraintId: updated.id, value: updated.constraintValueText }
      );

      return { constraint: updated, typeKey: type.typeKey };
    });

    this.schemaInvalidation.invalidate(v.domain, typeKey);
    return constraint;
  }

  async removeConstraint(cmd: RemoveConstraintCommand): Promise<void> {
    const v = this.validateCommand(RemoveConstraintCommandSchema, cmd, 'removing constraint');
    await this.accessControlPort.assertHasPermission(v.actorUserId, this.permission(v.domain, 'update'), null);

    const typeKey = await this.transactionPort.runInTransaction(async () => {
      const type = await this.loadAndGuardType(v.domain, v.typeId, v.expectedTypeRowVersion);

      const existing = await this.adminRepository.findConstraintById(v.domain, v.constraintId);
      if (!existing) {
        throw new TypeFieldConstraintNotFoundError(v.constraintId, v.domain);
      }

      await this.adminRepository.deleteConstraint(v.domain, v.constraintId);
      await this.bumpTypeSchemaVersion(v.domain, type);
      await this.auditPort.record(v.actorUserId, 'type_admin.remove_constraint', v.domain === 'entity' ? 'entity_type' : 'node_type', type.id, null,
        { constraintId: existing.id, constraintType: existing.constraintType }, null
      );

      return type.typeKey;
    });

    this.schemaInvalidation.invalidate(v.domain, typeKey);
  }

  // ─── Private Helpers ───────────────────────────────────────────

  private validateCommand<T>(schema: z.ZodType<T>, cmd: unknown, operationName: string): T {
    const parseResult = schema.safeParse(cmd);
    if (!parseResult.success) {
      const issues: Record<string, string[]> = {};
      for (const issue of parseResult.error.issues) {
        const path = issue.path.join('.') || 'root';
        if (!issues[path]) {
          issues[path] = [];
        }
        issues[path].push(issue.message);
      }
      throw new TypeAdminValidationError(`Validation failed for ${operationName}.`, issues);
    }
    return parseResult.data;
  }

  /**
   * Carica un tipo e applica le guardie comuni:
   * - esiste e non è soft-deleted;
   * - non è system (a meno che non sia createType, che non usa questo metodo);
   * - optimistic concurrency (se expectedRowVersion fornito).
   */
  private async loadAndGuardType(
    domain: TypeDomain,
    typeId: string,
    expectedRowVersion?: number
  ): Promise<ManagedTypeDefinition> {
    const type = await this.adminRepository.findTypeById(domain, typeId);
    if (!type || type.deletedAt) {
      throw new TypeDefinitionNotFoundError(typeId, domain);
    }
    if (type.isSystem) {
      throw new SystemTypeModificationError(type.typeKey, domain);
    }
    if (expectedRowVersion !== undefined && type.rowVersion !== expectedRowVersion) {
      throw new RowVersionMismatchError(expectedRowVersion, type.rowVersion);
    }
    return type;
  }

  /**
   * Incrementa schemaVersion e rowVersion del tipo dopo una modifica strutturale
   * (aggiunta/modifica/rimozione campo o vincolo).
   */
  private async bumpTypeSchemaVersion(domain: TypeDomain, type: ManagedTypeDefinition): Promise<void> {
    const bumped = new ManagedTypeDefinition(
      type.id, type.typeKey, type.name, type.description,
      type.storageTable, type.placementPolicyId,
      type.currentSchemaVersion + 1,
      type.isActive, type.isSystem,
      type.rowVersion + 1,
      type.createdAt, new Date(), type.deletedAt
    );
    await this.adminRepository.updateType(domain, bumped);
  }
}
