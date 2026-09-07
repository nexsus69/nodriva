/** Verifies that realtime envelopes preserve mutation correlation metadata. */
import { describe, expect, it } from 'vitest';
import { buildRealtimeEvent } from './realtime';

describe('realtime mutation correlation', () => {
  it('keeps mutation and originating session identifiers in the event envelope', async () => {
    const event = await buildRealtimeEvent({
      resourceType: 'entity',
      resourceId: 'entity-1',
      changeType: 'updated',
      actorUserId: 'user-1',
      originSessionId: 'session-1',
      mutationId: 'mutation-1',
      parentNodeId: 'node-1',
      entityTypeId: 'task',
      data: { id: 'entity-1', rowVersion: 4 },
    }, async () => ['node-1']);

    expect(event).toMatchObject({
      mutationId: 'mutation-1',
      originSessionId: 'session-1',
      resourceVersion: 4,
      scopeNodeIds: ['node-1'],
    });
    expect(event.eventId).toEqual(expect.any(String));
  });
});
