'use server';

/** Exposes authenticated administration of generic workflow catalogues and immutable definitions. */
import type { EventTypeDefinition, WorkflowDefinition } from '@dashboard/core';
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
