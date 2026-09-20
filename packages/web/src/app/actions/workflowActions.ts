'use server';

/** Exposes authenticated administration of generic workflow catalogues and immutable definitions. */
import type { EventTypeDefinition, WorkflowDefinition, WorkflowDefinitionListPageDto, WorkflowDefinitionListPageParams } from '@dashboard/core';
import { workflowAdminService } from '../../server/db';
import { AuthResolver } from './auth/AuthResolver';
import { mapAppErrorToApiErrorResponse } from './errorMapping';
import type { ApiErrorResponse } from '@dashboard/core';
import { publishAdministrativeChange } from '../../server/adminRealtime';

export async function listWorkflowEventTypesAction(): Promise<{ success: boolean; data?: EventTypeDefinition[]; error?: ApiErrorResponse }> {
  try {
    return { success: true, data: await workflowAdminService.listEventTypes(await AuthResolver.resolveActorUserId()) };
  } catch (error) {
    return { success: false, error: mapAppErrorToApiErrorResponse(error) };
  }
}

export async function listWorkflowDefinitionsAction(): Promise<{ success: boolean; data?: WorkflowDefinition[]; error?: ApiErrorResponse }> {
  try {
    return { success: true, data: await workflowAdminService.listDefinitions(await AuthResolver.resolveActorUserId()) };
  } catch (error) {
    return { success: false, error: mapAppErrorToApiErrorResponse(error) };
  }
}

/** Returns one validated, authorized workflow catalogue window. */
export async function listWorkflowDefinitionsPageAction(input: WorkflowDefinitionListPageParams): Promise<{ success: boolean; data?: WorkflowDefinitionListPageDto; error?: ApiErrorResponse }> {
  try {
    if (!Number.isInteger(input.page) || input.page < 1 || !Number.isInteger(input.pageSize) || input.pageSize < 1 || input.pageSize > 100) throw new Error('Paginazione non valida');
    if (input.search && input.search.length > 200) throw new Error('Ricerca troppo lunga');
    if (input.sort && !['workflowId', 'name', 'version', 'status'].includes(input.sort.key)) throw new Error('Ordinamento non valido');
    if (input.sort && !['ascending', 'descending'].includes(input.sort.direction)) throw new Error('Direzione ordinamento non valida');
    return { success: true, data: await workflowAdminService.listDefinitionsPage(await AuthResolver.resolveActorUserId(), input) };
  } catch (error) { return { success: false, error: mapAppErrorToApiErrorResponse(error) }; }
}

/** Resolves the next immutable version without loading the workflow catalogue. */
export async function nextWorkflowDefinitionVersionAction(workflowId: string): Promise<{ success: boolean; data?: number; error?: ApiErrorResponse }> {
  try {
    if (!/^[a-z][a-z0-9_]{0,99}$/.test(workflowId)) throw new Error('Identificatore workflow non valido');
    return { success: true, data: await workflowAdminService.nextDefinitionVersion(await AuthResolver.resolveActorUserId(), workflowId) };
  } catch (error) { return { success: false, error: mapAppErrorToApiErrorResponse(error) }; }
}

/** Returns action contracts installed in the current deployment. */
export async function listWorkflowActionTypesAction(): Promise<{ success: boolean; data?: string[]; error?: ApiErrorResponse }> {
  try {
    return { success: true, data: await workflowAdminService.listActionTypes(await AuthResolver.resolveActorUserId()) };
  } catch (error) {
    return { success: false, error: mapAppErrorToApiErrorResponse(error) };
  }
}

export async function registerWorkflowEventTypeAction(definition: EventTypeDefinition): Promise<{ success: boolean; error?: ApiErrorResponse }> {
  try {
    const actorUserId = await AuthResolver.resolveActorUserId();
    await workflowAdminService.registerEventType(actorUserId, definition);
    await publishAdministrativeChange({ resourceType: 'system', resourceId: `workflow-event:${definition.eventType}`, changeType: 'updated', actorUserId });
    return { success: true };
  } catch (error) {
    return { success: false, error: mapAppErrorToApiErrorResponse(error) };
  }
}

export async function publishWorkflowDefinitionAction(definition: WorkflowDefinition): Promise<{ success: boolean; error?: ApiErrorResponse }> {
  try {
    const actorUserId = await AuthResolver.resolveActorUserId();
    await workflowAdminService.publishDefinition(actorUserId, definition);
    await publishAdministrativeChange({ resourceType: 'system', resourceId: `workflow:${definition.workflowId}`, changeType: 'updated', actorUserId });
    return { success: true };
  } catch (error) {
    return { success: false, error: mapAppErrorToApiErrorResponse(error) };
  }
}
