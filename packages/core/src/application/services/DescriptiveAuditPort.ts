import type { AuditPort } from '../ports/AuditPort.js';

/** Adds a stable human label to audit events when the event payload contains one. */
export class DescriptiveAuditPort implements AuditPort {
  constructor(private readonly delegate: AuditPort) {}

  async record(
    actorUserId: string | null,
    actionKey: string,
    resourceKind: string,
    resourceId: string,
    nodeId: string | null,
    beforePayload: Record<string, unknown> | null,
    afterPayload: Record<string, unknown> | null,
    resourceLabel?: string | null,
  ): Promise<void> {
    const label = resourceLabel ?? deriveResourceLabel(afterPayload, beforePayload);
    await this.delegate.record(actorUserId, actionKey, resourceKind, resourceId, nodeId, beforePayload, afterPayload, label);
  }
}

const LABEL_KEYS = ['name', 'displayName', 'email', 'fileName', 'typeKey', 'policyKey', 'settingKey', 'capabilityKey', 'key'] as const;

function deriveResourceLabel(
  primary: Record<string, unknown> | null,
  secondary: Record<string, unknown> | null,
): string | null {
  for (const payload of [primary, secondary]) {
    if (!payload) continue;
    for (const key of LABEL_KEYS) {
      const value = payload[key];
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
  }
  return null;
}
