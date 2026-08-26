/** Verifies stable, generic workflow event envelopes produced by application mutations. */
import { describe, expect, it } from 'vitest';
import { createUserWorkflowEvent } from './WorkflowEventFactory.js';

describe('createUserWorkflowEvent', () => {
  it('uses a deterministic identity while preserving a generic subject and user correlation', () => {
    expect(createUserWorkflowEvent({
      eventType: 'record.updated',
      subject: { kind: 'custom-asset', id: 'asset-1', typeKey: 'meter', scopeId: 'site-1' },
      actorUserId: 'user-1', actorSessionId: 'session-1', correlationId: 'session-1',
      idempotencyKey: 'record.updated:custom-asset:asset-1:3', payload: { rowVersion: 3 },
      occurredAt: new Date('2026-08-27T10:00:00.000Z'),
    })).toEqual({
      eventId: 'workflow:record.updated:record.updated:custom-asset:asset-1:3',
      eventType: 'record.updated', occurredAt: '2026-08-27T10:00:00.000Z',
      subject: { kind: 'custom-asset', id: 'asset-1', typeKey: 'meter', scopeId: 'site-1' },
      actor: { kind: 'user', id: 'user-1', sessionId: 'session-1' },
      payload: { rowVersion: 3 }, correlationId: 'session-1',
      idempotencyKey: 'record.updated:custom-asset:asset-1:3',
    });
  });
});
