/** Declares durable workflow catalogues and idempotent execution persistence. */
import type { EventTypeDefinition, WorkflowDefinition, WorkflowEvent, WorkflowExecutionPlan } from '../../domain/events/WorkflowEvent.js';

export interface WorkflowRepository {
  registerEventType(definition: EventTypeDefinition): Promise<void>;
  findEventType(eventType: string): Promise<EventTypeDefinition | null>;
  saveDefinition(definition: WorkflowDefinition): Promise<void>;
  listActiveDefinitions(eventType: string): Promise<WorkflowDefinition[]>;
  recordEvent(event: WorkflowEvent): Promise<boolean>;
  recordPlan(plan: WorkflowExecutionPlan): Promise<boolean>;
}
