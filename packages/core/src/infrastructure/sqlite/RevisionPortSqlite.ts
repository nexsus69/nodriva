import type { RevisionPort } from '../../application/ports/RevisionPort.js';
import type { Node } from '../../domain/models/Node.js';
import type { Entity } from '../../domain/models/Entity.js';
import { SqliteDatabase } from './SqliteDatabase.js';

export class RevisionPortSqlite implements RevisionPort {
  constructor(private readonly database: SqliteDatabase) {}
  async recordNodeRevision(node: Node, eventType: 'created' | 'updated' | 'moved' | 'soft_deleted' | 'restored' | 'schema_changed', actorUserId: string | null): Promise<void> { const snapshot = { parentId: node.parentId, path: node.path, pathLabel: node.pathLabel, depth: node.depth, nodeTypeId: node.nodeTypeId, name: node.name, description: node.description, payload: node.payload }; this.database.run('INSERT INTO node_revisions (node_id,revision_number,event_type,node_row_version,schema_version,snapshot_payload,created_by) VALUES (?,?,?,?,?,?,?)', [node.id, node.rowVersion, eventType, node.rowVersion, 1, JSON.stringify(snapshot), actorUserId]); }
  async recordEntityRevision(entity: Entity, eventType: 'created' | 'updated' | 'moved' | 'soft_deleted' | 'restored' | 'schema_changed', actorUserId: string | null): Promise<void> { const snapshot = { parentNodeId: entity.parentNodeId, name: entity.name, description: entity.description, payload: entity.payload }; this.database.run('INSERT INTO entity_revisions (entity_id,revision_number,event_type,entity_row_version,schema_version,snapshot_payload,created_by) VALUES (?,?,?,?,?,?,?)', [entity.id, entity.rowVersion, eventType, entity.rowVersion, 1, JSON.stringify(snapshot), actorUserId]); }
}
