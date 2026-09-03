import {
  sortRelationshipResourceIds,
  sortRelationshipResources,
} from '../../application/ports/ResourceRelationshipRepository.js';
import type {
  ReplaceResourceRelationshipValues,
  ResourceRelationshipEdge,
  ResourceRelationshipRepository,
  ResourceRelationshipResource,
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
  suspended_at: Date | null;
}

/** PostgreSQL implementation of the canonical relationship-edge store. */
export class ResourceRelationshipRepositoryPostgres implements ResourceRelationshipRepository {
  constructor(private readonly executor: PgExecutor) {}

  async listOutgoing(sourceDomain: TypeDomain, sourceResourceId: string): Promise<ResourceRelationshipEdge[]> {
    const result = await this.executor.query<RelationshipRow>(
      `SELECT source_field_id, source_domain, source_resource_id, target_domain,
              target_resource_id, position, source_cardinality, target_is_unique, suspended_at
       FROM resource_relationships
       WHERE source_domain = $1 AND source_resource_id = $2
       ORDER BY source_field_id, position, target_resource_id`,
      [sourceDomain, sourceResourceId],
    );
    return result.rows.map(mapRelationshipRow);
  }

  async listActiveOutgoing(sourceDomain: TypeDomain, sourceResourceId: string): Promise<ResourceRelationshipEdge[]> {
    const result = await this.executor.query<RelationshipRow>(
      `SELECT source_field_id, source_domain, source_resource_id, target_domain,
              target_resource_id, position, source_cardinality, target_is_unique, suspended_at
       FROM resource_relationships WHERE source_domain=$1 AND source_resource_id=$2 AND suspended_at IS NULL
       ORDER BY source_field_id, position, target_resource_id`, [sourceDomain, sourceResourceId]);
    return result.rows.map(mapRelationshipRow);
  }

  async listActiveIncomingForTargets(targets: readonly ResourceRelationshipResource[]): Promise<ResourceRelationshipEdge[]> {
    if (targets.length === 0) return [];
    const orderedTargets = sortRelationshipResources(targets);
    const domains = orderedTargets.map((target) => target.domain);
    const ids = orderedTargets.map((target) => target.resourceId);
    const result = await this.executor.query<RelationshipRow>(
      `SELECT source_field_id, source_domain, source_resource_id, target_domain, target_resource_id, position, source_cardinality, target_is_unique, suspended_at
       FROM resource_relationships r WHERE r.suspended_at IS NULL
       AND EXISTS (SELECT 1 FROM unnest($1::varchar[], $2::uuid[]) AS target(domain, id)
                   WHERE r.target_domain=target.domain AND r.target_resource_id=target.id)
       ORDER BY source_field_id, source_resource_id, position`, [domains, ids]);
    return result.rows.map(mapRelationshipRow);
  }

  async suspendActiveOutgoingForSources(sources: readonly ResourceRelationshipResource[], deletionBatchId: string): Promise<void> {
    await this.updateSuspension(sources, deletionBatchId, true);
  }

  async restoreSuspendedOutgoingForSources(sources: readonly ResourceRelationshipResource[], deletionBatchId: string): Promise<void> {
    await this.updateSuspension(sources, deletionBatchId, false);
  }

  async assertTargetsActive(targetDomain: TypeDomain, targetResourceIds: readonly string[]): Promise<void> {
    if (targetResourceIds.length === 0) return;
    const table = targetDomain === 'node' ? 'nodes' : 'entities';
    const ids = sortRelationshipResourceIds(targetResourceIds);
    const result = await this.executor.query<{ id: string }>(`SELECT id FROM ${table} WHERE id = ANY($1::uuid[]) AND deleted_at IS NULL ORDER BY id FOR KEY SHARE`, [ids]);
    if (result.rows.length !== ids.length) throw new Error('Relationship target is deleted or unavailable.');
  }

  async lockActiveTargets(targets: readonly ResourceRelationshipResource[]): Promise<void> {
    const ordered = sortRelationshipResources(targets);
    const nodes = ordered.filter((target) => target.domain === 'node').map((target) => target.resourceId);
    const entities = ordered.filter((target) => target.domain === 'entity').map((target) => target.resourceId);
    if (entities.length) await this.executor.query('SELECT id FROM entities WHERE id=ANY($1::uuid[]) AND deleted_at IS NULL ORDER BY id FOR UPDATE', [entities]);
    if (nodes.length) await this.executor.query('SELECT id FROM nodes WHERE id=ANY($1::uuid[]) AND deleted_at IS NULL ORDER BY id FOR UPDATE', [nodes]);
  }

  async listIncoming(targetDomain: TypeDomain, targetResourceId: string): Promise<ResourceRelationshipEdge[]> {
    const result = await this.executor.query<RelationshipRow>(
      `SELECT source_field_id, source_domain, source_resource_id, target_domain,
              target_resource_id, position, source_cardinality, target_is_unique, suspended_at
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

  private async updateSuspension(sources: readonly ResourceRelationshipResource[], deletionBatchId: string, suspend: boolean): Promise<void> {
    if (sources.length === 0) return;
    const orderedSources = sortRelationshipResources(sources);
    await this.executor.query(
      `UPDATE resource_relationships r SET suspended_at = ${suspend ? 'now()' : 'NULL'}, suspension_deletion_batch_id = ${suspend ? '$3' : 'NULL'}, updated_at=now()
       WHERE EXISTS (SELECT 1 FROM unnest($1::varchar[], $2::uuid[]) AS source(domain, id)
                     WHERE r.source_domain=source.domain AND r.source_resource_id=source.id)
         AND suspended_at IS ${suspend ? 'NULL' : 'NOT NULL'}
         AND ${suspend ? 'TRUE' : 'suspension_deletion_batch_id = $3'}`,
      [orderedSources.map((source) => source.domain), orderedSources.map((source) => source.resourceId), deletionBatchId],
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
    suspendedAt: row.suspended_at,
  };
}
