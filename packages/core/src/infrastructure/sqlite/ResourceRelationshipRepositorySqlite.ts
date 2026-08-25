import type {
  ReplaceResourceRelationshipValues,
  ResourceRelationshipEdge,
  ResourceRelationshipRepository,
} from '../../application/ports/ResourceRelationshipRepository.js';
import type { TypeDomain } from '../../application/dto/TypeFieldDefinition.js';
import type { SqliteDatabase } from './SqliteDatabase.js';

interface RelationshipRow {
  source_field_id: string;
  source_domain: TypeDomain;
  source_resource_id: string;
  target_domain: TypeDomain;
  target_resource_id: string;
  position: number;
  source_cardinality: 'one' | 'many';
  target_is_unique: number;
}

/** SQLite implementation of the canonical relationship-edge store. */
export class ResourceRelationshipRepositorySqlite implements ResourceRelationshipRepository {
  constructor(private readonly database: SqliteDatabase) {}

  async listOutgoing(sourceDomain: TypeDomain, sourceResourceId: string): Promise<ResourceRelationshipEdge[]> {
    return this.database.all<RelationshipRow>(
      `SELECT source_field_id, source_domain, source_resource_id, target_domain,
              target_resource_id, position, source_cardinality, target_is_unique
       FROM resource_relationships
       WHERE source_domain = ? AND source_resource_id = ?
       ORDER BY source_field_id, position, target_resource_id`,
      [sourceDomain, sourceResourceId],
    ).map(mapRelationshipRow);
  }

  async listIncoming(targetDomain: TypeDomain, targetResourceId: string): Promise<ResourceRelationshipEdge[]> {
    return this.database.all<RelationshipRow>(
      `SELECT source_field_id, source_domain, source_resource_id, target_domain,
              target_resource_id, position, source_cardinality, target_is_unique
       FROM resource_relationships
       WHERE target_domain = ? AND target_resource_id = ?
       ORDER BY source_field_id, source_resource_id, position`,
      [targetDomain, targetResourceId],
    ).map(mapRelationshipRow);
  }

  async replaceValues(values: ReplaceResourceRelationshipValues): Promise<void> {
    const targetIds = [...new Set(values.targetResourceIds)];
    if (values.sourceCardinality === 'one' && targetIds.length > 1) {
      throw new Error('A single-valued relationship cannot contain more than one target.');
    }

    this.database.run(
      `DELETE FROM resource_relationships
       WHERE source_field_id = ? AND source_domain = ? AND source_resource_id = ?`,
      [values.sourceFieldId, values.sourceDomain, values.sourceResourceId],
    );

    for (const [position, targetResourceId] of targetIds.entries()) {
      this.database.run(
        `INSERT INTO resource_relationships (
           source_field_id, source_domain, source_resource_id, target_domain,
           target_resource_id, position, source_cardinality, target_is_unique
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          values.sourceFieldId,
          values.sourceDomain,
          values.sourceResourceId,
          values.targetDomain,
          targetResourceId,
          position,
          values.sourceCardinality,
          values.targetIsUnique ? 1 : 0,
        ],
      );
    }
  }

  async removeForResource(domain: TypeDomain, resourceId: string): Promise<void> {
    this.database.run(
      `DELETE FROM resource_relationships
       WHERE (source_domain = ? AND source_resource_id = ?)
          OR (target_domain = ? AND target_resource_id = ?)`,
      [domain, resourceId, domain, resourceId],
    );
  }
}

function mapRelationshipRow(row: RelationshipRow): ResourceRelationshipEdge {
  return {
    sourceFieldId: row.source_field_id,
    sourceDomain: row.source_domain,
    sourceResourceId: row.source_resource_id,
    targetDomain: row.target_domain,
    targetResourceId: row.target_resource_id,
    position: Number(row.position),
    sourceCardinality: row.source_cardinality,
    targetIsUnique: row.target_is_unique === 1,
  };
}
