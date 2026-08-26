/** Plans deterministic, idempotent workflow executions from generic domain events. */
import type { WorkflowCondition, WorkflowDefinition, WorkflowEvent, WorkflowExecutionPlan } from '../../domain/events/WorkflowEvent.js';

export class WorkflowPlanner {
  plan(event: WorkflowEvent, definition: WorkflowDefinition): WorkflowExecutionPlan | null {
    if (!definition.isActive || !definition.triggerEventTypes.includes(event.eventType)) return null;
    if (!definition.conditions.every((condition) => matches(event, condition))) return null;
    const instanceKey = `${definition.workflowId}:${definition.version}:${event.idempotencyKey}`;
    return {
      workflowId: definition.workflowId,
      workflowVersion: definition.version,
      eventId: event.eventId,
      instanceKey,
      steps: definition.steps.map((step) => ({
        ...step,
        executionKey: `${instanceKey}:${step.idempotencyKey ?? step.stepId}`,
      })),
    };
  }
}

function matches(event: WorkflowEvent, condition: WorkflowCondition): boolean {
  const value = condition.path.split('.').reduce<unknown>((current, part) => (
    current && typeof current === 'object' ? Reflect.get(current, part) : undefined
  ), event);
  if (condition.operator === 'exists') return value !== undefined && value !== null;
  if (condition.operator === 'equals') return value === condition.value;
  if (condition.operator === 'not_equals') return value !== condition.value;
  return Array.isArray(condition.value) && condition.value.includes(value);
}
