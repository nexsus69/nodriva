/** Applies the authoritative audit policy before delegating persistence to an adapter. */
import type { AuditPort } from "../ports/AuditPort.js";
import type { AuditCollectionInvalidationPort } from "../ports/AuditCollectionInvalidationPort.js";
import type { RuntimeConfigurationPort } from "../ports/RuntimeConfigurationPort.js";
import type { TransactionPort } from "../ports/TransactionPort.js";

export const AUDIT_LOCK_LIFECYCLE_SETTING = "audit.recordLockLifecycle";

export interface AuditEvent {
  readonly actionKey: string;
  readonly resourceKind: string;
  readonly resourceId: string;
}

export interface AuditActionPolicyDefinition {
  readonly actionKey: string;
  readonly classification: "required" | "configurable";
  readonly settingKey?: string;
  readonly defaultEnabled?: boolean;
}

/**
 * Catalogues only exceptions to the secure default: unknown actions and
 * governance/security evidence are always retained unless explicitly made
 * configurable here.
 */
export const AUDIT_ACTION_POLICY_CATALOG: readonly AuditActionPolicyDefinition[] = [
  {
    actionKey: "lock.acquire",
    classification: "configurable",
    settingKey: AUDIT_LOCK_LIFECYCLE_SETTING,
    defaultEnabled: true,
  },
  {
    actionKey: "lock.release",
    classification: "configurable",
    settingKey: AUDIT_LOCK_LIFECYCLE_SETTING,
    defaultEnabled: true,
  },
];

export interface AuditRecordingPolicy {
  shouldRecord(event: AuditEvent): Promise<boolean>;
}

/** Resolves configurable audit actions from the common runtime configuration service. */
export class RuntimeAuditRecordingPolicy implements AuditRecordingPolicy {
  private readonly definitions = new Map(
    AUDIT_ACTION_POLICY_CATALOG.map((definition) => [definition.actionKey, definition]),
  );

  public constructor(private readonly configuration: RuntimeConfigurationPort) {}

  public async shouldRecord(event: AuditEvent): Promise<boolean> {
    const definition = this.definitions.get(event.actionKey);
    if (!definition || definition.classification === "required") return true;
    if (!definition.settingKey) return definition.defaultEnabled ?? true;
    try {
      return await this.configuration.getSetting<boolean>(
        definition.settingKey,
        definition.defaultEnabled ?? true,
      );
    } catch {
      // Audit evidence must not disappear merely because runtime configuration
      // is temporarily unavailable; retain the action's secure default.
      return definition.defaultEnabled ?? true;
    }
  }
}

/**
 * Keeps event production explicit in each use case while centralizing the
 * policy decision before the persistence adapter is reached.
 */
export class PolicyAuditRecorder implements AuditPort {
  public constructor(
    private readonly destination: AuditPort,
    private readonly policy: AuditRecordingPolicy,
    private readonly transactions: TransactionPort,
    private readonly collectionInvalidation: AuditCollectionInvalidationPort,
  ) {}

  public async record(
    actorUserId: string | null,
    actionKey: string,
    resourceKind: string,
    resourceId: string,
    nodeId: string | null,
    beforePayload: Record<string, unknown> | null,
    afterPayload: Record<string, unknown> | null,
  ): Promise<void> {
    if (!await this.policy.shouldRecord({ actionKey, resourceKind, resourceId })) return;
    await this.transactions.runInTransaction(async () => {
      await this.destination.record(
        actorUserId,
        actionKey,
        resourceKind,
        resourceId,
        nodeId,
        beforePayload,
        afterPayload,
      );
      await this.collectionInvalidation.invalidatePersistedAudit({
        actorUserId,
        resourceKind,
        resourceId,
      });
    });
  }
}
