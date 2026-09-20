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
  /** Human-readable immutable title; definitions published before this field remain supported. */
  name?: string;
  /** Optional immutable context for administrators. */
  description?: string;
  version: number;
  triggerEventTypes: readonly string[];
  conditions: readonly WorkflowCondition[];
  steps: readonly WorkflowStepDefinition[];
  isActive: boolean;
}

/** Bounded, authorized query contract for the administrative workflow catalogue. */
export interface WorkflowDefinitionListPageParams {
  page: number;
  pageSize: number;
  search?: string;
  sort?: { key: 'workflowId' | 'name' | 'version' | 'status'; direction: 'ascending' | 'descending' };
}

export interface WorkflowDefinitionListPageDto {
  items: WorkflowDefinition[];
  total: number;
  page: number;
  pageCount: number;
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
