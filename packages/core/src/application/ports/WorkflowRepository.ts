/** Declares durable workflow catalogues and idempotent execution persistence. */
import type {
  EventTypeDefinition,
  WorkflowDefinition,
  WorkflowEvent,
  WorkflowExecutionPlan,
  WorkflowExecutionStep,
} from '../../domain/events/WorkflowEvent.js';

/** A storage-neutral snapshot used for worker health and backlog monitoring. */
export interface WorkflowOperationalStats {
  pendingCount: number;
  leasedCount: number;
  retryingCount: number;
  oldestPendingAgeSeconds: number;
  maxAttempts: number;
}

export interface WorkflowRepository {
  registerEventType(definition: EventTypeDefinition): Promise<void>;
  findEventType(eventType: string): Promise<EventTypeDefinition | null>;
  listEventTypes(): Promise<EventTypeDefinition[]>;
  saveDefinition(definition: WorkflowDefinition): Promise<boolean>;
  findDefinition(workflowId: string, version: number): Promise<WorkflowDefinition | null>;
  listDefinitions(): Promise<WorkflowDefinition[]>;
  listActiveDefinitions(eventType: string): Promise<WorkflowDefinition[]>;
  recordEvent(event: WorkflowEvent): Promise<boolean>;
  recordPlan(plan: WorkflowExecutionPlan): Promise<boolean>;
  claimPendingSteps(workerId: string, limit: number): Promise<WorkflowExecutionStep[]>;
  markStepCompleted(executionKey: string, workerId: string): Promise<void>;
  markStepFailed(executionKey: string, workerId: string, error: string): Promise<void>;
  getOperationalStats(): Promise<WorkflowOperationalStats>;
}
