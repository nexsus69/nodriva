/** Declares durable workflow catalogues and idempotent execution persistence. */
import type {
  EventTypeDefinition,
  WorkflowDefinition,
  WorkflowEvent,
  WorkflowExecutionPlan,
  WorkflowExecutionStep,
} from '../../domain/events/WorkflowEvent.js';

export interface WorkflowRepository {
  registerEventType(definition: EventTypeDefinition): Promise<void>;
  findEventType(eventType: string): Promise<EventTypeDefinition | null>;
  saveDefinition(definition: WorkflowDefinition): Promise<void>;
  listActiveDefinitions(eventType: string): Promise<WorkflowDefinition[]>;
  recordEvent(event: WorkflowEvent): Promise<boolean>;
  recordPlan(plan: WorkflowExecutionPlan): Promise<boolean>;
  claimPendingSteps(workerId: string, limit: number): Promise<WorkflowExecutionStep[]>;
  markStepCompleted(executionKey: string, workerId: string): Promise<void>;
  markStepFailed(executionKey: string, workerId: string, error: string): Promise<void>;
}
