import { publishRealtimeChange } from './realtime';
import type { RealtimeChangeType, RealtimeResourceType } from '@dashboard/core';

/** Publishes administrative changes without including secrets or credentials. */
export async function publishAdministrativeChange(input: {
  resourceType: Exclude<RealtimeResourceType, 'node' | 'entity'>;
  resourceId: string;
  changeType: RealtimeChangeType;
  actorUserId: string;
  data?: unknown;
}): Promise<void> {
  await publishRealtimeChange(input);
  await publishRealtimeChange({
    resourceType: 'audit',
    resourceId: `${input.resourceType}:${input.resourceId}`,
    changeType: input.changeType,
    actorUserId: input.actorUserId,
  });
}

export async function publishAuditRealtimeChange(input: {
  resourceType: RealtimeResourceType;
  resourceId: string;
  changeType: RealtimeChangeType;
  actorUserId: string;
}): Promise<void> {
  await publishRealtimeChange({ resourceType: 'audit', resourceId: `${input.resourceType}:${input.resourceId}`, changeType: input.changeType, actorUserId: input.actorUserId });
}
