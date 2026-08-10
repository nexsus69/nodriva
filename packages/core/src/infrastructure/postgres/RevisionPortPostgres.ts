import { RevisionPort } from '../../application/ports/RevisionPort.js';
import { Node } from '../../domain/models/Node.js';
import { Entity } from '../../domain/models/Entity.js';
import { PgExecutor } from './PgExecutor.js';
import { FieldEncryptionService } from './FieldEncryptionService.js';

/**
 * Adapter PostgreSQL per la gestione delle revisioni storiche.
 * Salva gli snapshot serializzati dei modelli in `node_revisions` ed `entity_revisions`.
 */
export class RevisionPortPostgres implements RevisionPort {
  constructor(private readonly executor: PgExecutor, private readonly fieldEncryption?: FieldEncryptionService) {}

  async recordNodeRevision(
    node: Node,
    eventType: 'created' | 'updated' | 'moved' | 'soft_deleted' | 'restored' | 'schema_changed',
    actorUserId: string | null
  ): Promise<void> {
    const query = `
      INSERT INTO node_revisions (
        node_id,
        revision_number,
        event_type,
        node_row_version,
        schema_version,
        snapshot_payload,
        created_by
      ) VALUES ($1, $2, $3::revision_event_type_enum, $4, $5, $6, $7)
    `;

    const snapshot = {
      parentId: node.parentId,
      path: node.path,
      pathLabel: node.pathLabel,
      depth: node.depth,
      nodeTypeId: node.nodeTypeId,
      name: node.name,
      description: node.description,
    };

    await this.executor.query(query, [
      node.id,
      node.rowVersion,
      eventType,
      node.rowVersion,
      1, // Schema version fissa per i nodi
      JSON.stringify(snapshot),
      actorUserId,
    ]);
  }

  async recordEntityRevision(
    entity: Entity,
    eventType: 'created' | 'updated' | 'moved' | 'soft_deleted' | 'restored' | 'schema_changed',
    actorUserId: string | null
  ): Promise<void> {
    const query = `
      INSERT INTO entity_revisions (
        entity_id,
        revision_number,
        event_type,
        entity_row_version,
        schema_version,
        snapshot_payload,
        created_by
      ) VALUES (
        $1, $2, $3::revision_event_type_enum, $4,
        COALESCE((SELECT current_schema_version FROM entity_types WHERE id = $5), 1),
        $6, $7
      )
    `;

    const snapshot = {
      parentNodeId: entity.parentNodeId,
      name: entity.name,
      description: entity.description,
      payload: this.fieldEncryption
        ? await this.fieldEncryption.redact('entity', entity.entityTypeId, entity.payload)
        : entity.payload,
    };

    await this.executor.query(query, [
      entity.id,
      entity.rowVersion,
      eventType,
      entity.rowVersion,
      entity.entityTypeId, // Usato nel subselect per ottenere current_schema_version
      JSON.stringify(snapshot),
      actorUserId,
    ]);
  }
}
