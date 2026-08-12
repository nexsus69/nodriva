import type { RealtimeScopeResolver } from '../../application/ports/RealtimeScopeResolver.js';
import type { RealtimeDataChangedEvent } from '../../application/ports/RealtimeEventBus.js';
import type { NodeRepository } from '../../application/ports/NodeRepository.js';

/** Hierarchy-agnostic resolver; SQLite and PostgreSQL use the same port contract. */
export class RealtimeScopeResolverSqlite implements RealtimeScopeResolver {
  constructor(private readonly nodes: NodeRepository) {}
  async resolveScopes(event: RealtimeDataChangedEvent): Promise<string[]> {
    const candidates = new Set<string>(); const current=event.resourceType==='node'?event.resourceId:event.parentNodeId;
    if(current)candidates.add(current);if(event.previousParentNodeId)candidates.add(event.previousParentNodeId);if(!candidates.size)throw new Error(`Cannot resolve realtime scopes for event ${event.eventId}`);
    const result=new Set<string>();for(const id of candidates){const ancestors=await this.nodes.listAncestorIds(id);(ancestors.length?ancestors:[id]).forEach((x)=>result.add(x));}return [...result];
  }
}
