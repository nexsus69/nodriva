import type {
  ReplaceResourceRelationshipValues,
  ResourceRelationshipEdge,
  ResourceRelationshipRepository,
} from '../../application/ports/ResourceRelationshipRepository.js';
import type { TypeDomain } from '../../application/dto/TypeFieldDefinition.js';
import type { PgExecutor } from './PgExecutor.js';

interface RelationshipRow {
  source_field_id: string;
  source_domain: TypeDomain;
  source_resource_id: string;
  target_domain: TypeDomain;
  target_resource_id: string;
  position: number;
  source_cardinality: 'one' | 'many';
  target_is_unique: boolean;
}

/** PostgreSQL implementation of the canonical relationship-edge store. */
export class ResourceRelationshipRepositoryPostgres implements ResourceRelationshipRepository {
  constructor(private readonly executor: PgExecutor) {}

  async listOutgoing(sourceDomain: TypeDomain, sourceResourceId: string): Promise<ResourceRelationshipEdge[]> {
    const result = await this.executor.query<RelationshipRow>(
      `SELECT source_field_id, source_domain, source_resource_id, target_domain,
              target_resource_id, position, source_cardinality, target_is_unique
       FROM resource_relationships
       WHERE source_domain = $1 AND source_resource_id = $2
       ORDER BY source_field_id, position, target_resource_id`,
      [sourceDomain, sourceResourceId],
    );
    return result.rows.map(mapRelationshipRow);
  }

  async listIncoming(targetDomain: TypeDomain, targetResourceId: string): Promise<ResourceRelationshipEdge[]> {
    const result = await this.executor.query<RelationshipRow>(
      `SELECT source_field_id, source_domain, source_resource_id, target_domain,
              target_resource_id, position, source_cardinality, target_is_unique
       FROM resource_relationships
       WHERE target_domain = $1 AND target_resource_id = $2
       ORDER BY source_field_id, source_resource_id, position`,
      [targetDomain, targetResourceId],
    );
    return result.rows.map(mapRelationshipRow);
  }

  async replaceValues(values: ReplaceResourceRelationshipValues): Promise<void> {
    const targetIds = [...new Set(values.targetResourceIds)];
    if (values.sourceCardinality === 'one' && targetIds.length > 1) {
      throw new Error('A single-valued relationship cannot contain more than one target.');
    }

    await this.executor.query(
      `DELETE FROM resource_relationships
       WHERE source_field_id = $1 AND source_domain = $2 AND source_resource_id = $3`,
      [values.sourceFieldId, values.sourceDomain, values.sourceResourceId],
    );

    for (const [position, targetResourceId] of targetIds.entries()) {
      await this.executor.query(
        `INSERT INTO resource_relationships (
           source_field_id, source_domain, source_resource_id, target_domain,
           target_resource_id, position, source_cardinality, target_is_unique
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          values.sourceFieldId,
          values.sourceDomain,
          values.sourceResourceId,
          values.targetDomain,
          targetResourceId,
          position,
          values.sourceCardinality,
          values.targetIsUnique,
        ],
      );
    }
  }

  async removeForResource(domain: TypeDomain, resourceId: string): Promise<void> {
    await this.executor.query(
      `DELETE FROM resource_relationships
       WHERE (source_domain = $1 AND source_resource_id = $2)
          OR (target_domain = $1 AND target_resource_id = $2)`,
      [domain, resourceId],
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
    targetIsUnique: row.target_is_unique,
  };
}
