/** Creates durable, global Audit Log collection invalidations. */
import type { AuditCollectionInvalidation, AuditCollectionInvalidationPort } from "../ports/AuditCollectionInvalidationPort.js";
import type { IdGeneratorPort } from "../ports/IdGeneratorPort.js";
import type { RealtimeOutboxPort } from "../ports/RealtimeOutboxPort.js";
import type { RuntimeConfigurationPort } from "../ports/RuntimeConfigurationPort.js";

export const REALTIME_CAPABILITY_KEY = "realtime";

/**
 * Converts a persisted audit fact into an outbox event. The event carries no
 * audit payload because subscribers only need to invalidate their list.
 */
export class RealtimeAuditCollectionInvalidator implements AuditCollectionInvalidationPort {
  public constructor(
    private readonly outbox: RealtimeOutboxPort,
    private readonly runtimeConfiguration: RuntimeConfigurationPort,
    private readonly ids: IdGeneratorPort,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public async invalidatePersistedAudit(event: AuditCollectionInvalidation): Promise<void> {
    if (!await this.runtimeConfiguration.isCapabilityEnabled(REALTIME_CAPABILITY_KEY)) return;
    await this.outbox.enqueue({
      eventId: this.ids.generate(),
      occurredAt: this.now().toISOString(),
      resourceType: "audit",
      resourceId: `${event.resourceKind}:${event.resourceId}`,
      changeType: "created",
      // System-originated audit evidence remains globally routable without
      // inventing a user identity in the audit record itself.
      actorUserId: event.actorUserId ?? "system",
      scopeNodeIds: [],
      directScopeNodeIds: [],
    });
  }
}
