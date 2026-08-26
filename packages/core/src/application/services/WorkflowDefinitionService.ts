/** Validates and saves reusable workflow catalogues without exposing storage details. */
import { ValidationError } from '../../domain/errors/ApplicationErrors.js';
import type { EventTypeDefinition, WorkflowDefinition } from '../../domain/events/WorkflowEvent.js';
import type { WorkflowRepository } from '../ports/WorkflowRepository.js';

/**
 * Administrative application boundary for generic workflow configuration.
 * It accepts future subject kinds without maintaining a domain-specific allow
 * list, but requires every trigger to have a registered event contract.
 */
export class WorkflowDefinitionService {
  constructor(private readonly repository: WorkflowRepository) {}

  async registerEventType(definition: EventTypeDefinition): Promise<void> {
    const issues: Record<string, string[]> = {};
    if (!definition.eventType.trim()) issues.eventType = ['An event type is required.'];
    if (!Number.isInteger(definition.payloadVersion) || definition.payloadVersion < 1) {
      issues.payloadVersion = ['Payload version must be a positive integer.'];
    }
    if (definition.subjectKinds.length === 0) issues.subjectKinds = ['At least one subject kind is required.'];
    if (new Set(definition.subjectKinds).size !== definition.subjectKinds.length) {
      issues.subjectKinds = [...(issues.subjectKinds ?? []), 'Subject kinds must be unique.'];
    }
    if (definition.subjectKinds.some((subjectKind) => !subjectKind.trim())) {
      issues.subjectKinds = [...(issues.subjectKinds ?? []), 'Subject kinds cannot be empty.'];
    }
    this.throwIfInvalid('Workflow event type is invalid.', issues);
    await this.repository.registerEventType(definition);
  }

  async saveDefinition(definition: WorkflowDefinition): Promise<void> {
    const issues: Record<string, string[]> = {};
    if (!definition.workflowId.trim()) issues.workflowId = ['A workflow identifier is required.'];
    if (!Number.isInteger(definition.version) || definition.version < 1) {
      issues.version = ['Workflow version must be a positive integer.'];
    }
    if (definition.triggerEventTypes.length === 0) issues.triggerEventTypes = ['At least one trigger event type is required.'];
    if (new Set(definition.triggerEventTypes).size !== definition.triggerEventTypes.length) {
      issues.triggerEventTypes = [...(issues.triggerEventTypes ?? []), 'Trigger event types must be unique.'];
    }
    if (definition.steps.length === 0) issues.steps = ['At least one workflow step is required.'];
    const stepIds = definition.steps.map((step) => step.stepId);
    if (new Set(stepIds).size !== stepIds.length) issues.steps = [...(issues.steps ?? []), 'Step identifiers must be unique.'];
    if (definition.steps.some((step) => !step.stepId.trim() || !step.actionType.trim())) {
      issues.steps = [...(issues.steps ?? []), 'Every step requires an identifier and action type.'];
    }
    if (definition.conditions.some((condition) => !condition.path.trim())) {
      issues.conditions = ['Condition paths cannot be empty.'];
    }
    this.throwIfInvalid('Workflow definition is invalid.', issues);

    const unregisteredTriggers: string[] = [];
    for (const eventType of definition.triggerEventTypes) {
      if (!await this.repository.findEventType(eventType)) unregisteredTriggers.push(eventType);
    }
    if (unregisteredTriggers.length > 0) {
      throw new ValidationError('Workflow definition references unregistered event types.', {
        triggerEventTypes: unregisteredTriggers.map((eventType) => `The event type '${eventType}' is not registered.`),
      });
    }
    await this.repository.saveDefinition(definition);
  }

  private throwIfInvalid(message: string, issues: Record<string, string[]>): void {
    if (Object.keys(issues).length > 0) throw new ValidationError(message, issues);
  }
}
