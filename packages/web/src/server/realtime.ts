import { randomUUID } from 'crypto';
import type { RealtimeDataChangedEvent } from '@dashboard/core';

export type RealtimeChangeInput = Omit<RealtimeDataChangedEvent, 'eventId' | 'occurredAt'>;
const workerId = `${process.env.HOSTNAME ?? 'web'}:${process.pid}:${randomUUID()}`;

export async function buildRealtimeEvent(
  input: RealtimeChangeInput,
  resolveScopes?: (event: RealtimeDataChangedEvent) => Promise<string[]>,
): Promise<RealtimeDataChangedEvent> {
  const event: RealtimeDataChangedEvent = {
    ...input,
    eventId: randomUUID(),
    occurredAt: new Date().toISOString(),
    directScopeNodeIds: input.metadataKind ? [] : [
      ...(input.resourceType === 'node' ? [input.resourceId] : []),
      ...(input.parentNodeId ? [input.parentNodeId] : []),
      ...(input.previousParentNodeId ? [input.previousParentNodeId] : []),
    ],
  };
  const payloadVersion = typeof input.data === 'object' && input.data !== null && 'rowVersion' in input.data
    ? (input.data as { rowVersion?: unknown }).rowVersion
    : undefined;
  if (typeof payloadVersion === 'number') event.resourceVersion = payloadVersion;

  // Metadata events identify a type by its stable typeKey, not by the UUID of
  // a node/entity instance. They are routed only to global policy channels,
  // so resolving resource scopes here would both be unnecessary and unsafe:
  // the scope resolver expects resource UUIDs and would abort the outbox
  // transaction before the channel router can handle metadataKind.
  if (input.metadataKind) {
    event.scopeNodeIds = [];
    return event;
  }

  // Administrative and audit resources are global. They do not belong to a
  // node subtree, so resolving hierarchy scopes only creates a false warning.
  if (input.resourceType !== 'node' && input.resourceType !== 'entity') {
    event.scopeNodeIds = [];
    return event;
  }

  const scopeResolver = resolveScopes ?? (async (scopedEvent: RealtimeDataChangedEvent) => {
    const { realtimeScopeResolver } = await import('./db');
    return realtimeScopeResolver.resolveScopes(scopedEvent);
  });

  try {
    event.scopeNodeIds = await scopeResolver(event);
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
  const { realtimeOutbox, pusherEventBus, isRealtimeCapabilityEnabled } = await import('./db');
  if (!(await isRealtimeCapabilityEnabled())) return 0;
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
  const { transactionPort, realtimeOutbox, isRealtimeCapabilityEnabled } = await import('./db');
  if (!(await isRealtimeCapabilityEnabled())) return work();
  const result = await transactionPort.runInTransaction(async () => {
    const value = await work();
    const input = toEvent(value);
    if (input) await realtimeOutbox.enqueue(await buildRealtimeEvent(input));
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
