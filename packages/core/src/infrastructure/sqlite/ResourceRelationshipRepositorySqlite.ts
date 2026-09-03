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
  suspended_at: string | null;
}

/** SQLite implementation of the canonical relationship-edge store. */
export class ResourceRelationshipRepositorySqlite implements ResourceRelationshipRepository {
  constructor(private readonly database: SqliteDatabase) {}

  async listOutgoing(sourceDomain: TypeDomain, sourceResourceId: string): Promise<ResourceRelationshipEdge[]> {
    return this.database.all<RelationshipRow>(
      `SELECT source_field_id, source_domain, source_resource_id, target_domain,
              target_resource_id, position, source_cardinality, target_is_unique, suspended_at
       FROM resource_relationships
       WHERE source_domain = ? AND source_resource_id = ?
       ORDER BY source_field_id, position, target_resource_id`,
      [sourceDomain, sourceResourceId],
    ).map(mapRelationshipRow);
  }

  async listActiveOutgoing(sourceDomain: TypeDomain, sourceResourceId: string): Promise<ResourceRelationshipEdge[]> {
    return this.database.all<RelationshipRow>(
      `SELECT source_field_id, source_domain, source_resource_id, target_domain, target_resource_id, position, source_cardinality, target_is_unique, suspended_at
       FROM resource_relationships WHERE source_domain=? AND source_resource_id=? AND suspended_at IS NULL
       ORDER BY source_field_id, position, target_resource_id`, [sourceDomain, sourceResourceId]).map(mapRelationshipRow);
  }

  async listActiveIncomingForTargets(targets: readonly ResourceRelationshipResource[]): Promise<ResourceRelationshipEdge[]> {
    if (targets.length === 0) return [];
    const orderedTargets = sortRelationshipResources(targets);
    const clauses = orderedTargets.map(() => '(target_domain=? AND target_resource_id=?)').join(' OR ');
    return this.database.all<RelationshipRow>(
      `SELECT source_field_id, source_domain, source_resource_id, target_domain, target_resource_id, position, source_cardinality, target_is_unique, suspended_at
       FROM resource_relationships WHERE suspended_at IS NULL AND (${clauses}) ORDER BY source_field_id, source_resource_id, position`,
      orderedTargets.flatMap((target) => [target.domain, target.resourceId]),
    ).map(mapRelationshipRow);
  }

  async suspendActiveOutgoingForSources(sources: readonly ResourceRelationshipResource[], deletionBatchId: string): Promise<void> { this.updateSuspension(sources, deletionBatchId, true); }
  async restoreSuspendedOutgoingForSources(sources: readonly ResourceRelationshipResource[], deletionBatchId: string): Promise<void> { this.updateSuspension(sources, deletionBatchId, false); }

  async assertTargetsActive(targetDomain: TypeDomain, targetResourceIds: readonly string[]): Promise<void> {
    const ids = sortRelationshipResourceIds(targetResourceIds); if (ids.length === 0) return;
    const table = targetDomain === 'node' ? 'nodes' : 'entities';
    const rows = this.database.all<{ id: string }>(`SELECT id FROM ${table} WHERE deleted_at IS NULL AND id IN (${ids.map(() => '?').join(',')})`, ids);
    if (rows.length !== ids.length) throw new Error('Relationship target is deleted or unavailable.');
  }
  async lockActiveTargets(targets: readonly ResourceRelationshipResource[]): Promise<void> {
    for (const domain of ['entity', 'node'] as const) await this.assertTargetsActive(domain, sortRelationshipResources(targets).filter((target) => target.domain === domain).map((target) => target.resourceId));
  }

  async listIncoming(targetDomain: TypeDomain, targetResourceId: string): Promise<ResourceRelationshipEdge[]> {
    return this.database.all<RelationshipRow>(
      `SELECT source_field_id, source_domain, source_resource_id, target_domain,
              target_resource_id, position, source_cardinality, target_is_unique, suspended_at
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

  private updateSuspension(sources: readonly ResourceRelationshipResource[], deletionBatchId: string, suspend: boolean): void {
    if (sources.length === 0) return;
    const orderedSources = sortRelationshipResources(sources);
    const clauses = orderedSources.map(() => '(source_domain=? AND source_resource_id=?)').join(' OR ');
    this.database.run(`UPDATE resource_relationships SET suspended_at=${suspend ? "strftime('%Y-%m-%dT%H:%M:%fZ','now')" : 'NULL'}, suspension_deletion_batch_id=${suspend ? '?' : 'NULL'}, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE (${clauses}) AND suspended_at IS ${suspend ? 'NULL' : 'NOT NULL'}${suspend ? '' : ' AND suspension_deletion_batch_id=?'}`,
      suspend ? [deletionBatchId, ...orderedSources.flatMap((source) => [source.domain, source.resourceId])] : [...orderedSources.flatMap((source) => [source.domain, source.resourceId]), deletionBatchId]);
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
    suspendedAt: row.suspended_at ? new Date(row.suspended_at) : null,
  };
}
