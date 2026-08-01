'use server';

import {
  typeAdminService,
  typeReader,
  accessControlPort,
} from '../../server/db';
import { AuthResolver } from './auth/AuthResolver';
import {
  RowVersionMismatchError,
  SystemTypeModificationError,
  SystemFieldModificationError,
  TypeKeyAlreadyExistsError,
  TypeFieldKeyAlreadyExistsError,
  TypeFieldColumnNameAlreadyExistsError,
  TypeHasInstancesError,
  TypeAdminValidationError,
  TypeDefinitionNotFoundError,
  TypeFieldNotFoundError,
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
  TypeKind,
} from '@dashboard/core';


/** Helper per mappare le eccezioni del Core alla forma ApiErrorResponse */
function mapErrorToApiErrorResponse(err: unknown): ApiErrorResponse {
  if (err instanceof RowVersionMismatchError) {
    const expected = typeof err.details?.expected === 'number' ? err.details.expected : undefined;
    const actual = typeof err.details?.actual === 'number' ? err.details.actual : undefined;
    return {
      code: 'ROW_VERSION_MISMATCH',
      message: 'La risorsa è stata modificata da un altro utente. Ricarica la scheda.',
      expectedRowVersion: expected,
      currentRowVersion: actual,
    };
  }
  if (err instanceof SystemTypeModificationError) {
    return {
      code: 'SYSTEM_TYPE_FORBIDDEN',
      message: 'I tipi di sistema non possono essere modificati o disabilitati.',
      target: typeof err.details?.typeKey === 'string' ? err.details.typeKey : undefined,
    };
  }
  if (err instanceof SystemFieldModificationError) {
    return {
      code: 'SYSTEM_FIELD_FORBIDDEN',
      message: 'I campi di sistema non possono essere modificati o rimossi.',
      target: typeof err.details?.fieldId === 'string' ? err.details.fieldId : undefined,
    };
  }
  if (err instanceof TypeKeyAlreadyExistsError) {
    const typeKey = typeof err.details?.typeKey === 'string' ? err.details.typeKey : '';
    return {
      code: 'DUPLICATE_TYPE_KEY',
      message: `La chiave tipo '${typeKey}' esiste già.`,
      target: 'typeKey',
    };
  }
  if (err instanceof TypeFieldKeyAlreadyExistsError) {
    const fieldKey = typeof err.details?.fieldKey === 'string' ? err.details.fieldKey : '';
    return {
      code: 'DUPLICATE_FIELD_KEY',
      message: `La chiave campo '${fieldKey}' esiste già per questo tipo.`,
      target: 'fieldKey',
    };
  }
  if (err instanceof TypeFieldColumnNameAlreadyExistsError) {
    const columnName = typeof err.details?.columnName === 'string' ? err.details.columnName : '';
    return {
      code: 'DUPLICATE_COLUMN_NAME',
      message: `La colonna fisica '${columnName}' esiste già.`,
      target: 'columnName',
    };
  }
  if (err instanceof TypeHasInstancesError) {
    const typeId = typeof err.details?.typeId === 'string' ? err.details.typeId : undefined;
    return {
      code: 'TYPE_HAS_INSTANCES',
      message: 'Impossibile disabilitare o modificare il tipo perché possiede istanze attive.',
      target: typeId,
    };
  }
  if (err instanceof TypeAdminValidationError) {
    const issuesObj = (err.details?.issues as Record<string, string[]> | undefined) ?? {};
    const details = Object.entries(issuesObj).map(([field, msgs]) => ({
      field,
      code: 'VALIDATION_FAILED',
      message: Array.isArray(msgs) ? msgs.join(', ') : String(msgs),
    }));
    return {
      code: 'VALIDATION_ERROR',
      message: err.message,
      details,
    };
  }
  if (err instanceof TypeDefinitionNotFoundError || err instanceof TypeFieldNotFoundError) {
    return {
      code: 'NOT_FOUND',
      message: 'La risorsa richiesta non è stata trovata.',
    };
  }

  const msg = err instanceof Error ? err.message : String(err);
  return {
    code: 'VALIDATION_ERROR',
    message: msg,
  };
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
      fieldKey: f.fieldKey,
      dataType: f.dataType,
      isRequired: f.isRequired,
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
