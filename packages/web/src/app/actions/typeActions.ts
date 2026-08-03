'use server';

import {
  typeAdminService,
  typeReader,
  accessControlPort,
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
} from '@dashboard/core';
import { mapAppErrorToApiErrorResponse } from './errorMapping';


/** Helper per mappare le eccezioni del Core alla forma ApiErrorResponse */
function mapErrorToApiErrorResponse(err: unknown): ApiErrorResponse {
  return mapAppErrorToApiErrorResponse(err);
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
      dataType: f.dataType,
      isRequired: f.isRequired,
      relationTargetDomain: f.relationTargetDomain,
      relationTargetTypeKey: f.relationTargetTypeKey,
      enumOptions: f.enumOptions,
      enumMode: f.enumMode,
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

/** 1. Creazione Tipo */
export async function createTypeAction(cmd: CreateTypeUiCommand): Promise<{
  success: boolean;
  data?: TypeDetailDto;
  error?: ApiErrorResponse;
}> {
  try {
    const created = await typeAdminService.createType({
      domain: cmd.kind,
      typeKey: cmd.typeKey,
      name: cmd.name,
      description: cmd.description,
      storageTable: cmd.storageTable,
      placementPolicyId: cmd.placementPolicyId,
      actorUserId: await AuthResolver.resolveActorUserId(),
    });

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

    await typeAdminService.updateType({
      domain: kind,
      typeId: current.data.id,
      name: cmd.name,
      description: cmd.description,
      expectedRowVersion: cmd.expectedRowVersion,
      actorUserId: await AuthResolver.resolveActorUserId(),
    });

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

    await typeAdminService.disableType({
      domain: kind,
      typeId: current.data.id,
      expectedRowVersion: cmd.expectedRowVersion,
      actorUserId: await AuthResolver.resolveActorUserId(),
    });

    const updated = await getTypeDetailAction(kind, typeKey);
    return updated;
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
      position: cmd.position ?? current.data.fields.length,
      expectedTypeRowVersion: cmd.expectedTypeRowVersion,
      actorUserId: await AuthResolver.resolveActorUserId(),
    });

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
    const option = await typeAdminService.addEnumOption({
      domain: kind,
      typeId: current.data.id,
      fieldId,
      value,
      label,
      position: current.data.fields.find((field) => field.id === fieldId)?.enumOptions?.length ?? 0,
      expectedTypeRowVersion: current.data.rowVersion,
      actorUserId: await AuthResolver.resolveActorUserId(),
    });
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

    await typeAdminService.updateField({
      domain: kind,
      typeId: current.data.id,
      fieldId: cmd.fieldId,
      label: cmd.label,
      isRequired: cmd.isRequired,
      isUnique: cmd.isUnique,
      isIndexed: cmd.isIndexed,
      defaultValueText: cmd.defaultValueText,
      position: cmd.position,
      expectedTypeRowVersion: cmd.expectedTypeRowVersion,
      actorUserId: await AuthResolver.resolveActorUserId(),
    });

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

    await typeAdminService.removeField({
      domain: kind,
      typeId: current.data.id,
      fieldId: cmd.fieldId,
      expectedTypeRowVersion: cmd.expectedTypeRowVersion,
      actorUserId: await AuthResolver.resolveActorUserId(),
    });

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

    await typeAdminService.reorderFields({
      domain: kind,
      typeId: current.data.id,
      orderedFieldIds: cmd.orderedFieldIds,
      expectedTypeRowVersion: cmd.expectedTypeRowVersion,
      actorUserId: await AuthResolver.resolveActorUserId(),
    });

    const updated = await getTypeDetailAction(kind, typeKey);
    return updated;
  } catch (err) {
    return { success: false, error: mapErrorToApiErrorResponse(err) };
  }
}
