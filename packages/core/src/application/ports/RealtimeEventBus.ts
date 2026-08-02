export type RealtimeResourceType = 'node' | 'entity';
export type RealtimeChangeType = 'created' | 'updated' | 'deleted' | 'moved';

export interface RealtimeDataChangedEvent {
  eventId: string;
  occurredAt: string;
  resourceType: RealtimeResourceType;
  resourceId: string;
  changeType: RealtimeChangeType;
  actorUserId: string;
  /** Node scopes that should receive this event. Resolved by the composition root. */
  scopeNodeIds?: string[];
  parentNodeId?: string | null;
  previousParentNodeId?: string | null;
  entityTypeId?: string;
  data?: unknown;
}

export interface RealtimeEventBus {
  publishDataChanged(event: RealtimeDataChangedEvent): Promise<void>;
}
