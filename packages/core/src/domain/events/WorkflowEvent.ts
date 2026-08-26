/** Defines technology-neutral events and workflow definitions for every Nodriva module. */

export interface EventSubject {
  kind: string;
  id: string;
  typeKey?: string;
  scopeId?: string | null;
}

export interface WorkflowEvent {
  eventId: string;
  eventType: string;
  occurredAt: string;
  subject: EventSubject;
  actor: { kind: 'user' | 'system' | 'integration'; id: string; sessionId?: string };
  payload: Readonly<Record<string, unknown>>;
  correlationId: string;
  causationId?: string;
  idempotencyKey: string;
}

export interface EventTypeDefinition {
  eventType: string;
  subjectKinds: readonly string[];
  payloadVersion: number;
  isActive: boolean;
}

export interface WorkflowCondition {
  path: string;
  operator: 'equals' | 'not_equals' | 'exists' | 'in';
  value?: unknown;
}

export interface WorkflowStepDefinition {
  stepId: string;
  actionType: string;
  input: Readonly<Record<string, unknown>>;
  idempotencyKey?: string;
}

export interface WorkflowDefinition {
  workflowId: string;
  version: number;
  triggerEventTypes: readonly string[];
  conditions: readonly WorkflowCondition[];
  steps: readonly WorkflowStepDefinition[];
  isActive: boolean;
}

export interface WorkflowExecutionPlan {
  workflowId: string;
  workflowVersion: number;
  eventId: string;
  instanceKey: string;
  steps: readonly (WorkflowStepDefinition & { executionKey: string })[];
}

export interface WorkflowExecutionStep {
  executionKey: string;
  instanceKey: string;
  workflowId: string;
  workflowVersion: number;
  event: WorkflowEvent;
  step: WorkflowStepDefinition;
}
