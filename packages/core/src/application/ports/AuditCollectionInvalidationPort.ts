/** Announces that a persisted audit record changed the administrative audit collection. */
export interface AuditCollectionInvalidation {
  readonly actorUserId: string | null;
  readonly resourceKind: string;
  readonly resourceId: string;
}

/**
 * Application boundary between audit persistence policy and its read-model
 * invalidation. Implementations must enqueue durably, never publish directly.
 */
export interface AuditCollectionInvalidationPort {
  invalidatePersistedAudit(event: AuditCollectionInvalidation): Promise<void>;
}
