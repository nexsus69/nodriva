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

export interface RealtimeDataChangedEvent extends Omit<ResourceReference, 'resourceType'> {
  resourceType: RealtimeResourceType;
  eventId: string;
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
}

export interface RealtimeEventBus {
  publishDataChanged(event: RealtimeDataChangedEvent): Promise<void>;
}
