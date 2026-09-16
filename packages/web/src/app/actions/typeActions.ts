'use server';

import {
  typeAdminService,
  auditAdminService,
  typeReader,
  accessControlPort,
  attachmentPolicyRepository,
  auditPort,
  configService,
  transactionPort,
} from '../../server/db';
import { AuthResolver } from './auth/AuthResolver';
import {
  ApiErrorResponse,
  TypeListItemDto,
  TypeDetailDto,
  CreateTypeUiCommand,
  UpdateTypeUiCommand,
  DisableTypeUiCommand,
  CreateFieldUiCommand,
  UpdateFieldUiCommand,
  DeleteFieldUiCommand,
  ReorderFieldsUiCommand,
  EnumOptionDto,
  TypeKind,
  TypeSchemaImpactDto,
  TypeSchemaRollbackPlanDto,
  TypeListPageParams,
} from '@dashboard/core';
import { mapAppErrorToApiErrorResponse } from './errorMapping';
import { publishRealtimeChange } from '../../server/realtime';
import { publishAdministrativeChange } from '../../server/adminRealtime';
import { withAdministrativeMutationLock } from '../../server/adminMutationLock';


/** Helper per mappare le eccezioni del Core alla forma ApiErrorResponse */
function mapErrorToApiErrorResponse(err: unknown): ApiErrorResponse {
  return mapAppErrorToApiErrorResponse(err);
}

export type AttachmentEncryptionMode = 'enabled' | 'disabled';

async function publishMetadataChanged(kind: TypeKind, typeKey: string, actorUserId: string): Promise<void> {
  await publishRealtimeChange({
    resourceType: kind,
    resourceId: typeKey,
    changeType: 'updated',
    actorUserId,
    metadataKind: kind,
  });
}

export async function getNodeTypeAttachmentPolicyAction(nodeTypeId: string): Promise<{ success: boolean; mode?: AttachmentEncryptionMode; error?: ApiErrorResponse }> {
  try {
    const actorUserId = await AuthResolver.resolveActorUserId();
    await accessControlPort.assertHasPermission(actorUserId, 'node_type.read', null);
    return { success: true, mode: await attachmentPolicyRepository.getEncryptionMode(nodeTypeId) };
  } catch (err) {
    return { success: false, error: mapErrorToApiErrorResponse(err) };
  }
}

export async function updateNodeTypeAttachmentPolicyAction(nodeTypeId: string, mode: AttachmentEncryptionMode): Promise<{ success: boolean; mode?: AttachmentEncryptionMode; error?: ApiErrorResponse }> {
  try {
    const actorUserId = await AuthResolver.resolveActorUserId();
    await accessControlPort.assertHasPermission(actorUserId, 'node_type.update', null);
    if (!['enabled', 'disabled'].includes(mode)) return { success: false, error: { code: 'VALIDATION_ERROR', message: 'Policy di cifratura non valida.' } };
    if (mode === 'enabled' && !(await configService.get<boolean>('attachments.encryptionEnabled'))) {
      return { success: false, error: { code: 'VALIDATION_ERROR', message: 'La cifratura allegati globale è disabilitata.' } };
    }
    await withAdministrativeMutationLock({
      resourceType: 'node_type',
      resourceId: nodeTypeId,
      permission: 'node_type.update',
      work: async () => transactionPort.runInTransaction(async () => {
        await attachmentPolicyRepository.setEncryptionMode(nodeTypeId, mode);
        await auditPort.record(actorUserId, 'node_type.update_attachment_policy', 'node_type', nodeTypeId, null, null, { encryptionMode: mode });
      }),
    });
    await publishAdministrativeChange({ resourceType: 'node_type', resourceId: nodeTypeId, changeType: 'updated', actorUserId, data: { encryptionMode: mode } });
    return { success: true, mode };
  } catch (err) {
    return { success: false, error: mapErrorToApiErrorResponse(err) };
  }
}

/** Caricamento della lista dei tipi (TypeListItemDto[]) */
export async function listTypesAction(kind: TypeKind): Promise<{
  success: boolean;
  data?: TypeListItemDto[];
  error?: ApiErrorResponse;
}> {
  try {
    const actorUserId = await AuthResolver.resolveActorUserId();
    const data = await typeAdminService.listTypes(actorUserId, kind);
    return { success: true, data };
  } catch (err) {
    return { success: false, error: mapErrorToApiErrorResponse(err) };
  }
}

/** Bounded administrative type catalogue; the browser never receives a full list. */
export async function listTypesPageAction(kind: TypeKind, input: Omit<TypeListPageParams, 'page'> & { page: number }): Promise<{ success: boolean; data?: Awaited<ReturnType<typeof typeAdminService.listTypesPage>>; error?: ApiErrorResponse }> {
  try {
    if (!Number.isInteger(input.page) || input.page < 1 || !Number.isInteger(input.pageSize) || input.pageSize < 1 || input.pageSize > 100) throw new Error('Paginazione non valida');
    if (input.search && input.search.length > 200) throw new Error('Ricerca troppo lunga');
    if (input.sort && !['name', 'typeKey', 'fields', 'version'].includes(input.sort.key)) throw new Error('Ordinamento non valido');
    const actorUserId = await AuthResolver.resolveActorUserId();
    return { success: true, data: await typeAdminService.listTypesPage(actorUserId, kind, input) };
  } catch (err) { return { success: false, error: mapErrorToApiErrorResponse(err) }; }
}

/** Legacy reader helper for page.tsx compatibility */
export async function getTypeDefinitionAction(domain: TypeKind, typeKey: string) {
  const actorUserId = await AuthResolver.resolveActorUserId();
  await accessControlPort.assertHasPermission(
    actorUserId,
    domain === 'node' ? 'node_type.read' : 'entity_type.read',
    null
  );
  const definition = await typeReader.readDefinition(domain, typeKey);
  if (!definition) return null;
  const encryptionCapabilityEnabled = await configService.get<boolean>('data.fieldsEncryptionEnabled');
  return {
    id: definition.id,
    domain: definition.domain,
    typeKey: definition.typeKey,
    name: definition.name,
    description: definition.description,
    currentSchemaVersion: definition.currentSchemaVersion,
    fields: definition.fields.map((f) => ({
      id: f.id,
      fieldKey: f.fieldKey,
      label: f.label,
      dataType: f.dataType,
      isRequired: f.isRequired,
      relationTargetDomain: f.relationTargetDomain,
      relationTargetTypeKey: f.relationTargetTypeKey,
      relationSourceCardinality: f.relationSourceCardinality,
      relationTargetIsUnique: f.relationTargetIsUnique,
      relationInverseLabel: f.relationInverseLabel,
      enumOptions: f.enumOptions,
      enumMode: f.enumMode,
      encryptionMode: f.encryptionMode,
      encryptionCapabilityEnabled,
      constraints: f.constraints.map((c) => ({
        constraintType: c.constraintType,
        constraintValueText: c.value,
      })),
    })),
  };
}

/** Caricamento del dettaglio tipo (TypeDetailDto) */
export async function getTypeDetailAction(kind: TypeKind, typeKey: string): Promise<{
  success: boolean;
  data?: TypeDetailDto;
  error?: ApiErrorResponse;
}> {
  try {
    const actorUserId = await AuthResolver.resolveActorUserId();
    const data = await typeAdminService.getTypeDetail(actorUserId, kind, typeKey);
    if (!data) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: `Tipo '${typeKey}' non trovato.` },
      };
    }
    return { success: true, data };
  } catch (err) {
    return { success: false, error: mapErrorToApiErrorResponse(err) };
  }
}

export async function getTypeSchemaImpactAction(
  kind: TypeKind,
  typeKey: string,
  operation: TypeSchemaImpactDto['operation'] = 'add_field',
  fieldId?: string,
): Promise<{
  success: boolean;
  data?: TypeSchemaImpactDto;
  error?: ApiErrorResponse;
}> {
  try {
    const actorUserId = await AuthResolver.resolveActorUserId();
    const data = await typeAdminService.getSchemaChangeImpact(actorUserId, kind, typeKey, operation, fieldId);
    if (!data) return { success: false, error: { code: 'NOT_FOUND', message: `Tipo '${typeKey}' non trovato.` } };
    return { success: true, data };
  } catch (err) {
    return { success: false, error: mapErrorToApiErrorResponse(err) };
  }
}

export async function getTypeSchemaRollbackPlanAction(
  kind: TypeKind,
  typeKey: string,
  auditId: string,
): Promise<{ success: boolean; data?: TypeSchemaRollbackPlanDto; error?: ApiErrorResponse }> {
  try {
    const actorUserId = await AuthResolver.resolveActorUserId();
    const detail = await typeAdminService.getTypeDetail(actorUserId, kind, typeKey);
    const audit = await auditAdminService.getAuditLogById(actorUserId, auditId);
    if (!detail || !audit) return { success: false, error: { code: 'NOT_FOUND', message: 'Tipo o evento di audit non trovato.' } };
    const expectedResourceKind = kind === 'node' ? 'node_type' : 'entity_type';
    const isTarget = audit.resourceKind === expectedResourceKind && audit.resourceId === detail.id;
    const before = audit.beforePayload;
    const after = audit.afterPayload;
    const payloadIsComplete = typeof before?.name === 'string' && typeof before.description === 'string'
      && typeof after?.name === 'string' && typeof after.description === 'string';
    const isCurrentState = payloadIsComplete
      && detail.name === after.name && detail.description === after.description;
    const canApply = isTarget && audit.actionKey === 'type_admin.update_type' && payloadIsComplete && isCurrentState;
    let reason = 'Rollback metadati disponibile.';
    if (!isTarget) reason = 'L’evento non appartiene al tipo selezionato.';
    else if (audit.actionKey !== 'type_admin.update_type') reason = 'Le modifiche strutturali richiedono una migrazione dedicata e non possono essere annullate automaticamente.';
    else if (!payloadIsComplete) reason = 'Il payload storico non contiene uno stato completo ripristinabile.';
    else if (!isCurrentState) reason = 'Il tipo è stato modificato dopo questo evento: il rollback è obsoleto e viene rifiutato.';
    return {
      success: true,
      data: {
        auditId,
        sourceActionKey: audit.actionKey,
        canApply,
        reason,
        currentSchemaVersion: detail.currentSchemaVersion,
        targetSchemaVersion: detail.currentSchemaVersion,
        targetName: canApply ? before.name as string : null,
        targetDescription: canApply ? before.description as string : null,
      },
    };
  } catch (err) {
    return { success: false, error: mapErrorToApiErrorResponse(err) };
  }
}

export async function rollbackTypeMetadataAction(
  kind: TypeKind,
  typeKey: string,
  auditId: string,
  expectedRowVersion: number,
): Promise<{ success: boolean; data?: TypeDetailDto; error?: ApiErrorResponse }> {
  try {
    const actorUserId = await AuthResolver.resolveActorUserId();
    const plan = await getTypeSchemaRollbackPlanAction(kind, typeKey, auditId);
    if (!plan.success || !plan.data) return { success: false, error: plan.error };
    if (!plan.data.canApply || plan.data.targetName === null || plan.data.targetDescription === null) {
      return { success: false, error: { code: 'ROLLBACK_NOT_SUPPORTED', message: plan.data.reason } };
    }
    const current = await typeAdminService.getTypeDetail(actorUserId, kind, typeKey);
    if (!current) return { success: false, error: { code: 'NOT_FOUND', message: 'Tipo non trovato.' } };
    await typeAdminService.rollbackTypeMetadata({
      actorUserId,
      domain: kind,
      typeId: current.id,
      name: plan.data.targetName,
      description: plan.data.targetDescription,
      expectedRowVersion,
      sourceAuditId: auditId,
    });
    await publishMetadataChanged(kind, typeKey, actorUserId);
    return getTypeDetailAction(kind, typeKey);
  } catch (err) {
    return { success: false, error: mapErrorToApiErrorResponse(err) };
  }
}

/** 1. Creazione Tipo */
export async function createTypeAction(cmd: CreateTypeUiCommand): Promise<{
  success: boolean;
  data?: TypeDetailDto;
  error?: ApiErrorResponse;
}> {
  try {
    const actorUserId = await AuthResolver.resolveActorUserId();
    const created = await withAdministrativeMutationLock({ resourceType: cmd.kind === 'node' ? 'node_type' : 'entity_type', resourceId: cmd.typeKey, permission: cmd.kind === 'node' ? 'node_type.create' : 'entity_type.create', work: async () => typeAdminService.createType({
      domain: cmd.kind,
      typeKey: cmd.typeKey,
      name: cmd.name,
      description: cmd.description,
      storageTable: cmd.storageTable,
      placementPolicyId: cmd.placementPolicyId,
      actorUserId,
    }) });
    await publishMetadataChanged(cmd.kind, created.typeKey, actorUserId);

    const res = await getTypeDetailAction(cmd.kind, created.typeKey);
    return res;
  } catch (err) {
    return { success: false, error: mapErrorToApiErrorResponse(err) };
  }
}

/** 2. Aggiornamento Coarse-Grained del Tipo */
export async function updateTypeAction(
  kind: TypeKind,
  typeKey: string,
  cmd: UpdateTypeUiCommand
): Promise<{
  success: boolean;
  data?: TypeDetailDto;
  error?: ApiErrorResponse;
}> {
  try {
    const current = await getTypeDetailAction(kind, typeKey);
    if (!current.success || !current.data) {
      return { success: false, error: current.error ?? { code: 'NOT_FOUND', message: 'Tipo non trovato.' } };
    }

    const actorUserId = await AuthResolver.resolveActorUserId();
    await withAdministrativeMutationLock({ resourceType: kind === 'node' ? 'node_type' : 'entity_type', resourceId: current.data!.id, permission: kind === 'node' ? 'node_type.update' : 'entity_type.update', work: async () => typeAdminService.updateType({
      domain: kind,
      typeId: current.data!.id,
      name: cmd.name,
      description: cmd.description,
      expectedRowVersion: cmd.expectedRowVersion,
      actorUserId,
    }) });
    await publishMetadataChanged(kind, typeKey, actorUserId);

    const updated = await getTypeDetailAction(kind, typeKey);
    return updated;
  } catch (err) {
    return { success: false, error: mapErrorToApiErrorResponse(err) };
  }
}

/** 3. Soft-Disable del Tipo */
export async function disableTypeAction(
  kind: TypeKind,
  typeKey: string,
  cmd: DisableTypeUiCommand
): Promise<{
  success: boolean;
  data?: TypeDetailDto;
  error?: ApiErrorResponse;
}> {
  try {
    const current = await getTypeDetailAction(kind, typeKey);
    if (!current.success || !current.data) {
      return { success: false, error: current.error ?? { code: 'NOT_FOUND', message: 'Tipo non trovato.' } };
    }

    const actorUserId = await AuthResolver.resolveActorUserId();
    await withAdministrativeMutationLock({ resourceType: kind === 'node' ? 'node_type' : 'entity_type', resourceId: current.data!.id, permission: kind === 'node' ? 'node_type.update' : 'entity_type.update', work: async () => typeAdminService.disableType({
      domain: kind,
      typeId: current.data!.id,
      expectedRowVersion: cmd.expectedRowVersion,
      actorUserId,
    }) });
    await publishMetadataChanged(kind, typeKey, actorUserId);

    const updated = await getTypeDetailAction(kind, typeKey);
    return updated;
  } catch (err) {
    return { success: false, error: mapErrorToApiErrorResponse(err) };
  }
}

export async function enableTypeAction(
  kind: TypeKind,
  typeKey: string,
  cmd: DisableTypeUiCommand,
): Promise<{ success: boolean; data?: TypeDetailDto; error?: ApiErrorResponse }> {
  try {
    const current = await getTypeDetailAction(kind, typeKey);
    if (!current.success || !current.data) return { success: false, error: current.error ?? { code: 'NOT_FOUND', message: 'Tipo non trovato.' } };
    const actorUserId = await AuthResolver.resolveActorUserId();
    await withAdministrativeMutationLock({ resourceType: kind === 'node' ? 'node_type' : 'entity_type', resourceId: current.data!.id, permission: kind === 'node' ? 'node_type.update' : 'entity_type.update', work: async () => typeAdminService.enableType({ domain: kind, typeId: current.data!.id, expectedRowVersion: cmd.expectedRowVersion, actorUserId }) });
    await publishMetadataChanged(kind, typeKey, actorUserId);
    return await getTypeDetailAction(kind, typeKey);
  } catch (err) {
    return { success: false, error: mapErrorToApiErrorResponse(err) };
  }
}

/** 4. Aggiunta Campo */
export async function createFieldAction(
  kind: TypeKind,
  typeKey: string,
  cmd: CreateFieldUiCommand
): Promise<{
  success: boolean;
  data?: TypeDetailDto;
  error?: ApiErrorResponse;
}> {
  try {
    const current = await getTypeDetailAction(kind, typeKey);
    if (!current.success || !current.data) {
      return { success: false, error: current.error ?? { code: 'NOT_FOUND', message: 'Tipo non trovato.' } };
    }

    const actorUserId = await AuthResolver.resolveActorUserId();
    await withAdministrativeMutationLock({ resourceType: kind === 'node' ? 'node_type' : 'entity_type', resourceId: current.data!.id, permission: kind === 'node' ? 'node_type.update' : 'entity_type.update', work: async () => typeAdminService.addField({
      domain: kind,
      typeId: current.data!.id,
      fieldKey: cmd.fieldKey,
      label: cmd.label,
      columnName: cmd.columnName,
      dataType: cmd.dataType,
      isRequired: cmd.isRequired ?? false,
      isUnique: cmd.isUnique ?? false,
      isIndexed: cmd.isIndexed ?? false,
      defaultValueText: cmd.defaultValueText ?? null,
      relationTargetDomain: cmd.relationTargetDomain ?? null,
      relationTargetTypeKey: cmd.relationTargetTypeKey ?? null,
      relationSourceCardinality: cmd.relationSourceCardinality ?? 'one',
      relationTargetIsUnique: cmd.relationTargetIsUnique ?? false,
      relationInverseLabel: cmd.relationInverseLabel ?? null,
      enumMode: cmd.enumMode ?? null,
      encryptionMode: cmd.encryptionMode ?? 'plaintext',
      position: cmd.position ?? current.data!.fields.length,
      expectedTypeRowVersion: cmd.expectedTypeRowVersion,
      actorUserId,
    }) });
    await publishMetadataChanged(kind, typeKey, actorUserId);

    const updated = await getTypeDetailAction(kind, typeKey);
    return updated;
  } catch (err) {
    return { success: false, error: mapErrorToApiErrorResponse(err) };
  }
}

export async function addEnumOptionAction(
  kind: TypeKind,
  typeKey: string,
  fieldId: string,
  value: string,
  label: string
): Promise<{ success: boolean; data?: EnumOptionDto; error?: ApiErrorResponse }> {
  try {
    const current = await getTypeDetailAction(kind, typeKey);
    if (!current.success || !current.data) return { success: false, error: current.error ?? { code: 'NOT_FOUND', message: 'Tipo non trovato.' } };
    const actorUserId = await AuthResolver.resolveActorUserId();
    const option = await withAdministrativeMutationLock({ resourceType: kind === 'node' ? 'node_type' : 'entity_type', resourceId: current.data!.id, permission: kind === 'node' ? 'node_type.update' : 'entity_type.update', work: async () => typeAdminService.addEnumOption({
      domain: kind,
      typeId: current.data!.id,
      fieldId,
      value,
      label,
      position: current.data!.fields.find((field) => field.id === fieldId)?.enumOptions?.length ?? 0,
      expectedTypeRowVersion: current.data!.rowVersion,
      actorUserId,
    }) });
    await publishMetadataChanged(kind, typeKey, actorUserId);
    return { success: true, data: { id: option.id, value: option.value, label: option.label, position: option.position, isActive: option.isActive } };
  } catch (err) {
    return { success: false, error: mapErrorToApiErrorResponse(err) };
  }
}

/** 5. Modifica Campo */
export async function updateFieldAction(
  kind: TypeKind,
  typeKey: string,
  cmd: UpdateFieldUiCommand
): Promise<{
  success: boolean;
  data?: TypeDetailDto;
  error?: ApiErrorResponse;
}> {
  try {
    const current = await getTypeDetailAction(kind, typeKey);
    if (!current.success || !current.data) {
      return { success: false, error: current.error ?? { code: 'NOT_FOUND', message: 'Tipo non trovato.' } };
    }

    const actorUserId = await AuthResolver.resolveActorUserId();
    await withAdministrativeMutationLock({ resourceType: kind === 'node' ? 'node_type' : 'entity_type', resourceId: current.data!.id, permission: kind === 'node' ? 'node_type.update' : 'entity_type.update', work: async () => typeAdminService.updateField({
      domain: kind,
      typeId: current.data!.id,
      fieldId: cmd.fieldId,
      label: cmd.label,
      isRequired: cmd.isRequired,
      isUnique: cmd.isUnique,
      isIndexed: cmd.isIndexed,
      defaultValueText: cmd.defaultValueText,
      encryptionMode: cmd.encryptionMode,
      position: cmd.position,
      expectedTypeRowVersion: cmd.expectedTypeRowVersion,
      actorUserId,
    }) });
    await publishMetadataChanged(kind, typeKey, actorUserId);

    const updated = await getTypeDetailAction(kind, typeKey);
    return updated;
  } catch (err) {
    return { success: false, error: mapErrorToApiErrorResponse(err) };
  }
}

/** 6. Eliminazione Campo */
export async function deleteFieldAction(
  kind: TypeKind,
  typeKey: string,
  cmd: DeleteFieldUiCommand
): Promise<{
  success: boolean;
  data?: TypeDetailDto;
  error?: ApiErrorResponse;
}> {
  try {
    const current = await getTypeDetailAction(kind, typeKey);
    if (!current.success || !current.data) {
      return { success: false, error: current.error ?? { code: 'NOT_FOUND', message: 'Tipo non trovato.' } };
    }

    const actorUserId = await AuthResolver.resolveActorUserId();
    await withAdministrativeMutationLock({ resourceType: kind === 'node' ? 'node_type' : 'entity_type', resourceId: current.data!.id, permission: kind === 'node' ? 'node_type.update' : 'entity_type.update', work: async () => typeAdminService.removeField({
      domain: kind,
      typeId: current.data!.id,
      fieldId: cmd.fieldId,
      expectedTypeRowVersion: cmd.expectedTypeRowVersion,
      actorUserId,
    }) });
    await publishMetadataChanged(kind, typeKey, actorUserId);

    const updated = await getTypeDetailAction(kind, typeKey);
    return updated;
  } catch (err) {
    return { success: false, error: mapErrorToApiErrorResponse(err) };
  }
}

/** 7. Riordinamento Massivo Campi */
export async function reorderFieldsAction(
  kind: TypeKind,
  typeKey: string,
  cmd: ReorderFieldsUiCommand
): Promise<{
  success: boolean;
  data?: TypeDetailDto;
  error?: ApiErrorResponse;
}> {
  try {
    const current = await getTypeDetailAction(kind, typeKey);
    if (!current.success || !current.data) {
      return { success: false, error: current.error ?? { code: 'NOT_FOUND', message: 'Tipo non trovato.' } };
    }

    const actorUserId = await AuthResolver.resolveActorUserId();
    await withAdministrativeMutationLock({ resourceType: kind === 'node' ? 'node_type' : 'entity_type', resourceId: current.data!.id, permission: kind === 'node' ? 'node_type.update' : 'entity_type.update', work: async () => typeAdminService.reorderFields({
      domain: kind,
      typeId: current.data!.id,
      orderedFieldIds: cmd.orderedFieldIds,
      expectedTypeRowVersion: cmd.expectedTypeRowVersion,
      actorUserId,
    }) });
    await publishMetadataChanged(kind, typeKey, actorUserId);

    const updated = await getTypeDetailAction(kind, typeKey);
    return updated;
  } catch (err) {
    return { success: false, error: mapErrorToApiErrorResponse(err) };
  }
}
