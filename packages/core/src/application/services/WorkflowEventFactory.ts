/** Builds stable workflow event envelopes without coupling producers to a subject domain. */
import type { EventSubject, WorkflowEvent } from '../../domain/events/WorkflowEvent.js';

export interface UserWorkflowEventInput {
  eventType: string;
  subject: EventSubject;
  actorUserId: string;
  actorSessionId?: string;
  correlationId: string;
  idempotencyKey: string;
  payload: Readonly<Record<string, unknown>>;
  occurredAt?: Date;
}

/** Uses the idempotency key as a deterministic event identity across a retried mutation. */
export function createUserWorkflowEvent(input: UserWorkflowEventInput): WorkflowEvent {
  return {
    eventId: `workflow:${input.eventType}:${input.idempotencyKey}`,
    eventType: input.eventType,
    occurredAt: (input.occurredAt ?? new Date()).toISOString(),
    subject: input.subject,
    actor: {
      kind: 'user',
      id: input.actorUserId,
      ...(input.actorSessionId ? { sessionId: input.actorSessionId } : {}),
    },
    payload: input.payload,
    correlationId: input.correlationId,
    idempotencyKey: input.idempotencyKey,
  };
}
