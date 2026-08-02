import { RealtimeDataChangedEvent } from './RealtimeEventBus.js';

/** Resolves the node scopes that must receive a realtime data event. */
export interface RealtimeScopeResolver {
  resolveScopes(event: RealtimeDataChangedEvent): Promise<string[]>;
}
