/** Verifies generic workflow planning without Nodriva persistence or framework dependencies. */
import { describe, expect, it } from 'vitest';
import { WorkflowPlanner } from './WorkflowPlanner.js';

const event = { eventId: 'evt-1', eventType: 'security.scope.revoked', occurredAt: '2026-01-01T00:00:00.000Z', subject: { kind: 'scope_assignment', id: 'scope-1' }, actor: { kind: 'system' as const, id: 'system' }, payload: { reason: 'delegator_disabled' }, correlationId: 'corr-1', idempotencyKey: 'event-1' };

describe('WorkflowPlanner', () => {
  it('plans generic subjects deterministically and rejects unmatched conditions', () => {
    const planner = new WorkflowPlanner();
    const definition = { workflowId: 'revoke-notification', version: 2, isActive: true, triggerEventTypes: ['security.scope.revoked'], conditions: [{ path: 'payload.reason', operator: 'equals' as const, value: 'delegator_disabled' }], steps: [{ stepId: 'notify', actionType: 'notification.send', input: { template: 'scope-revoked' } }] };
    expect(planner.plan(event, definition)).toMatchObject({ instanceKey: 'revoke-notification:2:event-1', steps: [{ executionKey: 'revoke-notification:2:event-1:notify' }] });
    expect(planner.plan({ ...event, payload: { reason: 'manual' } }, definition)).toBeNull();
  });

  it('names every durable step beneath its workflow instance even with a custom idempotency suffix', () => {
    const planner = new WorkflowPlanner();
    const definition = {
      workflowId: 'custom-step-key', version: 1, isActive: true, triggerEventTypes: [event.eventType], conditions: [],
      steps: [{ stepId: 'notify', actionType: 'notification.send', input: {}, idempotencyKey: 'outbound-notification' }],
    };
    expect(planner.plan(event, definition)?.steps[0]?.executionKey)
      .toBe('custom-step-key:1:event-1:outbound-notification');
  });
});
