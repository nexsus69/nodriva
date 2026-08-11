'use server';

import {
  typeAdminService,
  auditAdminService,
  typeReader,
  accessControlPort,
  pgExecutor,
  auditPort,
  configService,
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
} from '@dashboard/core';
import { mapAppErrorToApiErrorResponse } from './errorMapping';
import { publishRealtimeChange } from '../../server/realtime';


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
    const result = await pgExecutor.query<{ encryption_mode: AttachmentEncryptionMode }>('SELECT encryption_mode FROM node_type_attachment_policies WHERE node_type_id = $1', [nodeTypeId]);
    return { success: true, mode: result.rows[0]?.encryption_mode ?? 'disabled' };
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
    await pgExecutor.query(`INSERT INTO node_type_attachment_policies (node_type_id, encryption_mode, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (node_type_id) DO UPDATE SET encryption_mode = EXCLUDED.encryption_mode, updated_at = NOW()`, [nodeTypeId, mode]);
    await auditPort.record(actorUserId, 'node_type.update_attachment_policy', 'node_type', nodeTypeId, null, null, { encryptionMode: mode });
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
      enumOptions: f.enumOptions,
      enumMode: f.enumMode,
      encryptionMode: f.encryptionMode,
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
    const canApply = isTarget && audit.actionKey === 'type_admin.update_type'
      && typeof before?.name === 'string' && typeof before.description === 'string';
    let reason = 'Rollback metadati disponibile.';
    if (!isTarget) reason = 'L’evento non appartiene al tipo selezionato.';
    else if (audit.actionKey !== 'type_admin.update_type') reason = 'Le modifiche strutturali richiedono una migrazione dedicata e non possono essere annullate automaticamente.';
    else if (!canApply) reason = 'Il payload storico non contiene uno stato completo ripristinabile.';
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
    const created = await typeAdminService.createType({
      domain: cmd.kind,
      typeKey: cmd.typeKey,
      name: cmd.name,
      description: cmd.description,
      storageTable: cmd.storageTable,
      placementPolicyId: cmd.placementPolicyId,
      actorUserId,
    });
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
    await typeAdminService.updateType({
      domain: kind,
      typeId: current.data.id,
      name: cmd.name,
      description: cmd.description,
      expectedRowVersion: cmd.expectedRowVersion,
      actorUserId,
    });
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
    await typeAdminService.disableType({
      domain: kind,
      typeId: current.data.id,
      expectedRowVersion: cmd.expectedRowVersion,
      actorUserId,
    });
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
    await typeAdminService.enableType({ domain: kind, typeId: current.data.id, expectedRowVersion: cmd.expectedRowVersion, actorUserId });
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
    await typeAdminService.addField({
      domain: kind,
      typeId: current.data.id,
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
      enumMode: cmd.enumMode ?? null,
      encryptionMode: cmd.encryptionMode ?? 'plaintext',
      position: cmd.position ?? current.data.fields.length,
      expectedTypeRowVersion: cmd.expectedTypeRowVersion,
      actorUserId,
    });
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
    const option = await typeAdminService.addEnumOption({
      domain: kind,
      typeId: current.data.id,
      fieldId,
      value,
      label,
      position: current.data.fields.find((field) => field.id === fieldId)?.enumOptions?.length ?? 0,
      expectedTypeRowVersion: current.data.rowVersion,
      actorUserId,
    });
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
    await typeAdminService.updateField({
      domain: kind,
      typeId: current.data.id,
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
    });
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
    await typeAdminService.removeField({
      domain: kind,
      typeId: current.data.id,
      fieldId: cmd.fieldId,
      expectedTypeRowVersion: cmd.expectedTypeRowVersion,
      actorUserId,
    });
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
    await typeAdminService.reorderFields({
      domain: kind,
      typeId: current.data.id,
      orderedFieldIds: cmd.orderedFieldIds,
      expectedTypeRowVersion: cmd.expectedTypeRowVersion,
      actorUserId,
    });
    await publishMetadataChanged(kind, typeKey, actorUserId);

    const updated = await getTypeDetailAction(kind, typeKey);
    return updated;
  } catch (err) {
    return { success: false, error: mapErrorToApiErrorResponse(err) };
  }
}
