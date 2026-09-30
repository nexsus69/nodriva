import type {
  IncomingResourceRelationshipDefinition,
  ResourceRelationshipDefinitionReader,
} from '../../application/ports/ResourceRelationshipDefinitionReader.js';
import type { TypeDomain } from '../../application/dto/TypeFieldDefinition.js';
import type { SqliteDatabase } from './SqliteDatabase.js';

interface IncomingDefinitionRow {
  source_domain: TypeDomain;
  source_type_key: string;
  source_type_name: string;
  source_field_id: string;
  source_field_key: string;
  source_field_label: string;
  source_cardinality: 'one' | 'many' | null;
  target_is_unique: number | null;
  inverse_label: string | null;
  field_position: number | null;
}

/** SQLite metadata reader with the same observable result as PostgreSQL. */
export class ResourceRelationshipDefinitionReaderSqlite implements ResourceRelationshipDefinitionReader {
  constructor(private readonly database: SqliteDatabase) {
    this.database.protectAsyncMethods(this);
  }

  async listIncomingDefinitions(
    targetDomain: TypeDomain,
    targetTypeKey: string,
  ): Promise<IncomingResourceRelationshipDefinition[]> {
    const rows = this.database.all<IncomingDefinitionRow>(
      `SELECT * FROM (
         SELECT
           'node' AS source_domain,
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
           AND t.is_active = 1
           AND f.data_type = 'relation'
           AND f.relation_target_domain = ?
           AND f.relation_target_type_key = ?

         UNION ALL

         SELECT
           'entity' AS source_domain,
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
           AND t.is_active = 1
           AND f.data_type = 'relation'
           AND f.relation_target_domain = ?
           AND f.relation_target_type_key = ?
       ) definitions
       ORDER BY source_type_name, source_field_label, field_position, source_field_id`,
      [targetDomain, targetTypeKey, targetDomain, targetTypeKey],
    );

    return rows.map((row) => ({
      sourceDomain: row.source_domain,
      sourceTypeKey: row.source_type_key,
      sourceTypeName: row.source_type_name,
      sourceFieldId: row.source_field_id,
      sourceFieldKey: row.source_field_key,
      sourceFieldLabel: row.source_field_label,
      sourceCardinality: row.source_cardinality ?? 'one',
      targetIsUnique: Boolean(row.target_is_unique),
      inverseLabel: row.inverse_label,
    }));
  }
}
