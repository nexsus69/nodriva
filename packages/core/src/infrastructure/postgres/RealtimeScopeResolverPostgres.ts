import type { RealtimeScopeResolver } from '../../application/ports/RealtimeScopeResolver.js';
import type { RealtimeDataChangedEvent } from '../../application/ports/RealtimeEventBus.js';
import type { NodeRepository } from '../../application/ports/NodeRepository.js';

/** PostgreSQL-backed scope resolver; hierarchy mechanics remain behind ports. */
export class RealtimeScopeResolverPostgres implements RealtimeScopeResolver {
  constructor(private readonly nodeRepository: NodeRepository) {}

  async resolveScopes(event: RealtimeDataChangedEvent): Promise<string[]> {
    const candidates = new Set<string>();
    const currentScope = event.resourceType === 'node' ? event.resourceId : event.parentNodeId;
    if (currentScope) candidates.add(currentScope);
    if (event.previousParentNodeId) candidates.add(event.previousParentNodeId);

    if (candidates.size === 0) {
      throw new Error(`Cannot resolve realtime scopes for event ${event.eventId}: missing node scope`);
    }

    const resolved = new Set<string>();
    let ancestorsByNode = new Map<string, string[]>();
    try {
      ancestorsByNode = this.nodeRepository.listAncestorIdsForNodes
        ? await this.nodeRepository.listAncestorIdsForNodes([...candidates])
        : new Map(await Promise.all([...candidates].map(async (nodeId) => [
            nodeId,
            await this.nodeRepository.listAncestorIds(nodeId),
          ] as const)));
    } catch (error) {
      console.error('[RealtimeScopeResolver] Failed to resolve ancestor batch; using direct scopes:', error);
    }

    for (const nodeId of candidates) {
      try {
        const ancestors = ancestorsByNode.get(nodeId) ?? [];
        if (ancestors.length === 0) {
          console.error(`[RealtimeScopeResolver] No active ancestors found for ${nodeId}; using fallback scope`);
          resolved.add(nodeId);
          continue;
        }
        ancestors.forEach((ancestorId) => resolved.add(ancestorId));
      } catch (error) {
        console.error(
          `[RealtimeScopeResolver] Failed to resolve ancestors for ${nodeId}; using fallback scope:`,
          error
        );
        resolved.add(nodeId);
      }
    }

    if (resolved.size === 0) {
      throw new Error(`Cannot resolve realtime scopes for event ${event.eventId}`);
    }
    return Array.from(resolved);
  }
}
