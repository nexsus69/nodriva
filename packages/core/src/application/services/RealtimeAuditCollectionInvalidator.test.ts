/** Verifies durable, capability-aware Audit Log collection invalidations. */
import { describe, expect, it, vi } from "vitest";
import type { IdGeneratorPort } from "../ports/IdGeneratorPort.js";
import type { RealtimeOutboxPort } from "../ports/RealtimeOutboxPort.js";
import type { RuntimeConfigurationPort } from "../ports/RuntimeConfigurationPort.js";
import { RealtimeAuditCollectionInvalidator } from "./RealtimeAuditCollectionInvalidator.js";

function createInvalidator(realtimeEnabled: boolean) {
  const outbox = { enqueue: vi.fn().mockResolvedValue(undefined) } as unknown as RealtimeOutboxPort;
  const runtime = {
    isCapabilityEnabled: vi.fn().mockResolvedValue(realtimeEnabled),
  } as unknown as RuntimeConfigurationPort;
  const ids: IdGeneratorPort = { generate: () => "event-1" };
  return { outbox, runtime, invalidator: new RealtimeAuditCollectionInvalidator(outbox, runtime, ids, () => new Date("2026-08-30T12:00:00.000Z")) };
}

describe("RealtimeAuditCollectionInvalidator", () => {
  it("enqueues one payload-free global audit collection invalidation", async () => {
    const { outbox, invalidator } = createInvalidator(true);

    await invalidator.invalidatePersistedAudit({ actorUserId: "user-1", resourceKind: "workflow", resourceId: "step-1" });

    expect(outbox.enqueue).toHaveBeenCalledWith({
      eventId: "event-1",
      occurredAt: "2026-08-30T12:00:00.000Z",
      resourceType: "audit",
      resourceId: "workflow:step-1",
      changeType: "created",
      actorUserId: "user-1",
      scopeNodeIds: [],
      directScopeNodeIds: [],
    });
  });

  it("does not leave undeliverable outbox rows when realtime is disabled", async () => {
    const { outbox, invalidator } = createInvalidator(false);

    await invalidator.invalidatePersistedAudit({ actorUserId: null, resourceKind: "lock", resourceId: "lock-1" });

    expect(outbox.enqueue).not.toHaveBeenCalled();
  });
});
