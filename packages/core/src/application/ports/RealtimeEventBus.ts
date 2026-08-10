import type { ResourceKind } from '../../domain/models/ResourceReference.js';
import type { ResourceReference } from '../../domain/models/ResourceReference.js';

export type RealtimeResourceType = ResourceKind;
export type RealtimeChangeType = 'created' | 'updated' | 'deleted' | 'moved';

export interface RealtimeDataChangedEvent extends ResourceReference {
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
}

export interface RealtimeEventBus {
  publishDataChanged(event: RealtimeDataChangedEvent): Promise<void>;
}
