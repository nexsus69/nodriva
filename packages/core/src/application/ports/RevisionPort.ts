import type { Node } from '../../domain/models/Node.js';
import type { Entity } from '../../domain/models/Entity.js';

export interface RevisionPort {
  recordNodeRevision(
    node: Node,
    eventType: 'created' | 'updated' | 'moved' | 'soft_deleted' | 'restored' | 'schema_changed',
    actorUserId: string | null
  ): Promise<void>;
  
  recordEntityRevision(
    entity: Entity,
    eventType: 'created' | 'updated' | 'moved' | 'soft_deleted' | 'restored' | 'schema_changed',
    actorUserId: string | null
  ): Promise<void>;
}
