import type {
  IncomingResourceRelationshipDefinition,
  ResourceRelationshipDefinitionReader,
} from '../../application/ports/ResourceRelationshipDefinitionReader.js';
import type { TypeDomain } from '../../application/dto/TypeFieldDefinition.js';
import type { PgExecutor } from './PgExecutor.js';

interface IncomingDefinitionRow {
  source_domain: TypeDomain;
  source_type_key: string;
  source_type_name: string;
  source_field_id: string;
  source_field_key: string;
  source_field_label: string;
  source_cardinality: 'one' | 'many';
  target_is_unique: boolean;
  inverse_label: string | null;
}

/** PostgreSQL metadata reader for inverse relationship panels and commands. */
export class ResourceRelationshipDefinitionReaderPostgres implements ResourceRelationshipDefinitionReader {
  constructor(private readonly executor: PgExecutor) {}

  async listIncomingDefinitions(
    targetDomain: TypeDomain,
    targetTypeKey: string,
  ): Promise<IncomingResourceRelationshipDefinition[]> {
    const result = await this.executor.query<IncomingDefinitionRow>(
      `SELECT * FROM (
         SELECT
           'node'::text AS source_domain,
           t.type_key AS source_type_key,
           t.name AS source_type_name,
           f.id AS source_field_id,
           f.field_key AS source_field_key,
           f.label AS source_field_label,
           f.relation_source_cardinality AS source_cardinality,
           f.relation_target_is_unique AS target_is_unique,
           f.relation_inverse_label AS inverse_label,
           f.position AS field_position
         FROM node_type_fields f
         JOIN node_types t ON t.id = f.node_type_id
         WHERE t.deleted_at IS NULL
           AND t.is_active = TRUE
           AND f.data_type = 'relation'
           AND f.relation_target_domain = $1
           AND f.relation_target_type_key = $2

         UNION ALL

         SELECT
           'entity'::text AS source_domain,
           t.type_key AS source_type_key,
           t.name AS source_type_name,
           f.id AS source_field_id,
           f.field_key AS source_field_key,
           f.label AS source_field_label,
           f.relation_source_cardinality AS source_cardinality,
           f.relation_target_is_unique AS target_is_unique,
           f.relation_inverse_label AS inverse_label,
           f.position AS field_position
         FROM entity_type_fields f
         JOIN entity_types t ON t.id = f.entity_type_id
         WHERE t.deleted_at IS NULL
           AND t.is_active = TRUE
           AND f.data_type = 'relation'
           AND f.relation_target_domain = $1
           AND f.relation_target_type_key = $2
       ) definitions
       ORDER BY source_type_name, source_field_label, field_position, source_field_id`,
      [targetDomain, targetTypeKey],
    );

    return result.rows.map((row) => ({
      sourceDomain: row.source_domain,
      sourceTypeKey: row.source_type_key,
      sourceTypeName: row.source_type_name,
      sourceFieldId: row.source_field_id,
      sourceFieldKey: row.source_field_key,
      sourceFieldLabel: row.source_field_label,
      sourceCardinality: row.source_cardinality,
      targetIsUnique: row.target_is_unique,
      inverseLabel: row.inverse_label,
    }));
  }
}
