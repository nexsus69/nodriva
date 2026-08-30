/** Defines the application port for recording immutable audit evidence. */
export interface AuditPort {
  record(
    actorUserId: string | null,
    actionKey: string,
    resourceKind: string,
    resourceId: string,
    nodeId: string | null,
    beforePayload: Record<string, unknown> | null,
    afterPayload: Record<string, unknown> | null,
    resourceLabel?: string | null
  ): Promise<void>;
}
