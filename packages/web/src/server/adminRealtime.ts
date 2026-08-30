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
}
