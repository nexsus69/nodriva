import { randomUUID } from 'crypto';
import type { RealtimeDataChangedEvent } from '@dashboard/core';

export type RealtimeChangeInput = Omit<RealtimeDataChangedEvent, 'eventId' | 'occurredAt'>;
const workerId = `${process.env.HOSTNAME ?? 'web'}:${process.pid}:${randomUUID()}`;

async function buildEvent(input: RealtimeChangeInput): Promise<RealtimeDataChangedEvent> {
  const { realtimeScopeResolver } = await import('./db');
  const event: RealtimeDataChangedEvent = {
    ...input,
    eventId: randomUUID(),
    occurredAt: new Date().toISOString(),
    directScopeNodeIds: [
      ...(input.resourceType === 'node' ? [input.resourceId] : []),
      ...(input.parentNodeId ? [input.parentNodeId] : []),
      ...(input.previousParentNodeId ? [input.previousParentNodeId] : []),
    ],
  };
  try {
    event.scopeNodeIds = await realtimeScopeResolver.resolveScopes(event);
  } catch (error) {
    // Under-publishing is safer than broadening a scope. The durable outbox
    // retains the direct scope event for observability and a later replay.
    console.error('[Realtime] Failed to resolve event scopes; using direct scope:', error);
    const fallback = event.resourceType === 'node' ? event.resourceId : event.parentNodeId;
    event.scopeNodeIds = fallback ? [fallback] : [];
  }
  return event;
}

/** Drains a bounded batch. It is safe to call concurrently from requests and
 * from the protected worker endpoint because rows are leased in PostgreSQL. */
export async function drainRealtimeOutbox(limit = 25): Promise<number> {
  if (process.env.REALTIME_ENABLED === 'false') return 0;
  const { realtimeOutbox, pusherEventBus } = await import('./db');
  const pending = await realtimeOutbox.claimPending(workerId, limit);
  for (const event of pending) {
    try {
      await pusherEventBus.publishDataChanged(event);
      await realtimeOutbox.markPublished(event.eventId, workerId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await realtimeOutbox.markFailed(event.eventId, workerId, message);
      console.error('[Realtime] Outbox delivery failed', { eventId: event.eventId, message });
    }
  }
  return pending.length;
}

/** Runs the mutation and inserts its event in the same outer DB transaction.
 * Side-effect delivery happens only after commit and cannot roll back data. */
export async function runWithRealtimeOutbox<T>(
  work: () => Promise<T>,
  toEvent: (result: T) => RealtimeChangeInput | null,
): Promise<T> {
  if (process.env.REALTIME_ENABLED === 'false') return work();
  const { transactionPort, realtimeOutbox } = await import('./db');
  const result = await transactionPort.runInTransaction(async () => {
    const value = await work();
    const input = toEvent(value);
    if (input) await realtimeOutbox.enqueue(await buildEvent(input));
    return value;
  });
  // Best effort only; the durable outbox will be drained by the next request
  // or the protected worker when Pusher is unavailable.
  void drainRealtimeOutbox().catch((error) => console.error('[Realtime] Outbox drain failed:', error));
  return result;
}

/** Compatibility entry point for non-transactional legacy callers. */
export async function publishRealtimeChange(input: RealtimeChangeInput): Promise<void> {
  await runWithRealtimeOutbox(async () => undefined, () => input);
}
