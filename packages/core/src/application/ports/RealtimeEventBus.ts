import type { ResourceReference } from '../../domain/models/ResourceReference.js';

/** Resources that can produce a data event. Lockable resources remain limited
 * to node/entity and continue to use ResourceKind. */
export type RealtimeResourceType =
  | 'node'
  | 'entity'
  | 'node_type'
  | 'entity_type'
  | 'user'
  | 'role'
  | 'scope'
  | 'audit'
  | 'system'
  | 'placement_policy';
export type RealtimeChangeType = 'created' | 'updated' | 'deleted' | 'moved' | 'restored';

/**
 * Position assigned by the delivery coordinator for one authorized channel.
 * It is deliberately optional: the transactional outbox stores domain events
 * before their concrete realtime destinations are resolved.
 */
export interface RealtimeChannelStreamPosition {
  channelId: string;
  epoch: string;
  cursor: number;
  previousCursor: number;
  previousEventId: string | null;
}

export interface RealtimeDataChangedEvent extends Omit<ResourceReference, 'resourceType'> {
  resourceType: RealtimeResourceType;
  eventId: string;
  /** Correlates the event with the client/server mutation that produced it. */
  mutationId?: string;
  /** Authenticated session that originated the mutation; never used as an ACL grant. */
  originSessionId?: string;
  occurredAt: string;
  changeType: RealtimeChangeType;
  actorUserId: string;
  /** Node scopes that should receive this event. Resolved by the composition root. */
  scopeNodeIds?: string[];
  /** Direct resource containers, used to evaluate `self` policies during moves. */
  directScopeNodeIds?: string[];
  parentNodeId?: string | null;
  previousParentNodeId?: string | null;
  entityTypeId?: string;
  data?: unknown;
  /** All resources changed by an aggregate mutation, including the root resourceId. */
  affectedResourceIds?: string[];
  /** Metadata invalidation event; the payload is intentionally empty. */
  metadataKind?: 'node' | 'entity';
  /** Monotonic sequence shared by metadata events for gap detection. */
  metadataSequence?: number;
  /** Row version of a concrete resource when the event carries a snapshot. */
  resourceVersion?: number;
  /** A resource-owned projection changed without changing the resource row. */
  subresourceKind?: 'attachment';
  /** Delivery metadata for the one policy channel that receives this copy. */
  stream?: RealtimeChannelStreamPosition;
}

export interface RealtimeEventBus {
  publishDataChanged(event: RealtimeDataChangedEvent): Promise<void>;
}
